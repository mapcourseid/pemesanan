import React, { useState } from 'react';
import { Lock, User, KeyRound, X, ShieldAlert } from 'lucide-react';
import { loginStaffWithFirebase } from '../services/firebase';

interface StaffLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: { name: string; role: string; email: string }) => void;
}

const STAFF_ERROR_MSG =
  'Dashboard ini hanya untuk staf Map Course Indonesia, hubungi admin help@mapcourseid.com';

export const StaffLoginModal: React.FC<StaffLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const user = await loginStaffWithFirebase(email.trim(), password);
      onLoginSuccess(user);
      onClose();
    } catch {
      setErrorMsg(STAFF_ERROR_MSG);
    } finally {
      setLoading(false);
    }
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
              Masuk dengan akun staf resmi Map Course Indonesia
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
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email akun staf"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#7d3feb] focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Kata sandi"
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
            <span>{loading ? 'Memverifikasi...' : 'Masuk'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
