import React, { useState, useEffect } from 'react';
import { 
  X, 
  QrCode, 
  Building2, 
  CreditCard, 
  Smartphone, 
  ShieldCheck, 
  CheckCircle2, 
  Copy, 
  Check, 
  Sparkles, 
  Clock, 
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import type { OrderItem } from '../types';

interface XenditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderItem;
  onPaymentSuccess: (method: string) => void;
  xenditWarning?: string | null;
}

export const XenditPaymentModal: React.FC<XenditPaymentModalProps> = ({
  isOpen,
  onClose,
  order,
  onPaymentSuccess,
  xenditWarning,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'qris' | 'va' | 'ewallet'>('qris');
  const [selectedBank, setSelectedBank] = useState<'bca' | 'mandiri' | 'bni' | 'bri'>('bca');
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [countdown, setCountdown] = useState(899); // 14:59

  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const formatCountdown = () => {
    const mins = Math.floor(countdown / 60);
    const secs = countdown % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Generate deterministic VA number based on tracking code
  const codeDigits = order.trackingCode.replace(/\D/g, '') || '829103';
  const vaPrefixes = {
    bca: '12890',
    mandiri: '88708',
    bni: '98801',
    bri: '10298',
  };
  const vaNumber = `${vaPrefixes[selectedBank]}${codeDigits.padEnd(8, '0').slice(0, 8)}`;

  const handleCopyVa = () => {
    navigator.clipboard.writeText(vaNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCompleteSimulation = (methodName: string) => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onPaymentSuccess(methodName);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header - Xendit Theme */}
        <div className="bg-gradient-to-r from-[#002b49] via-[#005288] to-[#0070ba] text-white p-5 sm:p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full border border-white/30">
              Xendit Checkout Gateway
            </span>
            <span className="text-[11px] text-sky-200 font-mono">
              {order.trackingCode}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black">
            Penyelesaian Pembayaran Tagihan
          </h2>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-xs text-sky-200">Total Pembayaran:</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-300">
              Rp {order.totalCost.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-sky-200">
            <Clock className="w-3.5 h-3.5 text-amber-300" />
            <span>Batas waktu pembayaran: <strong className="text-white font-mono">{formatCountdown()}</strong></span>
          </div>
        </div>

        {/* Notice Info if Simulation */}
        <div className="bg-sky-50 border-b border-sky-100 px-5 py-2.5 flex items-center justify-between text-xs text-sky-900">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
            <span className="text-[11px]">
              Tampilan resmi <strong>Xendit Payment Simulator</strong> (Pengujian Pembayaran Otomatis).
            </span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-sky-200/70 text-sky-800 rounded-full">
            Test Mode
          </span>
        </div>

        {xenditWarning && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-2 text-[11px] text-amber-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Catatan Kunci Xendit:</strong> {xenditWarning}
            </div>
          </div>
        )}

        {/* Method Selector Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-600">
          <button
            onClick={() => setSelectedMethod('qris')}
            className={`flex-1 py-3 px-3 flex items-center justify-center gap-2 border-b-2 transition ${
              selectedMethod === 'qris'
                ? 'border-[#005288] text-[#005288] bg-white'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>QRIS (Instan)</span>
          </button>

          <button
            onClick={() => setSelectedMethod('va')}
            className={`flex-1 py-3 px-3 flex items-center justify-center gap-2 border-b-2 transition ${
              selectedMethod === 'va'
                ? 'border-[#005288] text-[#005288] bg-white'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Virtual Account</span>
          </button>

          <button
            onClick={() => setSelectedMethod('ewallet')}
            className={`flex-1 py-3 px-3 flex items-center justify-center gap-2 border-b-2 transition ${
              selectedMethod === 'ewallet'
                ? 'border-[#005288] text-[#005288] bg-white'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>E-Wallet</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: QRIS */}
          {selectedMethod === 'qris' && (
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col items-center">
                <div className="w-48 h-48 bg-white p-3 rounded-xl border border-slate-300 shadow-sm flex flex-col items-center justify-center relative">
                  {/* Decorative QR code pattern */}
                  <svg className="w-40 h-40" viewBox="0 0 100 100" fill="currentColor">
                    {/* Corner 1 */}
                    <rect x="5" y="5" width="28" height="28" rx="4" fill="#002b49" />
                    <rect x="9" y="9" width="20" height="20" rx="2" fill="#fff" />
                    <rect x="13" y="13" width="12" height="12" rx="1" fill="#002b49" />
                    {/* Corner 2 */}
                    <rect x="67" y="5" width="28" height="28" rx="4" fill="#002b49" />
                    <rect x="71" y="9" width="20" height="20" rx="2" fill="#fff" />
                    <rect x="75" y="13" width="12" height="12" rx="1" fill="#002b49" />
                    {/* Corner 3 */}
                    <rect x="5" y="67" width="28" height="28" rx="4" fill="#002b49" />
                    <rect x="9" y="71" width="20" height="20" rx="2" fill="#fff" />
                    <rect x="13" y="75" width="12" height="12" rx="1" fill="#002b49" />
                    {/* Grid Pattern Dots */}
                    <rect x="38" y="10" width="8" height="8" fill="#005288" />
                    <rect x="50" y="10" width="8" height="8" fill="#002b49" />
                    <rect x="38" y="24" width="8" height="8" fill="#002b49" />
                    <rect x="50" y="24" width="8" height="8" fill="#005288" />
                    <rect x="10" y="38" width="8" height="8" fill="#005288" />
                    <rect x="24" y="38" width="8" height="8" fill="#002b49" />
                    <rect x="38" y="38" width="8" height="8" fill="#7d3feb" />
                    <rect x="52" y="38" width="8" height="8" fill="#002b49" />
                    <rect x="66" y="38" width="8" height="8" fill="#005288" />
                    <rect x="80" y="38" width="8" height="8" fill="#002b49" />
                    <rect x="38" y="52" width="8" height="8" fill="#002b49" />
                    <rect x="52" y="52" width="8" height="8" fill="#7d3feb" />
                    <rect x="66" y="52" width="8" height="8" fill="#002b49" />
                    <rect x="80" y="52" width="8" height="8" fill="#005288" />
                    <rect x="38" y="66" width="8" height="8" fill="#005288" />
                    <rect x="52" y="66" width="8" height="8" fill="#002b49" />
                    <rect x="66" y="66" width="8" height="8" fill="#005288" />
                    <rect x="80" y="66" width="8" height="8" fill="#002b49" />
                    <rect x="38" y="80" width="8" height="8" fill="#002b49" />
                    <rect x="52" y="80" width="8" height="8" fill="#005288" />
                    <rect x="66" y="80" width="8" height="8" fill="#002b49" />
                    <rect x="80" y="80" width="8" height="8" fill="#005288" />
                  </svg>
                  <span className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">
                    QRIS Standar BI
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
                  {['BCA', 'Mandiri', 'GoPay', 'OVO', 'Dana', 'ShopeePay'].map((app) => (
                    <span key={app} className="text-[10px] px-2 py-0.5 bg-white border border-slate-200 rounded font-semibold text-slate-700">
                      {app}
                    </span>
                  ))}
                </div>
              </div>

              <div className="text-xs text-slate-600 max-w-sm space-y-1">
                <p className="font-semibold text-slate-800">Petunjuk Pembayaran QRIS:</p>
                <p>1. Buka aplikasi m-Banking atau E-Wallet pilihan Anda.</p>
                <p>2. Pilih menu <strong>Scan / Bayar QRIS</strong>.</p>
                <p>3. Arahkan kamera ke kode QR di atas dan konfirmasi pembayaran sebesar <strong>Rp {order.totalCost.toLocaleString('id-ID')}</strong>.</p>
              </div>

              <button
                type="button"
                onClick={() => handleCompleteSimulation('QRIS Xendit')}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-900/10 flex items-center justify-center gap-2 transition"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{isProcessing ? 'Memverifikasi Pembayaran...' : 'Konfirmasi Pembayaran QRIS Selesai'}</span>
              </button>
            </div>
          )}

          {/* TAB 2: VIRTUAL ACCOUNT */}
          {selectedMethod === 'va' && (
            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-700">
                Pilih Bank Virtual Account:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'bca', label: 'BCA VA' },
                  { id: 'mandiri', label: 'Mandiri VA' },
                  { id: 'bni', label: 'BNI VA' },
                  { id: 'bri', label: 'BRI VA' },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBank(b.id as any)}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition ${
                      selectedBank === b.id
                        ? 'border-[#005288] bg-sky-50 text-[#005288]'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <span className="text-[11px] text-slate-500 font-semibold block uppercase tracking-wider">
                  Nomor Virtual Account ({selectedBank.toUpperCase()}):
                </span>
                <div className="flex items-center justify-between gap-2 bg-white p-3 rounded-xl border border-slate-200">
                  <span className="font-mono text-lg font-black text-slate-900 tracking-wider">
                    {vaNumber}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyVa}
                    className="flex items-center gap-1 text-xs font-bold text-[#005288] hover:text-[#002b49] px-2.5 py-1 bg-sky-50 hover:bg-sky-100 rounded-lg transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
                <div className="flex justify-between text-xs text-slate-600 pt-1">
                  <span>Nama Akun:</span>
                  <span className="font-bold text-slate-800">MAP COURSE / {order.companyName}</span>
                </div>
              </div>

              <div className="text-xs text-slate-600 space-y-1.5 p-3.5 bg-amber-50/60 rounded-xl border border-amber-200/60">
                <p className="font-bold text-amber-900">Petunjuk Transfer m-Banking:</p>
                <ol className="list-decimal list-inside space-y-1 text-amber-800 text-[11px]">
                  <li>Buka aplikasi m-Banking {selectedBank.toUpperCase()} Anda.</li>
                  <li>Pilih menu <strong>Transfer</strong> &gt; <strong>Virtual Account</strong>.</li>
                  <li>Masukkan nomor VA di atas: <strong>{vaNumber}</strong>.</li>
                  <li>Pastikan nominal tagihan sesuai (Rp {order.totalCost.toLocaleString('id-ID')}).</li>
                </ol>
              </div>

              <button
                type="button"
                onClick={() => handleCompleteSimulation(`Virtual Account ${selectedBank.toUpperCase()}`)}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 bg-[#005288] hover:bg-[#002b49] text-white font-extrabold rounded-2xl shadow-lg flex items-center justify-center gap-2 transition"
              >
                <CheckCircle2 className="w-5 h-5 text-sky-300" />
                <span>{isProcessing ? 'Memverifikasi Pembayaran...' : `Konfirmasi Transfer ${selectedBank.toUpperCase()} Selesai`}</span>
              </button>
            </div>
          )}

          {/* TAB 3: E-WALLET */}
          {selectedMethod === 'ewallet' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Nomor Ponsel Akun E-Wallet (OVO / DANA / ShopeePay):
                </label>
                <input
                  type="text"
                  defaultValue={order.contactPhone}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#005288] outline-none"
                  placeholder="0812xxxxxxxx"
                />
                <p className="text-[11px] text-slate-500">
                  Notifikasi konfirmasi pembayaran akan dikirimkan langsung ke aplikasi E-Wallet Anda.
                </p>
              </div>

              <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl text-xs text-sky-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-sky-600" />
                  <span>Push Notification E-Wallet Siap</span>
                </div>
                <p className="text-[11px] text-sky-800 leading-relaxed">
                  Setelah menekan tombol di bawah, aplikasi E-Wallet Anda akan membuka konfirmasi pembayaran instan.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleCompleteSimulation('E-Wallet Xendit')}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl shadow-lg flex items-center justify-center gap-2 transition"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{isProcessing ? 'Memverifikasi Pembayaran...' : 'Bayar Sekarang via E-Wallet'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-200 px-5 py-3 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>Xendit Payment Gateway System</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-600 hover:text-slate-900 font-bold"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
};
