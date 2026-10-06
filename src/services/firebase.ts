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
  apiKey: 'AIzaSyBgfAtedQdcgYLaR2K8Sv6Zpc-lk4xuPLw',
  authDomain: 'pemesanan-688f7.firebaseapp.com',
  databaseURL: 'https://pemesanan-688f7-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'pemesanan-688f7',
  storageBucket: 'pemesanan-688f7.firebasestorage.app',
  messagingSenderId: '800700379411',
  appId: '1:800700379411:web:dad5bd4d1356b4baf1eae6',
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
  const cleanCode = order.trackingCode.trim().toUpperCase();

  // 1. Coba lewat Firebase SDK
  if (dbInstance) {
    try {
      const orderRef = ref(dbInstance, `mapcourse/orders/${cleanCode}`);
      await set(orderRef, order);
      console.log(`[Firebase] Order ${cleanCode} tersinkronisasi via SDK!`);
      return true;
    } catch (err) {
      console.warn('[Firebase SDK] Sync notice:', err);
    }
  }

  // 2. Fallback via Firebase Realtime Database REST API
  try {
    const res = await fetch(`https://pemesanan-688f7-default-rtdb.asia-southeast1.firebasedatabase.app/mapcourse/orders/${cleanCode}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    if (res.ok) {
      console.log(`[Firebase REST] Order ${cleanCode} tersinkronisasi via REST!`);
      return true;
    }
  } catch (restErr) {
    console.warn('[Firebase REST] Sync notice:', restErr);
  }

  return false;
}

export async function fetchSingleOrderFromFirebase(trackingCode: string): Promise<OrderItem | null> {
  if (!trackingCode) return null;
  const cleanCode = trackingCode.trim().toUpperCase();

  // 1. Coba lewat Firebase SDK jika terhubung
  if (dbInstance) {
    try {
      const orderRef = ref(dbInstance, `mapcourse/orders/${cleanCode}`);
      const snapshot = await get(orderRef);
      if (snapshot.exists()) {
        return snapshot.val() as OrderItem;
      }
      
      const allRef = ref(dbInstance, 'mapcourse/orders');
      const allSnap = await get(allRef);
      if (allSnap.exists()) {
        const allData = allSnap.val();
        const found = Object.values(allData).find(
          (o: any) => o?.trackingCode?.toUpperCase() === cleanCode
        ) as OrderItem | undefined;
        if (found) return found;
      }
    } catch (err) {
      console.warn('[Firebase SDK] Fetch single order notice:', err);
    }
  }

  // 2. Fallback lewat Firebase REST API
  try {
    const res = await fetch(`https://pemesanan-688f7-default-rtdb.asia-southeast1.firebasedatabase.app/mapcourse/orders/${cleanCode}.json`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.trackingCode) {
        return data as OrderItem;
      }
    }
  } catch (restErr) {
    console.warn('[Firebase REST] Fetch order notice:', restErr);
  }

  return null;
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
  if (!authInstance) {
    initFirebaseService();
  }

  if (authInstance) {
    try {
      const userCredential = await signInWithEmailAndPassword(authInstance, email.trim(), password);
      const user = userCredential.user;
      return {
        name: user.displayName || user.email?.split('@')[0] || 'Staf MAP COURSE',
        role: 'Tim Pemetaan GIS & RTB',
        email: user.email || email.trim(),
      };
    } catch (authErr: any) {
      console.warn('[Firebase Auth] Login error:', authErr);
      const code = authErr?.code;
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        throw new Error('Kata sandi salah. Silakan periksa kembali kata sandi akun Firebase Anda.');
      }
      if (code === 'auth/user-not-found') {
        throw new Error('Email tidak terdaftar di Firebase Authenticator.');
      }
      if (code === 'auth/invalid-email') {
        throw new Error('Format email tidak valid.');
      }
      if (code === 'auth/too-many-requests') {
        throw new Error('Terlalu banyak percobaan gagal. Silakan tunggu beberapa saat.');
      }
      throw new Error(authErr?.message || 'Gagal masuk dengan Firebase Authenticator.');
    }
  }

  // Fallback cadangan darurat jika jaringan offline
  if (email.trim() === 'admin@mapcourse.id' && password === 'admin123') {
    return {
      name: 'Tim GIS MAP COURSE (Admin)',
      role: 'Head of GIS & Specialist RTB',
      email: 'admin@mapcourse.id',
    };
  }

  throw new Error('Layanan Firebase Authenticator belum terhubung.');
}

export async function logoutStaffWithFirebase(): Promise<void> {
  if (!authInstance) {
    initFirebaseService();
  }
  if (authInstance) {
    try {
      await signOut(authInstance);
    } catch (e) {
      console.warn('[Firebase Auth] Signout notice:', e);
    }
  }
}

export function onStaffAuthStateChanged(callback: (user: { name: string; role: string; email: string } | null) => void): () => void {
  if (!authInstance) {
    initFirebaseService();
  }
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
