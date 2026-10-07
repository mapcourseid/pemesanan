/**
 * Modul Integrasi Xendit Payment Gateway
 * Standar Resmi Xendit Invoice API v2
 */

export interface CreateInvoiceParams {
  externalId: string;
  amount: number;
  description: string;
  payerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
}

export interface XenditInvoiceResponse {
  id: string;
  external_id: string;
  user_id?: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'SETTLED';
  merchant_name?: string;
  amount: number;
  payer_email?: string;
  description: string;
  invoice_url: string;
  expiry_date?: string;
  created?: string;
  currency: string;
  isSimulated?: boolean;
  warningMessage?: string;
}

function getSimulatedInvoice(params: CreateInvoiceParams, warning?: string): XenditInvoiceResponse {
  return {
    id: `sim_inv_${Date.now()}`,
    external_id: params.externalId,
    status: 'PENDING',
    amount: params.amount,
    description: params.description,
    payer_email: params.payerEmail || 'customer@mapcourse.id',
    invoice_url: '',
    currency: 'IDR',
    isSimulated: true,
    warningMessage: warning,
  };
}

/**
 * Buat Invoice Xendit
 */
export async function createXenditInvoice(params: CreateInvoiceParams): Promise<XenditInvoiceResponse> {
  const secretKey = process.env.XENDIT_SECRET_KEY;

  // Jika belum ada secret key atau masih menggunakan placeholder dummy, gunakan mode simulasi aman
  const isInvalidKey =
    !secretKey ||
    secretKey.trim() === '' ||
    secretKey.includes('your_') ||
    secretKey.includes('change_me') ||
    secretKey.includes('dummy') ||
    secretKey.includes('XENDIT_SECRET_KEY');

  if (isInvalidKey) {
    console.warn('[Xendit] XENDIT_SECRET_KEY belum diisi dengan API Key asli dari Xendit Dashboard. Menggunakan mode simulasi invoice.');
    return getSimulatedInvoice(
      params,
      'XENDIT_SECRET_KEY belum diisi dengan API Key valid dari Dashboard Xendit. Sistem berjalan dalam mode simulasi.'
    );
  }

  const basicAuth = Buffer.from(`${secretKey}:`).toString('base64');

  const payload: any = {
    external_id: params.externalId,
    amount: Math.round(params.amount),
    description: params.description,
    currency: 'IDR',
    invoice_duration: 86400, // 24 jam berlaku
    customer: {
      given_names: params.customerName || 'Customer',
      email: params.payerEmail || 'customer@mapcourse.id',
      mobile_number: params.customerPhone || undefined,
    },
    customer_notification_preference: {
      invoice_created: ['whatsapp', 'email'],
      invoice_reminder: ['whatsapp'],
      invoice_paid: ['whatsapp', 'email'],
    },
    success_redirect_url: params.successRedirectUrl,
    failure_redirect_url: params.failureRedirectUrl,
    payment_methods: [
      'QRIS',
      'BCA',
      'BNI',
      'BRI',
      'MANDIRI',
      'PERMATA',
      'BSI',
      'OVO',
      'DANA',
      'SHOPEEPAY',
      'LINKAJA',
      'ALFAMART',
      'INDOMARET',
    ],
  };

  try {
    const response = await fetch('https://api.xendit.co/v2/invoices', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: response.statusText }));
      const errorMsg = errorBody.message || JSON.stringify(errorBody);

      // Jika Xendit menolak API key (401 Unauthorized / Invalid Key error)
      if (
        response.status === 401 ||
        response.status === 403 ||
        errorMsg.toLowerCase().includes('api key') ||
        errorMsg.toLowerCase().includes('invalid')
      ) {
        console.warn('[Xendit API] XENDIT_SECRET_KEY ditolak oleh server Xendit (Invalid API Key):', errorMsg);
        return getSimulatedInvoice(
          params,
          'XENDIT_SECRET_KEY ditolak oleh server Xendit (401 INVALID_API_KEY). Pastikan Secret Key disalin lengkap dari Dashboard Xendit (Pengaturan > API Keys) dengan izin Money-in (WRITE).'
        );
      }

      throw new Error(`Xendit Error: ${errorMsg}`);
    }

    const data = await response.json();
    return {
      ...data,
      isSimulated: false,
    };
  } catch (err: any) {
    if (err.message && err.message.includes('Xendit Error:')) {
      throw err;
    }
    console.warn('[Xendit Network Notice] Gagal menghubungi server Xendit. Menggunakan fallback simulasi:', err);
    return getSimulatedInvoice(
      params,
      'Gagal menghubungi server Xendit. Menggunakan mode simulasi untuk pengujian.'
    );
  }
}

/**
 * Validasi Webhook Token dari Xendit Callback
 */
export function verifyXenditWebhookToken(tokenFromHeader?: string | string[]): boolean {
  const expectedToken = process.env.XENDIT_WEBHOOK_TOKEN;
  if (!expectedToken) {
    // Jika belum diset di .env, izinkan dengan peringatan
    return true;
  }
  const token = Array.isArray(tokenFromHeader) ? tokenFromHeader[0] : tokenFromHeader;
  return token === expectedToken;
}

/**
 * Cari data status invoice Xendit dari server Xendit berdasarkan external_id
 */
export async function getXenditInvoiceByExternalId(externalId: string): Promise<any | null> {
  const secretKey = process.env.XENDIT_SECRET_KEY;
  if (!secretKey || secretKey.trim() === '' || secretKey.includes('your_') || secretKey.includes('dummy')) {
    return null;
  }

  const basicAuth = Buffer.from(`${secretKey}:`).toString('base64');
  try {
    const response = await fetch(`https://api.xendit.co/v2/invoices?external_id=${encodeURIComponent(externalId.trim())}`, {
      headers: {
        Authorization: `Basic ${basicAuth}`,
      },
    });

    if (response.ok) {
      const list = await response.json();
      if (Array.isArray(list) && list.length > 0) {
        return list[0];
      }
    }
  } catch (err) {
    console.warn('[Xendit Server] Gagal memeriksa invoice:', err);
  }
  return null;
}
