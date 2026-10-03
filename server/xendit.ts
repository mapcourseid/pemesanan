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
}

/**
 * Buat Invoice Xendit
 */
export async function createXenditInvoice(params: CreateInvoiceParams): Promise<XenditInvoiceResponse> {
  const secretKey = process.env.XENDIT_SECRET_KEY;

  // Jika belum ada secret key, jalankan mode simulasi aman untuk pengujian
  if (!secretKey || secretKey.trim() === '') {
    console.warn('[Xendit] XENDIT_SECRET_KEY belum diisi. Menggunakan mode simulasi invoice.');
    return {
      id: `sim_inv_${Date.now()}`,
      external_id: params.externalId,
      status: 'PENDING',
      amount: params.amount,
      description: params.description,
      payer_email: params.payerEmail || 'customer@mapcourse.id',
      invoice_url: `https://checkout.xendit.co/web/${params.externalId}?demo=true`,
      currency: 'IDR',
      isSimulated: true,
    };
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

  const response = await fetch('https://api.xendit.co/v2/invoices', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`Xendit Error: ${errorBody.message || JSON.stringify(errorBody)}`);
  }

  const data = await response.json();
  return {
    ...data,
    isSimulated: false,
  };
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
