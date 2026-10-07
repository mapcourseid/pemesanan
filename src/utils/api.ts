/**
 * API utility — mendukung dua mode:
 * 1. Firebase Cloud Functions (production) — VITE_FUNCTIONS_URL diset ke Functions base URL
 * 2. Railway Express (fallback) — VITE_API_URL diset ke Railway URL
 * 3. Development lokal — localhost:3001
 *
 * Firebase Cloud Functions URL format:
 *   https://asia-southeast1-pemesanan-688f7.cloudfunctions.net
 */

// Firebase Functions base URL (diisi di .env.production)
export const FUNCTIONS_BASE_URL = (import.meta.env.VITE_FUNCTIONS_URL || '').trim().replace(/\/+$/, '');

// Railway fallback
export const RAW_API_BASE_URL = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
export const API_BASE_URL = RAW_API_BASE_URL.endsWith('/api')
  ? RAW_API_BASE_URL.slice(0, -4)
  : RAW_API_BASE_URL;

const DEFAULT_REMOTE_BACKEND = 'https://ais-pre-hifhppexf446mwet4e2m3x-475639676104.asia-southeast1.run.app';

/**
 * Buat URL Cloud Function.
 * Jika VITE_FUNCTIONS_URL tersedia, gunakan itu.
 * Mapping endpoint Railway → Firebase Functions:
 *   /api/payment/xendit/invoice → /createXenditInvoiceFn
 *   /api/payment/xendit/webhook → /xenditWebhook
 *   /api/upload                 → /uploadFile
 *   Endpoint lain (CRUD orders) → tidak relevan (langsung ke Firebase RTDB)
 */
export function apiUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // Jika Firebase Functions URL tersedia, map endpoint Xendit & Upload
  if (FUNCTIONS_BASE_URL) {
    if (cleanPath === '/api/payment/xendit/invoice') {
      return `${FUNCTIONS_BASE_URL}/createXenditInvoiceFn`;
    }
    if (cleanPath === '/api/payment/xendit/webhook') {
      return `${FUNCTIONS_BASE_URL}/xenditWebhook`;
    }
    if (cleanPath === '/api/upload') {
      return `${FUNCTIONS_BASE_URL}/uploadFile`;
    }
  }

  // Jika diakses dari domain statis Firebase Hosting dengan Cloud Function rewrites
  if (
    !API_BASE_URL &&
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('firebaseapp.com') ||
      window.location.hostname.includes('web.app'))
  ) {
    // Dengan rewrites di firebase.json, endpoint /api/payment/xendit/... dan /api/upload langsung diproses oleh Cloud Function
    return cleanPath;
  }

  // Fallback ke Railway / localhost
  return `${API_BASE_URL}${cleanPath}`;
}

/**
 * Buat URL aset upload lengkap.
 */
export function fileUrl(path?: string): string {
  if (!path) return '';
  if (
    path.startsWith('data:') ||
    path.startsWith('blob:') ||
    path.startsWith('http://') ||
    path.startsWith('https://')
  ) {
    return path;
  }
  return apiUrl(path);
}

/**
 * Fetch wrapper dengan base URL otomatis.
 */
export async function apiFetch(
  path: string,
  options?: RequestInit
): Promise<Response> {
  return fetch(apiUrl(path), {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });
}

/**
 * Parse respons JSON secara aman.
 */
export async function parseJsonResponse<T = any>(
  res: Response,
  fallbackErrorMsg = 'Gagal memproses permintaan'
): Promise<T> {
  const contentType = res.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    if (res.status === 404) {
      throw new Error(
        `Endpoint tidak ditemukan (404): ${res.url}. Pastikan Firebase Functions sudah di-deploy dan VITE_FUNCTIONS_URL sudah diset dengan benar.`
      );
    }
    if (!res.ok) {
      throw new Error(
        `Server mengembalikan status ${res.status} (${res.statusText || 'Error'}).`
      );
    }
    throw new Error(
      'Server mengembalikan halaman HTML alih-alih data JSON. Pastikan VITE_FUNCTIONS_URL sudah diset dengan benar.'
    );
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || fallbackErrorMsg);
  }

  return data as T;
}
