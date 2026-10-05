import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const DATABASE_URL = "https://pemesanan-688f7-default-rtdb.asia-southeast1.firebasedatabase.app";

// Helper untuk lazy initialization Firebase Admin (mencegah timeout saat deployment metadata discovery)
function getDb(): admin.database.Database {
  if (!admin.apps.length) {
    admin.initializeApp({
      databaseURL: DATABASE_URL,
    });
  }
  return admin.database();
}

function getStorageBucket() {
  if (!admin.apps.length) {
    admin.initializeApp({
      databaseURL: DATABASE_URL,
    });
  }
  return admin.storage().bucket();
}

// ─────────────────────────────────────────────────────────────────────────────
// XENDIT TYPES & SIMULATION
// ─────────────────────────────────────────────────────────────────────────────

interface CreateInvoiceParams {
  externalId: string;
  amount: number;
  description: string;
  payerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
}

function getSimulatedInvoice(params: CreateInvoiceParams) {
  return {
    id: `sim_inv_${Date.now()}`,
    external_id: params.externalId,
    status: "PENDING",
    amount: params.amount,
    description: params.description,
    payer_email: params.payerEmail || "customer@mapcourse.id",
    invoice_url: `https://checkout.xendit.co/web/${params.externalId}?demo=true`,
    currency: "IDR",
    isSimulated: true,
  };
}

async function createXenditInvoice(params: CreateInvoiceParams) {
  const secretKey = process.env.XENDIT_SECRET_KEY || "";

  const isInvalidKey =
    !secretKey ||
    secretKey.trim() === "" ||
    secretKey.includes("your_") ||
    secretKey.includes("change_me") ||
    secretKey.includes("dummy");

  if (isInvalidKey) {
    console.warn("[Xendit] API Key belum diisi. Mode simulasi aktif.");
    return getSimulatedInvoice(params);
  }

  const basicAuth = Buffer.from(`${secretKey}:`).toString("base64");

  const payload = {
    external_id: params.externalId,
    amount: Math.round(params.amount),
    description: params.description,
    currency: "IDR",
    invoice_duration: 86400,
    customer: {
      given_names: params.customerName || "Customer",
      email: params.payerEmail || "customer@mapcourse.id",
      mobile_number: params.customerPhone || undefined,
    },
    customer_notification_preference: {
      invoice_created: ["whatsapp", "email"],
      invoice_reminder: ["whatsapp"],
      invoice_paid: ["whatsapp", "email"],
    },
    success_redirect_url: params.successRedirectUrl,
    failure_redirect_url: params.failureRedirectUrl,
    payment_methods: [
      "QRIS", "BCA", "BNI", "BRI", "MANDIRI", "PERMATA", "BSI",
      "OVO", "DANA", "SHOPEEPAY", "LINKAJA", "ALFAMART", "INDOMARET",
    ],
  };

  const response = await fetch("https://api.xendit.co/v2/invoices", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({message: response.statusText}));
    const errorMsg = (errorBody as any).message || JSON.stringify(errorBody);

    if (response.status === 401 || response.status === 403 || errorMsg.toLowerCase().includes("api key")) {
      console.warn("[Xendit] API Key tidak valid. Mode simulasi aktif:", errorMsg);
      return getSimulatedInvoice(params);
    }

    throw new Error(`Xendit Error: ${errorMsg}`);
  }

  const data = await response.json();
  return {...data, isSimulated: false};
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTION 1: Buat Invoice Xendit
// POST https://<region>-pemesanan-688f7.cloudfunctions.net/createXenditInvoiceFn
// ─────────────────────────────────────────────────────────────────────────────
export const createXenditInvoiceFn = functions.onRequest(
  {
    region: "asia-southeast1",
    cors: true,
  },
  async (req, res) => {
    // Only allow POST
    if (req.method !== "POST") {
      res.status(405).json({error: "Method Not Allowed"});
      return;
    }

    const {trackingCode} = req.body;
    if (!trackingCode) {
      res.status(400).json({error: "Kode tracking pesanan wajib diisi."});
      return;
    }

    try {
      const db = getDb();
      // Ambil data pesanan dari Firebase Realtime Database
      const snap = await db.ref(`mapcourse/orders/${trackingCode.toUpperCase()}`).get();

      if (!snap.exists()) {
        res.status(404).json({error: "Pesanan tidak ditemukan."});
        return;
      }

      const order = snap.val();

      // Jika invoice sudah ada dan belum lunas, kembalikan URL yang sama
      if (order.xenditInvoiceUrl && order.paymentStatus === "UNPAID") {
        res.json({
          success: true,
          invoiceUrl: order.xenditInvoiceUrl,
          invoiceId: order.xenditInvoiceId,
        });
        return;
      }

      const { frontendUrl: reqFrontendUrl } = req.body;
      const rawFrontendUrl = reqFrontendUrl || process.env.FRONTEND_URL || "https://pemesanan-688f7.web.app";
      const frontendUrl = rawFrontendUrl.trim().replace(/\/+$/, "");

      const invoice = await createXenditInvoice({
        externalId: order.trackingCode,
        amount: order.totalCost,
        description: `Pemetaan KKPR & Dokumen RTB - ${order.companyName} (${order.trackingCode})`,
        customerName: order.contactName || order.companyName,
        customerPhone: order.contactPhone,
        payerEmail: order.contactEmail || "customer@mapcourse.id",
        successRedirectUrl: `${frontendUrl}/?tab=tracking&code=${order.trackingCode}&payment=success`,
        failureRedirectUrl: `${frontendUrl}/?tab=payment&code=${order.trackingCode}&payment=failed`,
      });

      // Simpan invoice ID & URL ke Firebase
      await db.ref(`mapcourse/orders/${trackingCode.toUpperCase()}`).update({
        xenditInvoiceId: invoice.id,
        xenditInvoiceUrl: invoice.invoice_url,
      });

      res.json({
        success: true,
        invoiceUrl: invoice.invoice_url,
        invoiceId: invoice.id,
        isSimulated: invoice.isSimulated,
      });
    } catch (err: any) {
      console.error("Error creating Xendit invoice:", err);
      res.status(500).json({error: err.message || "Gagal membuat tagihan Xendit."});
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTION 2: Xendit Webhook (Auto-verify payment)
// POST https://<region>-pemesanan-688f7.cloudfunctions.net/xenditWebhook
// ─────────────────────────────────────────────────────────────────────────────
export const xenditWebhook = functions.onRequest(
  {
    region: "asia-southeast1",
    cors: false,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({error: "Method Not Allowed"});
      return;
    }

    // Verifikasi webhook token
    const callbackToken = req.headers["x-callback-token"] as string;
    const expectedToken = process.env.XENDIT_WEBHOOK_TOKEN;
    if (expectedToken && callbackToken !== expectedToken) {
      console.warn("[Xendit Webhook] Unauthorized token.");
      res.status(403).json({error: "Invalid callback token"});
      return;
    }

    const {external_id, status, payment_method, payment_channel} = req.body;
    console.log(`[Xendit Webhook] ${external_id}: ${status}`);

    if (status === "PAID" || status === "SETTLED") {
      const trackingCode = external_id?.toUpperCase();
      const db = getDb();
      const snap = await db.ref(`mapcourse/orders/${trackingCode}`).get();

      if (snap.exists()) {
        const order = snap.val();
        const now = new Date();
        const invoiceNumber = `INV/${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}/${trackingCode.slice(-7)}`;

        await db.ref(`mapcourse/orders/${trackingCode}`).update({
          paymentStatus: "PAID",
          paidAt: now.toISOString(),
          paymentMethod: `Xendit (${payment_method || payment_channel || "Multi-Payment"})`,
          invoiceNumber,
          status: order.status === "Menunggu Pembayaran" ? "Verifikasi Berkas" : order.status,
        });

        console.log(`[Xendit Webhook] ✅ Pesanan ${trackingCode} LUNAS!`);
      }
    }

    res.status(200).json({success: true});
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTION 3: Upload File ke Firebase Storage
// POST https://<region>-pemesanan-688f7.cloudfunctions.net/uploadFile
// ─────────────────────────────────────────────────────────────────────────────
export const uploadFile = functions.onRequest(
  {
    region: "asia-southeast1",
    cors: true,
    maxInstances: 10,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({error: "Method Not Allowed"});
      return;
    }

    try {
      const {fileBase64, fileName, mimeType, folder = "uploads"} = req.body;

      if (!fileBase64 || !fileName) {
        res.status(400).json({error: "fileBase64 dan fileName wajib diisi."});
        return;
      }

      const bucket = getStorageBucket();
      const base64Data = fileBase64.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      const safeName = fileName.replace(/[^a-zA-Z0-9_.\-]/g, "_");
      const filePath = `${folder}/${Date.now()}_${safeName}`;
      const fileRef = bucket.file(filePath);

      await fileRef.save(buffer, {
        metadata: {contentType: mimeType || "application/octet-stream"},
      });

      await fileRef.makePublic();
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

      res.json({success: true, fileUrl: publicUrl, filePath});
    } catch (err: any) {
      console.error("Error uploading file:", err);
      res.status(500).json({error: err.message || "Gagal mengunggah file."});
    }
  }
);
