import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { OrderItem, OrderStatus } from './types';
import { calculateOrderPrice, BASE_PRICE_MULTIPLIER } from './pricing';
import { createXenditInvoice, verifyXenditWebhookToken } from './xendit';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ['http://localhost:5173', 'http://localhost:4173'],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure upload directories exist
const uploadsDir = path.resolve('uploads');
const sampleFilesDir = path.resolve('uploads/samples');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(sampleFilesDir)) {
  fs.mkdirSync(sampleFilesDir, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}_${basename}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
});

// SSE Subscribers for Realtime Live-Tracking updates
interface SSEClient {
  id: string;
  res: express.Response;
}
let sseClients: SSEClient[] = [];

function broadcastUpdate(type: string, data: any) {
  const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.res.write(message);
    } catch (e) {
      console.error('Error sending SSE to client', client.id);
    }
  });
}

// In-Memory Database - starts empty, orders come from real customers
let orders: OrderItem[] = [];

// Server-Sent Events Endpoint
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.write('\n');

  const clientId = uuidv4();
  const newClient: SSEClient = { id: clientId, res };
  sseClients.push(newClient);

  req.on('close', () => {
    sseClients = sseClients.filter((c) => c.id !== clientId);
  });
});

// File Upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    success: true,
    fileUrl,
    originalName: req.file.originalname,
    size: req.file.size,
  });
});

// Get all orders
app.get('/api/orders', (_req, res) => {
  res.json(orders);
});

// Get stats
app.get('/api/stats', (_req, res) => {
  const total = orders.length;
  const pendingPayment = orders.filter((o) => o.status === 'Menunggu Pembayaran').length;
  const processing = orders.filter((o) => ['Verifikasi Berkas', 'Olah Data Polygon', 'Penyusunan Dokumen RTB'].includes(o.status)).length;
  const qc = orders.filter((o) => o.status === 'Quality Control').length;
  const completed = orders.filter((o) => o.status === 'Selesai').length;
  const totalRevenue = orders
    .filter((o) => o.paymentStatus === 'PAID')
    .reduce((sum, o) => sum + o.totalCost, 0);

  res.json({
    total,
    pendingPayment,
    processing,
    qc,
    completed,
    totalRevenue,
  });
});

// Get order by tracking code
app.get('/api/orders/:code', (req, res) => {
  const code = req.params.code.trim().toUpperCase();
  const order = orders.find((o) => o.trackingCode.toUpperCase() === code);
  if (!order) {
    return res.status(404).json({ error: 'Pesanan dengan kode tracking ini tidak ditemukan.' });
  }

  // Calculate queue position: how many active orders ahead of this one
  const activeStatuses: OrderStatus[] = ['Verifikasi Berkas', 'Olah Data Polygon', 'Penyusunan Dokumen RTB', 'Quality Control'];
  let queuePosition = 0;
  let aheadCount = 0;

  if (activeStatuses.includes(order.status)) {
    const activeOrders = orders.filter(
      (o) => activeStatuses.includes(o.status) && o.paymentStatus === 'PAID'
    );
    // Sort by created at ascending
    activeOrders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const idx = activeOrders.findIndex((o) => o.id === order.id);
    if (idx !== -1) {
      queuePosition = idx + 1;
      aheadCount = idx;
    }
  }

  res.json({
    ...order,
    queuePosition,
    aheadCount,
  });
});

// Create new order
app.post('/api/orders', (req, res) => {
  try {
    const {
      companyName,
      contactName,
      contactPhone,
      contactEmail,
      kbliCode,
      kbliName,
      areaSizeM2,
      areaUnit = 'm2',
      landOwnershipStatus,
      landOwnershipType,
      landDocumentUrl,
      landDocumentName,
      streetAddress,
      province,
      city,
      district,
      village,
      postalCode,
      buildingCount,
      buildingFloors,
      buildingHeightMeters,
      imbStatus,
      hasPolygon,
      coordinates,
      polygonShapefileUrl,
      polygonGeoJson,
      servicePackage = 'COMPLETE_RTB',
      assessmentFactors,
      discountCode,
      discountAmount: inputDiscountAmount,
    } = req.body;

    if (!companyName || !contactPhone || !areaSizeM2) {
      return res.status(400).json({ error: 'Data wajib belum lengkap (Nama Perusahaan, Kontak, Luasan).' });
    }

    const areaM2Num = Number(areaSizeM2);
    const pricing = calculateOrderPrice(areaM2Num, assessmentFactors, discountCode, inputDiscountAmount);

    // Generate unique tracking code POL-YYYY-MMDD-XXX
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const countToday = orders.filter((o) => o.createdAt.slice(0, 10) === now.toISOString().slice(0, 10)).length + 1;
    const trackingCode = `POL-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(countToday).padStart(3, '0')}`;
    const queueNumber = `#${String(orders.length + 1).padStart(2, '0')}`;

    const newOrder: OrderItem = {
      id: uuidv4(),
      trackingCode,
      queueNumber,
      createdAt: now.toISOString(),
      status: 'Menunggu Pembayaran',
      companyName,
      contactName: contactName || companyName,
      contactPhone,
      contactEmail: contactEmail || '',
      kbliCode: kbliCode || '68111',
      kbliName: kbliName || 'Real Estat',
      areaSizeM2: areaM2Num,
      areaUnit,
      landOwnershipStatus: landOwnershipStatus || 'Belum Menguasai',
      landOwnershipType,
      landDocumentUrl,
      landDocumentName,
      streetAddress: streetAddress || '',
      province: province || 'Jawa Barat',
      city: city || 'Bandung',
      district: district || '',
      village: village || '',
      postalCode: postalCode || '',
      buildingCount: Number(buildingCount) || 1,
      buildingFloors: Number(buildingFloors) || 1,
      buildingHeightMeters: Number(buildingHeightMeters) || 4,
      imbStatus: imbStatus || 'Dalam Proses',
      hasPolygon: Boolean(hasPolygon),
      coordinates,
      polygonShapefileUrl,
      polygonGeoJson,
      servicePackage: 'COMPLETE_RTB',
      isAbove3000m2: pricing.isAbove3000m2,
      assessmentFactors,
      difficultyScore: pricing.totalDifficultyScore,
      basePriceMultiplier: pricing.basePriceMultiplier,
      subtotalBeforeDiscount: pricing.subtotal,
      discountCode: pricing.discountCode,
      discountAmount: pricing.discountAmount,
      totalCost: pricing.finalPrice,
      paymentStatus: 'UNPAID',
    };

    orders.unshift(newOrder);
    broadcastUpdate('order_created', newOrder);

    res.status(201).json(newOrder);
  } catch (err: any) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: err.message || 'Gagal membuat pesanan' });
  }
});

// Pay / Verify Order
app.post('/api/orders/:code/pay', (req, res) => {
  const code = req.params.code.trim().toUpperCase();
  const order = orders.find((o) => o.trackingCode.toUpperCase() === code);
  if (!order) {
    return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  }

  const { paymentMethod = 'QRIS Instant' } = req.body;
  const now = new Date();
  const invoiceNumber = `INV/${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}/${order.trackingCode.slice(-7)}`;

  order.paymentStatus = 'PAID';
  order.paidAt = now.toISOString();
  order.paymentMethod = paymentMethod;
  order.invoiceNumber = invoiceNumber;
  order.status = 'Verifikasi Berkas';

  broadcastUpdate('order_updated', order);
  res.json({
    success: true,
    message: 'Pembayaran terverifikasi otomatis!',
    order,
  });
});

// Xendit: Create Invoice Endpoint
app.post('/api/payment/xendit/invoice', async (req, res) => {
  try {
    const { trackingCode } = req.body;
    if (!trackingCode) {
      return res.status(400).json({ error: 'Kode tracking pesanan wajib diisi.' });
    }

    const order = orders.find((o) => o.trackingCode.toUpperCase() === trackingCode.trim().toUpperCase());
    if (!order) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    }

    // Jika invoice Xendit sudah ada dan belum lunas, gunakan kembali URL yang sama
    if (order.xenditInvoiceUrl && order.paymentStatus === 'UNPAID') {
      return res.json({
        success: true,
        invoiceUrl: order.xenditInvoiceUrl,
        invoiceId: order.xenditInvoiceId,
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const invoice = await createXenditInvoice({
      externalId: order.trackingCode,
      amount: order.totalCost,
      description: `Pemetaan KKPR & Dokumen RTB - ${order.companyName} (${order.trackingCode})`,
      customerName: order.contactName || order.companyName,
      customerPhone: order.contactPhone,
      payerEmail: order.contactEmail || 'customer@mapcourse.id',
      successRedirectUrl: `${frontendUrl}/?tab=tracking&code=${order.trackingCode}&payment=success`,
      failureRedirectUrl: `${frontendUrl}/?tab=payment&code=${order.trackingCode}&payment=failed`,
    });

    order.xenditInvoiceId = invoice.id;
    order.xenditInvoiceUrl = invoice.invoice_url;
    broadcastUpdate('order_updated', order);

    res.json({
      success: true,
      invoiceUrl: invoice.invoice_url,
      invoiceId: invoice.id,
      isSimulated: invoice.isSimulated,
    });
  } catch (err: any) {
    console.error('Error creating Xendit invoice:', err);
    res.status(500).json({ error: err.message || 'Gagal membuat tagihan Xendit.' });
  }
});

// Xendit: Webhook Callback (Auto-Verification)
app.post('/api/payment/xendit/webhook', (req, res) => {
  try {
    const callbackToken = req.headers['x-callback-token'];
    if (!verifyXenditWebhookToken(callbackToken)) {
      console.warn('[Xendit Webhook] Unauthorized callback token received.');
      return res.status(403).json({ error: 'Invalid callback token' });
    }

    const { external_id, status, payment_method, payment_channel } = req.body;
    console.log(`[Xendit Webhook] Notifikasi diterima untuk ${external_id}: status ${status}`);

    if (status === 'PAID' || status === 'SETTLED') {
      const order = orders.find((o) => o.trackingCode.toUpperCase() === external_id?.toUpperCase());
      if (order) {
        const now = new Date();
        const invoiceNumber = `INV/${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}/${order.trackingCode.slice(-7)}`;

        order.paymentStatus = 'PAID';
        order.paidAt = now.toISOString();
        order.paymentMethod = `Xendit (${payment_method || payment_channel || 'Multi-Payment'})`;
        order.invoiceNumber = invoiceNumber;
        order.status = 'Verifikasi Berkas';

        broadcastUpdate('order_updated', order);
        console.log(`[Xendit Webhook] ✅ Pesanan ${order.trackingCode} BERHASIL dibayar otomatis!`);
      }
    }

    res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (err: any) {
    console.error('Error processing Xendit webhook:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update order status (GIS / Internal team)
app.post('/api/orders/:code/status', (req, res) => {
  const code = req.params.code.trim().toUpperCase();
  const order = orders.find((o) => o.trackingCode.toUpperCase() === code);
  if (!order) {
    return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  }

  const { status } = req.body;
  const validStatuses: OrderStatus[] = [
    'Menunggu Pembayaran',
    'Verifikasi Berkas',
    'Olah Data Polygon',
    'Penyusunan Dokumen RTB',
    'Quality Control',
    'Selesai',
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid' });
  }

  order.status = status;
  if (status === 'Selesai' && !order.gisResultFiles?.completedAt) {
    order.gisResultFiles = {
      ...(order.gisResultFiles || {}),
      zipShpUrl: order.gisResultFiles?.zipShpUrl || '/uploads/samples/sample_shp_bundle.zip',
      kmlUrl: order.gisResultFiles?.kmlUrl || '/uploads/samples/sample_layer.kml',
      geoJsonUrl: order.gisResultFiles?.geoJsonUrl || '/uploads/samples/sample_polygon.geojson',
      rtbPdfUrl: order.gisResultFiles?.rtbPdfUrl || '/uploads/samples/sample_rtb_rencana_tapak.pdf',
      completedAt: new Date().toISOString(),
    };
  }

  broadcastUpdate('order_updated', order);
  res.json({ success: true, order });
});

// Upload GIS Drafter deliverables
app.post('/api/orders/:code/upload-gis', upload.fields([
  { name: 'shpZip', maxCount: 1 },
  { name: 'rtbPdf', maxCount: 1 },
]), (req, res) => {
  const code = req.params.code.trim().toUpperCase();
  const order = orders.find((o) => o.trackingCode.toUpperCase() === code);
  if (!order) {
    return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  }

  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const zipFile = files?.['shpZip']?.[0];
  const pdfFile = files?.['rtbPdf']?.[0];

  order.gisResultFiles = {
    zipShpUrl: zipFile ? `/uploads/${zipFile.filename}` : (order.gisResultFiles?.zipShpUrl || '/uploads/samples/sample_shp_bundle.zip'),
    kmlUrl: order.gisResultFiles?.kmlUrl || '/uploads/samples/sample_layer.kml',
    geoJsonUrl: order.gisResultFiles?.geoJsonUrl || '/uploads/samples/sample_polygon.geojson',
    rtbPdfUrl: pdfFile ? `/uploads/${pdfFile.filename}` : (order.gisResultFiles?.rtbPdfUrl || '/uploads/samples/sample_rtb_rencana_tapak.pdf'),
    completedAt: new Date().toISOString(),
  };

  broadcastUpdate('order_updated', order);
  res.json({ success: true, order });
});

// Submit Feedback (Rating & Review)
app.post('/api/orders/:code/feedback', (req, res) => {
  const code = req.params.code.trim().toUpperCase();
  const order = orders.find((o) => o.trackingCode.toUpperCase() === code);
  if (!order) {
    return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  }

  const { rating, review } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating harus antara 1 sampai 5' });
  }

  order.rating = Number(rating);
  order.review = review || '';
  order.feedbackSubmittedAt = new Date().toISOString();

  broadcastUpdate('order_updated', order);
  res.json({ success: true, message: 'Terima kasih atas ulasan Anda!', order });
});

// Add clarification note / send WA notification log
app.post('/api/orders/:code/clarify', (req, res) => {
  const code = req.params.code.trim().toUpperCase();
  const order = orders.find((o) => o.trackingCode.toUpperCase() === code);
  if (!order) {
    return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  }

  const { message, sender = 'Tim GIS & Drafter' } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Pesan klarifikasi wajib diisi' });
  }

  const note = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    message,
    sender,
  };

  if (!order.clarificationNotes) {
    order.clarificationNotes = [];
  }
  order.clarificationNotes.unshift(note);

  broadcastUpdate('order_updated', order);
  res.json({ success: true, note });
});

// Apply discount endpoint
app.post('/api/orders/:code/discount', (req, res) => {
  const code = req.params.code.trim().toUpperCase();
  const order = orders.find((o) => o.trackingCode.toUpperCase() === code);
  if (!order) {
    return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  }

  const { discountAmount = 0, discountCode = 'STAFF_DISCOUNT' } = req.body;
  const subtotal = order.subtotalBeforeDiscount || (order.totalCost + (order.discountAmount || 0));
  order.subtotalBeforeDiscount = subtotal;
  order.discountAmount = Number(discountAmount);
  order.discountCode = discountCode;
  order.totalCost = Math.max(0, subtotal - order.discountAmount);

  broadcastUpdate('order_updated', order);
  res.json({ success: true, order });
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`[API Server] Running at http://localhost:${PORT}`);
});
