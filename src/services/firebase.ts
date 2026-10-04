import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  get,
  remove,
  onValue,
  off,
  Database,
} from 'firebase/database';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import type { OrderItem } from '../types';

// =========================================================
// KONFIGURASI FIREBASE RESMI MAP COURSE
// Otomatis terhubung langsung ke Firebase Realtime Database & Auth
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
let authInstance: Auth | null = null;
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

    try {
      authInstance = getAuth(app);
    } catch (e) {
      console.warn('[Firebase Auth] Notice:', e);
    }
    
    _isConnected = true;
    console.log('[Firebase] ✅ Realtime Database & Auth terhubung otomatis!');
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
    const orderRef = ref(dbInstance, `mapcourse/orders/${order.trackingCode.toUpperCase()}`);
    await set(orderRef, order);
    console.log(`[Firebase] Order ${order.trackingCode} tersinkronisasi ke cloud!`);
    return true;
  } catch (err) {
    console.warn('[Firebase] Sync notice:', err);
    return false;
  }
}

export async function fetchSingleOrderFromFirebase(trackingCode: string): Promise<OrderItem | null> {
  if (!dbInstance || !trackingCode) return null;
  try {
    const cleanCode = trackingCode.trim().toUpperCase();
    const orderRef = ref(dbInstance, `mapcourse/orders/${cleanCode}`);
    const snapshot = await get(orderRef);
    if (snapshot.exists()) {
      return snapshot.val() as OrderItem;
    }
    
    // Fallback: search all orders if key mismatch
    const allRef = ref(dbInstance, 'mapcourse/orders');
    const allSnap = await get(allRef);
    if (allSnap.exists()) {
      const allData = allSnap.val();
      const found = Object.values(allData).find(
        (o: any) => o?.trackingCode?.toUpperCase() === cleanCode
      ) as OrderItem | undefined;
      return found || null;
    }
    return null;
  } catch (err) {
    console.warn('[Firebase] Fetch single order notice:', err);
    return null;
  }
}

export async function deleteOrderFromFirebase(trackingCode: string): Promise<boolean> {
  if (!dbInstance || !trackingCode) return false;
  try {
    const cleanCode = trackingCode.trim().toUpperCase();
    const orderRef = ref(dbInstance, `mapcourse/orders/${cleanCode}`);
    await remove(orderRef);
    console.log(`[Firebase] Order ${cleanCode} berhasil dihapus dari cloud database!`);
    return true;
  } catch (err) {
    console.warn('[Firebase] Delete notice:', err);
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
      } else {
        onData([]);
      }
    });
    return () => off(ordersRef, 'value', callback);
  } catch (err) {
    console.warn('[Firebase] Subscription notice:', err);
    return () => {};
  }
}

// =========================================================
// FIREBASE AUTHENTICATION UNTUK STAF
// =========================================================
export async function loginStaffWithFirebase(email: string, password: string): Promise<{ name: string; role: string; email: string }> {
  if (authInstance) {
    try {
      const userCredential = await signInWithEmailAndPassword(authInstance, email, password);
      const user = userCredential.user;
      return {
        name: user.displayName || user.email?.split('@')[0] || 'Staf MAP COURSE',
        role: 'Tim Pemetaan GIS & RTB',
        email: user.email || email,
      };
    } catch (authErr: any) {
      console.warn('[Firebase Auth] Login failed or auth not configured, checking default credentials fallback:', authErr);
    }
  }

  // Fallback default admin credentials jika Firebase Auth belum diaktifkan di console
  if (email === 'admin@mapcourse.id' && password === 'admin123') {
    return {
      name: 'Tim GIS MAP COURSE (Admin)',
      role: 'Head of GIS & Specialist RTB',
      email: 'admin@mapcourse.id',
    };
  } else if (email === 'staf@mapcourse.id' && password === 'staf123') {
    return {
      name: 'Drafter GIS MAP COURSE',
      role: 'Tim Pemetaan GIS & Drafter',
      email: 'staf@mapcourse.id',
    };
  }

  throw new Error('Email atau password staf salah. Gunakan admin@mapcourse.id / admin123 atau registrasikan di Firebase Auth.');
}

export async function logoutStaffWithFirebase(): Promise<void> {
  if (authInstance) {
    try {
      await signOut(authInstance);
    } catch (e) {
      console.warn('[Firebase Auth] Signout notice:', e);
    }
  }
}

export function onStaffAuthStateChanged(callback: (user: { name: string; role: string; email: string } | null) => void): () => void {
  if (!authInstance) return () => {};
  return onAuthStateChanged(authInstance, (firebaseUser: User | null) => {
    if (firebaseUser) {
      callback({
        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Staf MAP COURSE',
        role: 'Tim Pemetaan GIS & RTB',
        email: firebaseUser.email || '',
      });
    } else {
      callback(null);
    }
  });
}

export function isFirebaseConnected(): boolean {
  return _isConnected && dbInstance !== null;
}
