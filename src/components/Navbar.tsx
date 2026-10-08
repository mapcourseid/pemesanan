import React from 'react';
import { 
  FileText, 
  CreditCard, 
  MapPin, 
  Layers,
  Lock,
  LogOut,
  MessageSquare,
} from 'lucide-react';
import { ADMIN_WHATSAPP_URL, ADMIN_WHATSAPP_NUMBER } from '../config/constants';

interface NavbarProps {
  activeTab: 'order' | 'payment' | 'tracking' | 'internal';
  setActiveTab: (tab: 'order' | 'payment' | 'tracking' | 'internal') => void;
  activeOrderCount?: number;
  isStaffLoggedIn: boolean;
  staffUser: { name: string; role: string; email: string } | null;
  onOpenStaffLogin: () => void;
  onStaffLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeOrderCount = 0,
  isStaffLoggedIn,
  staffUser,
  onOpenStaffLogin,
  onStaffLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Brand Logo with Image */}
          <div 
            onClick={() => setActiveTab('order')}
            className="flex items-center gap-2 sm:gap-3 cursor-pointer group"
          >
            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-white p-0.5 sm:p-1 border border-slate-200 shadow-md group-hover:scale-105 transition transform flex items-center justify-center overflow-hidden shrink-0">
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
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-black text-base sm:text-lg text-slate-900 tracking-tight whitespace-nowrap">MAP COURSE</span>
                <span className="bg-[#f6f1fd] text-[#7d3feb] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#decbf7] hidden md:inline-block">
                  GIS KKPR & RTB
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Layanan Pemetaan Polygon & Rencana Tapak Bangunan Resmi
              </p>
            </div>
          </div>

          {/* Customer Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-1.5">
            <button
              onClick={() => setActiveTab('order')}
              title="Formulir Pemesanan"
              aria-label="Pemesanan"
              className={`flex items-center justify-center p-2 sm:px-3 sm:py-2 rounded-xl transition ${
                activeTab === 'order'
                  ? 'bg-[#7d3feb] text-white shadow-md shadow-purple-500/25'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>

            <button
              onClick={() => setActiveTab('payment')}
              title="Pembayaran & Invoice"
              aria-label="Pembayaran"
              className={`flex items-center justify-center p-2 sm:px-3 sm:py-2 rounded-xl transition ${
                activeTab === 'payment'
                  ? 'bg-[#7d3feb] text-white shadow-md shadow-purple-500/25'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <CreditCard className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>

            <button
              onClick={() => setActiveTab('tracking')}
              title="Live Tracking Berkas"
              aria-label="Live Tracking"
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                activeTab === 'tracking'
                  ? 'bg-[#7d3feb] text-white shadow-md shadow-purple-500/25'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span className="hidden sm:inline">Tracking</span>
            </button>

            {/* Admin WhatsApp Link */}
            <a
              href={ADMIN_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              title={`Hubungi Admin WhatsApp (${ADMIN_WHATSAPP_NUMBER})`}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
            >
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span className="hidden md:inline">Admin WA</span>
            </a>

            {/* Separator */}
            <div className="h-5 w-px bg-slate-200 mx-0.5 sm:mx-1" />

            {/* Dedicated Staff Interface Buttons */}
            {isStaffLoggedIn ? (
              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  onClick={() => setActiveTab('internal')}
                  title="Dashboard Staf Internal"
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                    activeTab === 'internal'
                      ? 'bg-slate-900 text-white shadow-sm ring-2 ring-[#7d3feb]'
                      : 'bg-purple-100 text-[#7d3feb] hover:bg-purple-200'
                  }`}
                >
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span className="hidden sm:inline">Dashboard</span>
                  <span className="sm:hidden">Staf</span>
                  {activeOrderCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-[#7d3feb] animate-ping" />
                  )}
                </button>

                <button
                  onClick={onStaffLogout}
                  title="Keluar dari Akun Staf"
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenStaffLogin}
                title="Login Staf Internal"
                className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition border border-slate-700"
              >
                <Lock className="w-3.5 h-3.5 text-purple-300" />
                <span>Login</span>
              </button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};
