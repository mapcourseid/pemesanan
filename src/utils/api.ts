/**
 * API base URL — otomatis menyesuaikan antara development dan production.
 * - Development: menggunakan Vite proxy (string kosong) ke http://localhost:3001
 * - Production: menggunakan VITE_API_URL dari environment variable (misal https://xxx.up.railway.app)
 */
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

/**
 * Buat URL API lengkap.
 * @param path - path endpoint, misal '/api/orders'
 */
export function apiUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

/**
 * Buat URL aset upload lengkap.
 */
export function fileUrl(path?: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
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
 * Jika server mengembalikan HTML (misal 404 dari Netlify/Vercel karena VITE_API_URL belum diset),
 * fungsi ini memberikan pesan kesalahan yang jelas dan mudah dipahami alih-alih error "Unexpected token <".
 */
export async function parseJsonResponse<T = any>(
  res: Response,
  fallbackErrorMsg = 'Gagal memproses permintaan'
): Promise<T> {
  const contentType = res.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    if (!res.ok) {
      throw new Error(
        `Backend server mengembalikan status ${res.status} (${res.statusText}). Pastikan backend Railway aktif.`
      );
    }
    throw new Error(
      'Server mengembalikan halaman HTML alih-alih data JSON. Pastikan server backend Railway aktif dan variabel VITE_API_URL sudah disetting di dashboard hosting Anda (Netlify/Vercel).'
    );
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || fallbackErrorMsg);
  }

  return data as T;
}
