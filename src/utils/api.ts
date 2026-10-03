/**
 * API base URL — otomatis menyesuaikan antara development dan production.
 * - Development: menggunakan Vite proxy ke http://localhost:3001
 * - Production: menggunakan VITE_API_URL dari environment variable
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Buat URL API lengkap.
 * @param path - path endpoint, misal '/api/orders'
 */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
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
