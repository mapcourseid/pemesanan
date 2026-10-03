import React, { useState } from 'react';
import { 
  CreditCard, 
  QrCode, 
  Building, 
  Wallet, 
  CheckCircle2, 
  ArrowRight, 
  Copy, 
  Clock, 
  Sparkles, 
  Printer, 
  MessageSquare, 
  ShieldCheck,
  Tag,
  ExternalLink,
  Zap
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { OrderItem } from '../types';
import { formatRupiah } from '../utils/pricing';
import { apiUrl, parseJsonResponse } from '../utils/api';
import { WhatsAppPreviewModal } from './WhatsAppPreviewModal';

interface PaymentViewProps {
  order: OrderItem | null;
  onPaymentSuccess: (updatedOrder: OrderItem) => void;
  onGoToTracking: (trackingCode: string) => void;
}

export const PaymentView: React.FC<PaymentViewProps> = ({
  order,
  onPaymentSuccess,
  onGoToTracking,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'QRIS' | 'VA' | 'EWALLET'>('QRIS');
  const [selectedBank, setSelectedBank] = useState<'BCA' | 'MANDIRI' | 'BRI' | 'BNI'>('BCA');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showWaModal, setShowWaModal] = useState(false);
  const [isXenditLoading, setIsXenditLoading] = useState(false);
  const [xenditUrl, setXenditUrl] = useState<string | null>(order?.xenditInvoiceUrl || null);

  const handlePayWithXendit = async () => {
    if (!order) return;
    setIsXenditLoading(true);
    try {
      const res = await fetch(apiUrl('/api/payment/xendit/invoice'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingCode: order.trackingCode,
        }),
      });

      const data = await parseJsonResponse<{ invoiceUrl?: string }>(res, 'Gagal memanggil gateway Xendit');
      setXenditUrl(data.invoiceUrl || null);

      // Buka halaman pembayaran resmi Xendit di tab/jendela baru
      if (data.invoiceUrl) {
        window.open(data.invoiceUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      alert(`Xendit Payment: ${err.message}`);
    } finally {
      setIsXenditLoading(false);
    }
  };

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 text-center space-y-4 shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-[#f6f1fd] text-[#7d3feb] mx-auto flex items-center justify-center">
          <CreditCard className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Belum Ada Tagihan Aktif yang Dipilih</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Silakan lengkapi formulir pemesanan terlebih dahulu, atau gunakan simulasi uji untuk melihat simulasi pembayaran dan faktur resmi.
        </p>
      </div>
    );
  }

  const isPaid = order.paymentStatus === 'PAID';

  const handleSimulatePayment = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(apiUrl(`/api/orders/${order.trackingCode}/pay`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: selectedMethod === 'QRIS' ? 'QRIS Dynamic Instant' : `${selectedBank} Virtual Account`,
        }),
      });

      const data = await parseJsonResponse<{ order: OrderItem }>(res, 'Gagal memverifikasi pembayaran');

      confetti({
        particleCount: 110,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#7d3feb', '#a773eb', '#decbf7', '#22c55e', '#ffffff'],
      });

      onPaymentSuccess(data.order);
      setShowWaModal(true);
    } catch (err: any) {
      alert(`Gagal: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const waWelcomeMessage = `Terima kasih! Pembayaran Anda telah kami terima.\n\nNomor Antrean Pengerjaan Anda: ${order.queueNumber || '#08'}.\nNomor Invoice: ${order.invoiceNumber || 'INV/20261003/POL-014'}\nTotal Tagihan: ${formatRupiah(order.totalCost)}\n\nPantau progres pengerjaan Polygon & RTB Anda secara langsung di sini: https://tracking.domainanda.com/track/${order.trackingCode}`;

  const vaNumber = `88019${order.contactPhone.slice(-6).padStart(6, '0')}`;

  const handlePrintInvoice = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* WhatsApp Modal */}
      <WhatsAppPreviewModal
        isOpen={showWaModal}
        onClose={() => setShowWaModal(false)}
        phone={order.contactPhone}
        recipientName={order.companyName}
        messageText={waWelcomeMessage}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#7d3feb] bg-[#f6f1fd] px-2.5 py-0.5 rounded-full border border-[#decbf7]">
              Tahap 2: Pembayaran & Invoice Instant
            </span>
            <span className="text-xs font-mono text-slate-500">
              {order.trackingCode}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
            {isPaid ? 'Pembayaran Berhasil & E-Invoice Terbit' : 'Penyelesaian Pembayaran & Gateway'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {isPaid ? (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              LUNAS / DIBAYAR (Auto-Verified)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
              <Clock className="w-4 h-4 text-amber-600" />
              Menunggu Pembayaran
            </span>
          )}
        </div>
      </div>

      {!isPaid ? (
        /* PAYMENT GATEWAY INTERFACE */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Payment Method Selection */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#7d3feb]" />
                Pilih Kanal Pembayaran Instant (Midtrans / Xendit Sandbox)
              </h3>

              {/* Tabs */}
              <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 rounded-2xl">
                <button
                  onClick={() => setSelectedMethod('QRIS')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    selectedMethod === 'QRIS'
                      ? 'bg-white text-[#7d3feb] shadow-md shadow-purple-500/10'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <QrCode className="w-4 h-4 text-[#7d3feb]" />
                  <span>QRIS Instant</span>
                </button>
                <button
                  onClick={() => setSelectedMethod('VA')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    selectedMethod === 'VA'
                      ? 'bg-white text-[#7d3feb] shadow-md shadow-purple-500/10'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Building className="w-4 h-4 text-[#7d3feb]" />
                  <span>Virtual Account</span>
                </button>
                <button
                  onClick={() => setSelectedMethod('EWALLET')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    selectedMethod === 'EWALLET'
                      ? 'bg-white text-[#7d3feb] shadow-md shadow-purple-500/10'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Wallet className="w-4 h-4 text-[#7d3feb]" />
                  <span>E-Wallet</span>
                </button>
              </div>

              {/* Tab Contents */}
              {selectedMethod === 'QRIS' && (
                <div className="bg-purple-50/50 rounded-2xl p-6 border border-purple-100 text-center space-y-4">
                  <div className="inline-block p-4 bg-white rounded-3xl shadow-md border border-purple-200">
                    <div className="w-48 h-48 bg-white flex flex-col items-center justify-center border-4 border-slate-900 rounded-xl p-2 relative">
                      <div className="absolute top-1 text-[9px] font-black tracking-widest text-[#7d3feb]">MAP COURSE QRIS</div>
                      <div className="grid grid-cols-6 gap-1 w-36 h-36">
                        {Array.from({ length: 36 }).map((_, i) => (
                          <div
                            key={i}
                            className={`rounded-sm ${
                              (i % 2 === 0 || i % 5 === 0) ? 'bg-[#411a7f]' : 'bg-[#decbf7]'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="absolute bottom-1 text-[8px] font-bold text-slate-500">NMID: ID1029384756</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      Scan dengan BCA Mobile, Livin Mandiri, BRImo, GoPay, OVO, ShopeePay
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                      Sistem pembayaran terverifikasi otomatis dalam 1 detik tanpa bukti transfer fisik.
                    </p>
                  </div>
                </div>
              )}

              {selectedMethod === 'VA' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-2">
                    {(['BCA', 'MANDIRI', 'BRI', 'BNI'] as const).map((bank) => (
                      <button
                        key={bank}
                        onClick={() => setSelectedBank(bank)}
                        className={`p-3 rounded-2xl border text-xs font-bold text-center transition ${
                          selectedBank === bank
                            ? 'bg-[#f6f1fd] border-[#7d3feb] text-[#7d3feb] shadow-sm'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {bank} VA
                      </button>
                    ))}
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <span className="text-xs text-slate-500 font-medium">Nomor Virtual Account {selectedBank}:</span>
                    <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-300">
                      <span className="font-mono text-base font-bold text-slate-900 tracking-wider">
                        {vaNumber}
                      </span>
                      <button
                        onClick={() => copyToClipboard(vaNumber)}
                        className="text-xs text-[#7d3feb] hover:text-[#6f2cdb] font-bold inline-flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {isCopied ? 'Tersalin!' : 'Salin'}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Atas Nama: <strong>MAP COURSE - {order.companyName}</strong>
                    </p>
                  </div>
                </div>
              )}

              {selectedMethod === 'EWALLET' && (
                <div className="grid grid-cols-2 gap-3">
                  {['GoPay', 'OVO', 'ShopeePay', 'DANA'].map((wallet) => (
                    <div
                      key={wallet}
                      className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between"
                    >
                      <span className="font-bold text-xs text-slate-800">{wallet} Instant</span>
                      <span className="text-[10px] text-[#7d3feb] font-bold bg-[#f6f1fd] px-2 py-0.5 rounded-full border border-[#decbf7]">
                        Ready
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Button: Xendit Payment Gateway */}
              <div className="pt-2 space-y-3">
                <button
                  onClick={handlePayWithXendit}
                  disabled={isXenditLoading}
                  className="w-full py-4 px-4 bg-gradient-to-r from-[#002b49] via-[#005288] to-[#0070ba] hover:opacity-95 active:scale-[0.99] text-white font-extrabold rounded-2xl shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2.5 transition border border-sky-400/30"
                >
                  <CreditCard className="w-5 h-5 text-sky-300" />
                  <span className="text-sm">
                    {isXenditLoading ? 'Menyiapkan Checkout Xendit...' : 'Bayar via Xendit Payment Gateway ➔'}
                  </span>
                </button>

                <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Didukung oleh <strong>Xendit</strong> • QRIS, BCA/Mandiri/BRI VA, OVO, ShopeePay</span>
                </div>

                {xenditUrl && (
                  <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-between text-xs text-sky-900">
                    <span className="truncate pr-2">Invoice Xendit Anda telah dibuat</span>
                    <a
                      href={xenditUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold underline flex items-center gap-1 text-[#005288] flex-shrink-0"
                    >
                      Buka Pembayaran <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={handleSimulatePayment}
                    disabled={isProcessing}
                    className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Mode Tes Cepat: Konfirmasi Otomatis (Simulasi Lunas)</span>
                  </button>
                  <p className="text-[10px] text-center text-slate-400 mt-1.5">
                    * Verifikasi pembayaran akan mengubah status menjadi LUNAS dan menerbitkan E-Invoice resmi.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary with Discounts */}
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100">
                Ringkasan Tagihan
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Perusahaan:</span>
                  <span className="font-semibold text-slate-900 text-right">{order.companyName}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>KBLI:</span>
                  <span className="font-mono text-slate-900">{order.kbliCode}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Luas Lahan:</span>
                  <span className="font-semibold text-slate-900">
                    {order.areaSizeM2.toLocaleString('id-ID')} m²
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Paket:</span>
                  <span className="font-semibold text-[#7d3feb]">
                    Polygon + Dokumen RTB
                  </span>
                </div>
                {order.isAbove3000m2 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Skor Kesulitan (6 Faktor):</span>
                    <span className="font-mono font-bold text-[#7d3feb]">{order.difficultyScore?.toFixed(2)}</span>
                  </div>
                )}
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold pt-1 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5" /> Diskon ({order.discountCode || 'Promo'}):
                    </span>
                    <span className="font-mono">-{formatRupiah(order.discountAmount)}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-1">
                <div className="flex justify-between text-xs text-slate-500 font-medium">
                  <span>Total Tagihan Bersih:</span>
                </div>
                <div className="text-2xl font-black text-[#7d3feb]">
                  {formatRupiah(order.totalCost)}
                </div>
              </div>

              <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 text-[11px] text-purple-900 space-y-1">
                <div className="font-bold flex items-center gap-1 text-[#7d3feb]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Jaminan Transaksi Resmi MAP COURSE
                </div>
                <p>E-Invoice resmi PDF dan Nomor Antrean pengerjaan diterbitkan seketika setelah pembayaran sukses.</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* OFFICIAL E-INVOICE VIEW */
        <div className="space-y-6 animate-fadeIn">
          {/* Action Ribbon */}
          <div className="bg-[#f6f1fd] border border-[#decbf7] rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#7d3feb] text-white flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">
                  Pembayaran Terverifikasi Otomatis (Auto-Verified)
                </div>
                <div className="text-xs text-purple-700">
                  E-Invoice PDF dan Nomor Antrean telah dikirimkan ke WhatsApp customer ({order.contactPhone}).
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setShowWaModal(true)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#7d3feb] hover:bg-[#6f2cdb] text-white rounded-xl text-xs font-bold shadow transition"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Lihat Notifikasi WhatsApp</span>
              </button>

              <button
                onClick={() => onGoToTracking(order.trackingCode)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow transition"
              >
                <span>Live Tracking ({order.queueNumber || '#08'})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Printable E-Invoice Paper with Logo */}
          <div id="printable-invoice" className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-xl space-y-8 font-sans">
            {/* Invoice Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 border-b-2 border-slate-900">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white p-1 border border-slate-200 shadow flex items-center justify-center overflow-hidden">
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
                  <div className="text-2xl font-black tracking-tight text-slate-900">
                    MAP COURSE
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Badan Layanan Pemetaan Polygon KKPR & Rencana Tapak Bangunan OSS<br />
                    Standar Kementerian Agraria dan Tata Ruang / BPN RI
                  </p>
                </div>
              </div>

              <div className="sm:text-right">
                <span className="text-xs font-bold uppercase tracking-widest text-[#7d3feb] bg-[#f6f1fd] px-3 py-1 rounded-full border border-[#decbf7]">
                  LUNAS / PAID
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-2 font-mono">
                  {order.invoiceNumber || 'INV/20261003/POL-014'}
                </h2>
                <div className="text-xs text-slate-500 mt-0.5">
                  Tanggal: {new Date(order.paidAt || Date.now()).toLocaleDateString('id-ID', { dateStyle: 'long' })}
                </div>
              </div>
            </div>

            {/* Bill To & Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
              <div>
                <span className="text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                  Diterbitkan Untuk:
                </span>
                <div className="font-bold text-sm text-slate-900">{order.companyName}</div>
                <div className="text-slate-600 mt-0.5">PIC: {order.contactName} ({order.contactPhone})</div>
                <div className="text-slate-600">{order.streetAddress}, {order.city}, {order.province}</div>
                <div className="text-slate-500 font-mono mt-1">KBLI: {order.kbliCode} - {order.kbliName}</div>
              </div>

              <div className="sm:text-right space-y-1">
                <span className="text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                  Informasi Antrean & Gateway:
                </span>
                <div>Kode Tracking: <strong className="font-mono text-slate-900">{order.trackingCode}</strong></div>
                <div>Nomor Antrean Kerja: <strong className="text-[#7d3feb] text-sm font-bold">{order.queueNumber || '#08'}</strong></div>
                <div>Metode Bayar: <strong>{order.paymentMethod || 'QRIS Auto-Verified'}</strong></div>
                <div className="text-emerald-600 font-medium">Status: Terverifikasi Sistem Instant</div>
              </div>
            </div>

            {/* Table of Services */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="py-3">Deskripsi Layanan</th>
                    <th className="py-3 text-center">Spesifikasi Luas</th>
                    <th className="py-3 text-center">Skor Kesulitan</th>
                    <th className="py-3 text-right">Biaya</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr>
                    <td className="py-4">
                      <div className="font-bold text-slate-900">
                        Paket Lengkap: Pemetaan Polygon GIS KKPR + Dokumen Rencana Tapak Bangunan (RTB)
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Standar OSS ATR/BPN, validasi topologi, format .SHP, .KML, .GeoJSON, dan buku tapak bangunan PDF bertanda tangan digital.
                      </div>
                    </td>
                    <td className="py-4 text-center font-medium">
                      {order.areaSizeM2.toLocaleString('id-ID')} m²
                    </td>
                    <td className="py-4 text-center font-mono font-bold text-[#7d3feb]">
                      {order.isAbove3000m2 ? order.difficultyScore?.toFixed(2) : '1.00 (Standard)'}
                    </td>
                    <td className="py-4 text-right font-bold text-slate-900">
                      {formatRupiah(order.subtotalBeforeDiscount || order.totalCost)}
                    </td>
                  </tr>

                  {order.discountAmount > 0 && (
                    <tr className="text-emerald-700 bg-emerald-50/50">
                      <td colSpan={3} className="py-2.5 font-bold">
                        Potongan Kupon Promo ({order.discountCode || 'Voucher Diskon'}):
                      </td>
                      <td className="py-2.5 text-right font-bold font-mono">
                        -{formatRupiah(order.discountAmount)}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-900">
                    <td colSpan={3} className="pt-4 font-bold text-slate-900 text-sm">
                      Total Pembayaran Diterima (IDR):
                    </td>
                    <td className="pt-4 text-right font-black text-[#7d3feb] text-xl font-mono">
                      {formatRupiah(order.totalCost)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Digital Stamp & QR Verification */}
            <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-slate-500">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 border-2 border-[#7d3feb] rounded-xl flex items-center justify-center p-1 bg-purple-50 text-center font-mono text-[9px] text-[#7d3feb] font-bold leading-tight">
                  MAP COURSE VALIDATED
                </div>
                <div>
                  <div className="font-bold text-slate-800">Sertifikat Digital Transaksi Sah</div>
                  <div className="text-[11px]">Diterbitkan otomatis oleh MAP COURSE Gateway Engine. Bebas materai sesuai UU ITE.</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintInvoice}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak / Simpan PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
