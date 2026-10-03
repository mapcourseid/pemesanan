import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  onValue,
  off,
  Database,
} from 'firebase/database';
import type { OrderItem } from '../types';

// =========================================================
// KONFIGURASI FIREBASE RESMI MAP COURSE
// Otomatis terhubung langsung ke Firebase Realtime Database
// =========================================================
export const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

let dbInstance: Database | null = null;
let _isConnected = false;

export function initFirebaseService(): boolean {
  try {
    const { apiKey, projectId } = FIREBASE_CONFIG;

    if (!apiKey || !projectId) {
      console.log('[Firebase] Konfigurasi belum diisi.');
      return false;
    }

    const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApp();
    try {
      dbInstance = FIREBASE_CONFIG.databaseURL ? getDatabase(app, FIREBASE_CONFIG.databaseURL) : getDatabase(app);
    } catch {
      dbInstance = getDatabase(app);
    }
    
    _isConnected = true;
    console.log('[Firebase] ✅ Realtime Database terhubung otomatis!');
    return true;
  } catch (err) {
    console.warn('[Firebase] Inisialisasi notice:', err);
    _isConnected = false;
    return false;
  }
}

export async function syncOrderToFirebase(order: OrderItem): Promise<boolean> {
  if (!dbInstance) return false;
  try {
    const orderRef = ref(dbInstance, `mapcourse/orders/${order.trackingCode}`);
    await set(orderRef, order);
    console.log(`[Firebase] Order ${order.trackingCode} tersinkronisasi ke cloud!`);
    return true;
  } catch (err) {
    console.warn('[Firebase] Sync notice:', err);
    return false;
  }
}

export function subscribeToFirebaseOrders(
  onData: (orders: OrderItem[]) => void
): () => void {
  if (!dbInstance) return () => {};
  try {
    const ordersRef = ref(dbInstance, 'mapcourse/orders');
    const callback = onValue(ordersRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const orderList = Object.values(val) as OrderItem[];
        orderList.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        onData(orderList);
      }
    });
    return () => off(ordersRef, 'value', callback);
  } catch (err) {
    console.warn('[Firebase] Subscription notice:', err);
    return () => {};
  }
}

export function isFirebaseConnected(): boolean {
  return _isConnected && dbInstance !== null;
}
