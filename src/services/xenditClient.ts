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
  isSimulated?: boolean;
  warningMessage?: string;
}

const BACKEND_FALLBACK_URL = 'https://ais-dev-hifhppexf446mwet4e2m3x-475639676104.asia-southeast1.run.app';

/**
 * Buat tagihan resmi Xendit melalui backend proxy yang aman (/api/payment/xendit/invoice).
 * Secret API Key disimpan di server-side environment variables dan TIDAK PERNAH diekspos ke browser / client-side.
 */
export async function requestXenditInvoice(params: XenditInvoiceRequest): Promise<XenditInvoiceResult> {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const payload = {
    trackingCode: params.trackingCode,
    amount: params.totalCost,
    companyName: params.companyName,
    contactName: params.contactName,
    contactPhone: params.contactPhone,
    contactEmail: params.contactEmail,
    frontendUrl: origin,
  };

  const candidateUrls = [
    apiUrl('/api/payment/xendit/invoice'),
    `${BACKEND_FALLBACK_URL}/api/payment/xendit/invoice`,
  ];

  // Hapus duplikat
  const uniqueUrls = Array.from(new Set(candidateUrls));

  for (const targetUrl of uniqueUrls) {
    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const isSim = Boolean(data?.isSimulated);
        const url = data?.invoiceUrl || data?.invoice_url || data?.data?.invoice_url || data?.data?.invoiceUrl;
        const id = data?.invoiceId || data?.id || data?.data?.id || `inv_${params.trackingCode}`;

        // URL resmi Xendit baik production (checkout.xendit.co) maupun staging (checkout-staging.xendit.co)
        const isOfficialXenditUrl =
          typeof url === 'string' &&
          (url.includes('checkout.xendit.co') || url.includes('checkout-staging.xendit.co')) &&
          !url.includes('?demo=true');

        if (isOfficialXenditUrl && !isSim) {
          return {
            invoiceUrl: url,
            invoiceId: id,
            isSimulated: false,
          };
        }

        if (data?.invoiceUrl || data?.invoiceId) {
          return {
            invoiceUrl: isOfficialXenditUrl ? url : '',
            invoiceId: id,
            isSimulated: isSim || !isOfficialXenditUrl,
            warningMessage: data?.warningMessage || undefined,
          };
        }
      } else if (res.status === 403) {
        console.warn(`[Xendit Client] ${targetUrl} mengembalikan 403 Forbidden. Mencoba fallback server berikutnya...`);
      }
    } catch (targetErr) {
      console.warn(`[Xendit Client] Gagal menghubungi ${targetUrl}:`, targetErr);
    }
  }

  // Fallback aman jika seluruh backend sedang offline
  return {
    invoiceUrl: '',
    invoiceId: `sim_inv_${params.trackingCode}`,
    isSimulated: true,
    warningMessage: 'Koneksi ke gateway pembayaran belum tersedia.',
  };
}

/**
 * Cari status tagihan dari server backend berdasarkan kode tracking.
 * Panggilan aman melalui backend tanpa mengekspos API Key ke client.
 */
export async function fetchXenditInvoiceByCode(trackingCode: string): Promise<any | null> {
  if (!trackingCode) return null;
  const urls = [
    apiUrl(`/api/payment/xendit/status/${encodeURIComponent(trackingCode.trim())}`),
    `${BACKEND_FALLBACK_URL}/api/payment/xendit/status/${encodeURIComponent(trackingCode.trim())}`,
  ];

  for (const u of urls) {
    try {
      const res = await fetch(u);
      if (res.ok) {
        const data = await res.json();
        if (data?.invoice) {
          return data.invoice;
        }
      }
    } catch {
      // coba berikutnya
    }
  }
  return null;
}
