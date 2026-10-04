import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { OrderForm } from './components/OrderForm';
import { PaymentView } from './components/PaymentView';
import { TrackingView } from './components/TrackingView';
import { GisInternalDashboard } from './components/GisInternalDashboard';
import { StaffLoginModal } from './components/StaffLoginModal';
import type { OrderItem } from './types';
import { ShieldCheck, Flame, Lock } from 'lucide-react';
import { initFirebaseService, logoutStaffWithFirebase, onStaffAuthStateChanged } from './services/firebase';

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

  // Initialize Firebase & Auth listener
  useEffect(() => {
    const fbConnected = initFirebaseService();
    setIsFirebaseActive(fbConnected);

    const unsubscribeAuth = onStaffAuthStateChanged((user) => {
      if (user) {
        setIsStaffLoggedIn(true);
        setStaffUser(user);
      }
    });

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []);

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
