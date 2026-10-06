import { apiUrl } from '../utils/api';

export const XENDIT_DEV_KEY = 'xnd_development_iW708a37TiEdyhC9o41R6yDbXcsZl9eI1K397LENvmS24tpUay89P06TFPg';

export interface XenditInvoiceRequest {
  trackingCode: string;
  totalCost: number;
  companyName: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
}

export interface XenditInvoiceResult {
  invoiceUrl: string;
  invoiceId: string;
}

/**
 * Buat tagihan resmi Xendit dengan fallback cerdas:
 * 1. Coba lewat backend proxy (/api/payment/xendit/invoice)
 * 2. Jika backend offline/CORS (misal di Firebase Hosting statis), panggil langsung API resmi Xendit (mendukung CORS)
 */
export async function requestXenditInvoice(params: XenditInvoiceRequest): Promise<XenditInvoiceResult> {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // 1. Coba lewat backend internal
  try {
    const backendUrl = apiUrl('/api/payment/xendit/invoice');
    if (backendUrl && !backendUrl.includes('ais-pre-')) {
      const res = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingCode: params.trackingCode,
          amount: params.totalCost,
          companyName: params.companyName,
          contactName: params.contactName,
          contactPhone: params.contactPhone,
          contactEmail: params.contactEmail,
          frontendUrl: origin,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.invoiceUrl && !data.invoiceUrl.includes('?demo=true')) {
          return {
            invoiceUrl: data.invoiceUrl,
            invoiceId: data.invoiceId || data.id,
          };
        }
      }
    }
  } catch (backendErr) {
    console.info('[Xendit] Backend proxy tidak merespons, beralih ke panggilan langsung API Xendit:', backendErr);
  }

  // 2. Panggilan langsung ke Xendit Invoice API v2 (didukung resmi oleh Xendit CORS: Access-Control-Allow-Origin: *)
  const basicAuth = btoa(`${XENDIT_DEV_KEY}:`);
  const xenditRes = await fetch('https://api.xendit.co/v2/invoices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: JSON.stringify({
      external_id: params.trackingCode,
      amount: params.totalCost,
      description: `Layanan Pemetaan Polygon & RTB - ${params.companyName} (${params.trackingCode})`,
      payer_email: params.contactEmail || 'help@mapcourseid.com',
      customer: {
        given_names: params.contactName || params.companyName,
        mobile_number: params.contactPhone,
        email: params.contactEmail || 'help@mapcourseid.com',
      },
      success_redirect_url: `${origin}/?payment=success&code=${params.trackingCode}`,
      failure_redirect_url: `${origin}/?tab=payment&code=${params.trackingCode}`,
      currency: 'IDR',
    }),
  });

  if (!xenditRes.ok) {
    const errJson = await xenditRes.json().catch(() => ({}));
    throw new Error(errJson.message || `Xendit API error: HTTP ${xenditRes.status}`);
  }

  const resultData = await xenditRes.json();
  return {
    invoiceUrl: resultData.invoice_url,
    invoiceId: resultData.id,
  };
}

/**
 * Cari data status tagihan langsung dari server Xendit berdasarkan kode tracking
 */
export async function fetchXenditInvoiceByCode(trackingCode: string): Promise<any | null> {
  if (!trackingCode) return null;
  try {
    const basicAuth = btoa(`${XENDIT_DEV_KEY}:`);
    const res = await fetch(`https://api.xendit.co/v2/invoices?external_id=${encodeURIComponent(trackingCode.trim())}`, {
      headers: {
        'Authorization': `Basic ${basicAuth}`,
      },
    });

    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        return list[0];
      }
    }
  } catch (err) {
    console.warn('[Xendit] fetchXenditInvoiceByCode notice:', err);
  }
  return null;
}

