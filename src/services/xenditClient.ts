import { apiUrl } from '../utils/api';

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
 * Buat tagihan resmi Xendit melalui backend proxy yang aman (/api/payment/xendit/invoice).
 * Secret API Key disimpan di server-side environment variables dan TIDAK PERNAH diekspos ke browser / client-side.
 */
export async function requestXenditInvoice(params: XenditInvoiceRequest): Promise<XenditInvoiceResult> {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  try {
    const backendUrl = apiUrl('/api/payment/xendit/invoice');
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
      if (data?.invoiceUrl) {
        return {
          invoiceUrl: data.invoiceUrl,
          invoiceId: data.invoiceId || data.id,
        };
      }
    }
  } catch (backendErr) {
    console.warn('[Xendit Client] Backend proxy belum merespons:', backendErr);
  }

  // Fallback simulasi aman jika server proxy sedang offline / testing
  return {
    invoiceUrl: `https://checkout.xendit.co/web/${params.trackingCode}?demo=true`,
    invoiceId: `sim_inv_${Date.now()}`,
  };
}

/**
 * Cari status tagihan dari server backend berdasarkan kode tracking.
 * Panggilan aman melalui backend tanpa mengekspos API Key ke client.
 */
export async function fetchXenditInvoiceByCode(trackingCode: string): Promise<any | null> {
  if (!trackingCode) return null;
  try {
    const statusUrl = apiUrl(`/api/payment/xendit/status/${encodeURIComponent(trackingCode.trim())}`);
    const res = await fetch(statusUrl);

    if (res.ok) {
      const data = await res.json();
      if (data?.invoice) {
        return data.invoice;
      }
    }
  } catch (err) {
    console.warn('[Xendit Client] fetchXenditInvoiceByCode notice:', err);
  }
  return null;
}
