import React, { useState } from 'react';
import { Lock, User, KeyRound, X, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';

interface StaffLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: { name: string; role: string; email: string }) => void;
}

export const StaffLoginModal: React.FC<StaffLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('staf.gis@mapcourse.id');
  const [password, setPassword] = useState('gis123');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    // Simple demo validation
    setTimeout(() => {
      if (email.trim() && password.length >= 4) {
        onLoginSuccess({
          name: 'Hendra Wijaya, S.T.',
          role: 'Lead GIS Specialist & Drafter',
          email,
        });
        onClose();
      } else {
        setErrorMsg('Email atau password salah. Silakan coba kembali.');
      }
      setLoading(false);
    }, 400);
  };

  const handleQuickDemoLogin = () => {
    onLoginSuccess({
      name: 'Hendra Wijaya, S.T.',
      role: 'Lead GIS Specialist & Drafter',
      email: 'staf.gis@mapcourse.id',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        {/* Header with Logo */}
        <div className="bg-gradient-to-br from-[#7d3feb] via-[#6f2cdb] to-[#4e1e9c] text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-black/10 transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-white p-1.5 mx-auto shadow-lg shadow-purple-900/30 flex items-center justify-center">
              <img
                src="/logo.png"
                alt="MAP COURSE Logo"
                className="w-full h-full object-contain"
                onError={(e: any) => {
                  e.target.src = '/LOGO MAP COURSE PP (1).png';
                }}
              />
            </div>
            <h3 className="font-extrabold text-lg tracking-tight">Portal Khusus Tim Internal GIS</h3>
            <p className="text-xs text-purple-200">
              Masuk untuk mengelola antrean polygon, dokumen RTB, & validasi KKPR
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleLogin} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email / ID Karyawan Staf
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staf.gis@mapcourse.id"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#7d3feb] focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kata Sandi (Password)
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#7d3feb] focus:bg-white transition"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-[#7d3feb] hover:bg-[#6f2cdb] active:scale-[0.99] text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 transition"
          >
            <Lock className="w-4 h-4" />
            <span>{loading ? 'Memverifikasi...' : 'Masuk ke Dashboard Staf GIS'}</span>
          </button>

          {/* Quick Demo Button */}
          <div className="pt-2 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={handleQuickDemoLogin}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#7d3feb] hover:text-[#5e23be] font-bold rounded-lg hover:bg-purple-50 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>⚡ 1-Klik Masuk Demo (Akun Staf GIS Aktif)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
