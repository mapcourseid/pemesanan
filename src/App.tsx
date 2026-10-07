import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { OrderForm } from './components/OrderForm';
import { PaymentView } from './components/PaymentView';
import { TrackingView } from './components/TrackingView';
import { GisInternalDashboard } from './components/GisInternalDashboard';
import { StaffLoginModal } from './components/StaffLoginModal';
import type { OrderItem } from './types';
import { ShieldCheck, Flame, Lock } from 'lucide-react';
import { initFirebaseService, logoutStaffWithFirebase, onStaffAuthStateChanged, fetchSingleOrderFromFirebase, syncOrderToFirebase } from './services/firebase';
import { apiUrl, parseJsonResponse } from './utils/api';
import { fetchXenditInvoiceByCode } from './services/xenditClient';

export function App() {
  const [activeTab, setActiveTab] = useState<'order' | 'payment' | 'tracking' | 'internal'>('order');
  const [currentOrder, setCurrentOrder] = useState<OrderItem | null>(null);
  const [trackingCodeToView, setTrackingCodeToView] = useState<string>('');

  // Staff Authentication State
  const [isStaffLoggedIn, setIsStaffLoggedIn] = useState<boolean>(false);
  const [staffUser, setStaffUser] = useState<{ name: string; role: string; email: string } | null>(null);
  const [isStaffLoginOpen, setIsStaffLoginOpen] = useState<boolean>(false);

  // Firebase Realtime State
  const [isFirebaseActive, setIsFirebaseActive] = useState<boolean>(false);

  // Initialize Firebase & Auth listener + handle post-payment URL params
  useEffect(() => {
    const fbConnected = initFirebaseService();
    setIsFirebaseActive(fbConnected);

    const unsubscribeAuth = onStaffAuthStateChanged((user) => {
      if (user) {
        setIsStaffLoggedIn(true);
        setStaffUser(user);
      }
    });

    // Handle post-payment return from Xendit
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment') || params.get('payment_status');
    const tab = params.get('tab');
    const code = params.get('code');

    if ((paymentStatus === 'success' || tab === 'invoice') && code) {
      // Mark order as PAID and redirect to payment success / official invoice view
      handlePostPaymentReturn(code);
    } else if (tab === 'tracking' && code) {
      setTrackingCodeToView(code);
      setActiveTab('tracking');
    } else if (tab === 'payment' && code) {
      setTrackingCodeToView(code);
      setActiveTab('payment');
      loadOrderForPayment(code);
    }

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []);

  // Helper untuk membuat objek OrderItem dari data tagihan resmi Xendit
  const buildOrderFromXendit = (trackingCode: string, xenditInv: any): OrderItem => {
    return {
      id: `xnd_${xenditInv?.id || Date.now()}`,
      trackingCode: trackingCode,
      queueNumber: `#${trackingCode.slice(-2)}`,
      createdAt: xenditInv?.created || new Date().toISOString(),
      status: 'Verifikasi Berkas',
      paymentStatus: 'PAID',
      paidAt: xenditInv?.paid_at || new Date().toISOString(),
      paymentMethod: `Xendit (${xenditInv?.payment_channel || xenditInv?.payment_method || 'Virtual Account'})`,
      invoiceNumber: `INV/${new Date().getFullYear()}/${trackingCode}`,
      companyName: xenditInv?.customer?.given_names || 'Pelanggan MAP COURSE',
      contactName: xenditInv?.customer?.given_names || 'Pelanggan MAP COURSE',
      contactPhone: xenditInv?.customer?.mobile_number || '-',
      contactEmail: xenditInv?.customer?.email || xenditInv?.payer_email || 'help@mapcourseid.com',
      totalCost: xenditInv?.amount || 2000000,
      subtotalBeforeDiscount: xenditInv?.amount || 2000000,
      areaSizeM2: 5000,
      areaUnit: 'm2',
      landOwnershipStatus: 'Sudah Menguasai',
      streetAddress: 'Lokasi Pemetaan Resmi Pelanggan',
      province: 'Jawa Barat',
      city: 'Bandung',
      district: '-',
      village: '-',
      postalCode: '-',
      buildingCount: 1,
      buildingFloors: 1,
      buildingHeightMeters: 4,
      imbStatus: 'Dalam Proses',
      hasPolygon: false,
      kbliCode: '68111',
      kbliName: 'Real Estat yang Dimiliki Sendiri atau Disewa',
      isAbove3000m2: true,
      basePriceMultiplier: 1,
      discountAmount: 0,
      servicePackage: 'COMPLETE_RTB',
      xenditInvoiceUrl: xenditInv?.invoice_url,
      xenditInvoiceId: xenditInv?.id,
    };
  };

  // Load order data when navigating directly to payment tab with a code
  const loadOrderForPayment = async (trackingCode: string) => {
    let order: OrderItem | null = null;
    try {
      const stored: OrderItem[] = JSON.parse(localStorage.getItem('mapcourse_local_orders') || '[]');
      order = stored.find((o) => o.trackingCode === trackingCode) || null;
    } catch { /* ignore */ }

    if (!order) {
      try {
        order = await fetchSingleOrderFromFirebase(trackingCode);
      } catch { /* ignore */ }
    }

    // Selalu cek status terbaru langsung dari server Xendit
    try {
      const xenditInv = await fetchXenditInvoiceByCode(trackingCode);
      if (xenditInv) {
        if (!order) {
          order = buildOrderFromXendit(trackingCode, xenditInv);
        } else if (
          (xenditInv.status === 'SETTLED' || xenditInv.status === 'PAID') &&
          order.paymentStatus !== 'PAID'
        ) {
          order = {
            ...order,
            paymentStatus: 'PAID',
            status: order.status === 'Menunggu Pembayaran' ? 'Verifikasi Berkas' : order.status,
            paidAt: xenditInv.paid_at || new Date().toISOString(),
            paymentMethod: `Xendit (${xenditInv.payment_channel || xenditInv.payment_method || 'Virtual Account'})`,
            invoiceNumber: order.invoiceNumber || `INV/${new Date().getFullYear()}/${order.trackingCode}`,
          };

          // Simpan pembaruan status
          try {
            const stored: OrderItem[] = JSON.parse(localStorage.getItem('mapcourse_local_orders') || '[]');
            const idx = stored.findIndex((o) => o.trackingCode === trackingCode);
            if (idx !== -1) stored[idx] = order; else stored.unshift(order);
            localStorage.setItem('mapcourse_local_orders', JSON.stringify(stored));
            await syncOrderToFirebase(order);
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }

    if (order) {
      setCurrentOrder(order);
      setTrackingCodeToView(trackingCode);
    }
  };

  // Load order and mark as paid after Xendit redirect
  const handlePostPaymentReturn = async (trackingCode: string) => {
    let order: OrderItem | null = null;

    // 1. Coba ambil dari localStorage
    try {
      const stored: OrderItem[] = JSON.parse(localStorage.getItem('mapcourse_local_orders') || '[]');
      order = stored.find((o) => o.trackingCode === trackingCode) || null;
    } catch { /* ignore */ }

    // 2. Coba ambil dari Firebase
    if (!order) {
      try {
        order = await fetchSingleOrderFromFirebase(trackingCode);
      } catch { /* ignore */ }
    }

    // 3. Coba ambil langsung dari server Xendit (Paling Akurat jika baru saja bayar di gateway)
    if (!order) {
      try {
        const xenditInv = await fetchXenditInvoiceByCode(trackingCode);
        if (xenditInv) {
          order = buildOrderFromXendit(trackingCode, xenditInv);
        }
      } catch { /* ignore */ }
    }

    // 4. Jika masih belum ditemukan (fallback darurat), bentuk data pesanan berdasarkan kode
    if (!order) {
      order = buildOrderFromXendit(trackingCode, null);
    }

    // Buat pesanan berstatus LUNAS
    const paidOrder: OrderItem = {
      ...order,
      paymentStatus: 'PAID',
      status: 'Verifikasi Berkas',
      paidAt: order.paidAt || new Date().toISOString(),
      paymentMethod: order.paymentMethod || 'Xendit Gateway (Lunas Terverifikasi)',
    };

    // Simpan ke localStorage
    try {
      const stored: OrderItem[] = JSON.parse(localStorage.getItem('mapcourse_local_orders') || '[]');
      const idx = stored.findIndex((o) => o.trackingCode === trackingCode);
      if (idx !== -1) stored[idx] = paidOrder; else stored.unshift(paidOrder);
      localStorage.setItem('mapcourse_local_orders', JSON.stringify(stored));
    } catch { /* ignore */ }

    // Simpan ke Firebase
    try { await syncOrderToFirebase(paidOrder); } catch { /* ignore */ }

    setCurrentOrder(paidOrder);
    setTrackingCodeToView(trackingCode);
    setActiveTab('payment');

    // Bersihkan URL tanpa refresh halaman
    try {
      window.history.replaceState({}, '', window.location.pathname);
    } catch { /* ignore */ }
  };



  const handleOrderCreated = (order: OrderItem) => {
    setCurrentOrder(order);
    setTrackingCodeToView(order.trackingCode);
    setActiveTab('payment');
  };

  const handlePaymentSuccess = (updatedOrder: OrderItem) => {
    setCurrentOrder(updatedOrder);
    setTrackingCodeToView(updatedOrder.trackingCode);
  };

  const handleSelectOrderForTracking = (code: string) => {
    setTrackingCodeToView(code);
    setActiveTab('tracking');
  };

  // Staff Login Handler
  const handleStaffLoginSuccess = (user: { name: string; role: string; email: string }) => {
    setIsStaffLoggedIn(true);
    setStaffUser(user);
    setActiveTab('internal');
  };

  const handleStaffLogout = async () => {
    await logoutStaffWithFirebase();
    setIsStaffLoggedIn(false);
    setStaffUser(null);
    if (activeTab === 'internal') {
      setActiveTab('order');
    }
  };

  const handleTabChange = (tab: 'order' | 'payment' | 'tracking' | 'internal') => {
    if (tab === 'internal' && !isStaffLoggedIn) {
      setIsStaffLoginOpen(true);
      return;
    }
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Staff Login Modal */}
      <StaffLoginModal
        isOpen={isStaffLoginOpen}
        onClose={() => setIsStaffLoginOpen(false)}
        onLoginSuccess={handleStaffLoginSuccess}
      />

      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        activeOrderCount={0}
        isStaffLoggedIn={isStaffLoggedIn}
        staffUser={staffUser}
        onOpenStaffLogin={() => setIsStaffLoginOpen(true)}
        onStaffLogout={handleStaffLogout}
      />

      {/* Main Content View */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'order' && (
          <OrderForm
            onOrderCreated={handleOrderCreated}
          />
        )}

        {activeTab === 'payment' && (
          <PaymentView
            order={currentOrder}
            onPaymentSuccess={handlePaymentSuccess}
            onGoToTracking={(code) => {
              setTrackingCodeToView(code);
              setActiveTab('tracking');
            }}
          />
        )}

        {activeTab === 'tracking' && (
          <TrackingView initialTrackingCode={trackingCodeToView} />
        )}

        {activeTab === 'internal' && (
          isStaffLoggedIn ? (
            <GisInternalDashboard
              onSelectOrderForTracking={handleSelectOrderForTracking}
              staffUser={staffUser}
            />
          ) : (
            <div className="max-w-md mx-auto my-16 bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4 shadow-xl">
              <div className="w-14 h-14 rounded-2xl bg-purple-100 text-[#7d3feb] mx-auto flex items-center justify-center">
                <Lock className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Akses Khusus Staf Tim Internal GIS</h2>
              <p className="text-xs text-slate-500">
                Silakan masuk dengan akun staf GIS Anda untuk mengakses antrean pemetaan, pengunggahan deliverables, dan pengelolaan status.
              </p>
              <button
                onClick={() => setIsStaffLoginOpen(true)}
                className="w-full py-3 px-4 bg-[#7d3feb] hover:bg-[#6f2cdb] text-white font-bold rounded-2xl text-xs shadow-md transition"
              >
                Buka Formulir Login Staf
              </button>
            </div>
          )
        )}
      </main>

      {/* Professional Footer with Logo and #7d3feb theme */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white p-1 border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden">
              <img
                src="/logo.png"
                alt="MAP COURSE Logo"
                className="w-full h-full object-contain"
                onError={(e: any) => {
                  e.target.src = '/LOGO MAP COURSE PP (1).png';
                }}
              />
            </div>
            <div>
              <span className="font-bold text-slate-800 text-sm">MAP COURSE • Layanan Pemetaan KKPR &amp; RTB</span>
              <p className="text-[11px] text-slate-400">
                Standar Kementerian Agraria dan Tata Ruang / BPN RI &amp; Sistem OSS Terpadu.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1 text-[#7d3feb] font-bold">
              <ShieldCheck className="w-4 h-4" /> Topologi Terverifikasi ATR/BPN
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <Flame className="w-3.5 h-3.5" /> Firebase Realtime
            </span>
            <span>•</span>
            <span>Gateway Instant</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
