import React, { useState } from 'react';
import {
  FileCheck2,
  Printer,
  FileDown,
  MessageSquare,
  ArrowRight,
  Copy,
  Check,
  ShieldCheck,
  Building2,
  Calendar,
  CreditCard,
  QrCode,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { OrderItem } from '../types';
import { formatRupiah } from '../utils/pricing';
import { WhatsAppPreviewModal } from './WhatsAppPreviewModal';

interface GeneratedInvoiceViewProps {
  order: OrderItem;
  onGoToTracking: (trackingCode: string) => void;
}

export const GeneratedInvoiceView: React.FC<GeneratedInvoiceViewProps> = ({
  order,
  onGoToTracking,
}) => {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showWaModal, setShowWaModal] = useState(false);

  // Salin Kode Tracking ke Clipboard
  const handleCopyCode = () => {
    navigator.clipboard.writeText(order.trackingCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Unduh Berkas PDF Invoice Resmi
  const handleDownloadPdf = async () => {
    const el = document.getElementById('generated-official-invoice');
    if (!el) return;

    setIsDownloadingPdf(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Invoice_Resmi_${order.trackingCode}.pdf`);
    } catch (err) {
      console.warn('PDF capture notice, fallback ke dialog print:', err);
      window.print();
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const paymentDate = new Date(order.paidAt || order.createdAt || Date.now()).toLocaleDateString(
    'id-ID',
    {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  );

  const invoiceNumber = order.invoiceNumber || `INV/${new Date().getFullYear()}/${order.trackingCode}`;

  const waMessage = `Halo ${order.companyName || order.contactName},\n\nTerima kasih telah mempercayakan pemetaan kepada MAP COURSE. Pembayaran pesanan Anda telah resmi LUNAS dan terverifikasi.\n\n📌 *Nomor Invoice:* ${invoiceNumber}\n🔑 *Kode Tracking:* ${order.trackingCode}\n🔢 *Nomor Antrean:* ${order.queueNumber || '#08'}\n💰 *Total Pembayaran:* ${formatRupiah(order.totalCost)}\n\nLacak progres pengerjaan peta Anda secara berkala di: https://pemesanan-688f7.web.app/?tab=tracking&code=${order.trackingCode}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-fadeIn">
      {/* WhatsApp Modal */}
      <WhatsAppPreviewModal
        isOpen={showWaModal}
        onClose={() => setShowWaModal(false)}
        phone={order.contactPhone}
        recipientName={order.companyName || order.contactName}
        messageText={waMessage}
      />

      {/* Top Banner: Ringkasan Status & Tombol Aksi Cepat */}
      <div className="bg-gradient-to-r from-purple-900 via-[#7d3feb] to-indigo-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-purple-900/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/25 text-emerald-200 border border-emerald-400/30 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Pembayaran Berhasil Diverifikasi Sistem</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              E-Invoice Resmi Telah Terbit
            </h1>
            <p className="text-purple-200 text-xs sm:text-sm max-w-xl leading-relaxed">
              Tagihan telah resmi lunas. Berkas permohonan Anda kini masuk dalam antrean pengerjaan tim GIS &amp; Perencanaan Tata Ruang.
            </p>
          </div>

          {/* Quick Tracking Badge */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 min-w-[240px] space-y-2">
            <div className="text-[11px] text-purple-200 font-medium">Nomor Tracking Pelanggan:</div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-black text-lg tracking-wider text-white">
                {order.trackingCode}
              </span>
              <button
                onClick={handleCopyCode}
                title="Salin Kode Tracking"
                className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition active:scale-95"
              >
                {isCopied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="text-[11px] text-purple-200 flex items-center justify-between pt-1 border-t border-white/10">
              <span>Nomor Antrean:</span>
              <span className="font-bold text-amber-300">{order.queueNumber || '#08'}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-6 mt-6 border-t border-white/15">
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-purple-900 hover:bg-purple-50 font-bold text-xs rounded-xl shadow-md transition active:scale-95"
          >
            <FileDown className="w-4 h-4 text-purple-700" />
            <span>{isDownloadingPdf ? 'Menyiapkan PDF...' : 'Download PDF Invoice'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-800/60 hover:bg-purple-800 text-white font-bold text-xs rounded-xl border border-white/20 transition active:scale-95"
          >
            <Printer className="w-4 h-4 text-purple-200" />
            <span>Cetak Faktur</span>
          </button>

          <button
            onClick={() => setShowWaModal(true)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition active:scale-95"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Kirim Bukti WhatsApp</span>
          </button>

          <button
            onClick={() => onGoToTracking(order.trackingCode)}
            className="w-full sm:w-auto sm:ml-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-xs rounded-xl shadow-md transition active:scale-95"
          >
            <span>Lacak Status Pengerjaan</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lembar Invoice Ringkas, Bersih, dan Lengkap (Printable Card) */}
      <div
        id="generated-official-invoice"
        className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-xl space-y-8 font-sans text-slate-900"
      >
        {/* Header Invoice */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 border-b-2 border-slate-900">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white p-1 border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
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
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Layanan Pemetaan Polygon KKPR &amp; Rencana Tapak Bangunan (RTB) Resmi<br />
                Standar Kementerian Agraria dan Tata Ruang / BPN RI &amp; Sistem OSS
              </p>
            </div>
          </div>

          <div className="sm:text-right space-y-1.5 shrink-0">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              LUNAS / DIBAYAR
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-slate-900">
              {invoiceNumber}
            </div>
            <div className="text-xs text-slate-500 flex items-center sm:justify-end gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{paymentDate} WIB</span>
            </div>
          </div>
        </div>

        {/* 2-Kolom Informasi Pemohon & Transaksi */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs">
          {/* Kolom 1: Pemohon & Lokasi */}
          <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#7d3feb]" />
              <span>Diterbitkan Kepada:</span>
            </div>
            <div className="space-y-1">
              <div className="text-base font-black text-slate-900">{order.companyName}</div>
              <div className="text-slate-700 font-medium">
                PIC: <strong className="text-slate-900">{order.contactName}</strong> ({order.contactPhone})
              </div>
              <div className="text-slate-600">
                Email: {order.contactEmail || '-'}
              </div>
              <div className="text-slate-600 pt-1 border-t border-slate-200">
                {order.streetAddress}, {order.city}, {order.province}
              </div>
              <div className="text-slate-500 font-mono text-[11px]">
                KBLI: <strong>{order.kbliCode}</strong> - {order.kbliName}
              </div>
            </div>
          </div>

          {/* Kolom 2: Informasi Pembayaran & Antrean */}
          <div className="space-y-3 p-4 bg-[#fbf9fe] rounded-2xl border border-[#decbf7]">
            <div className="text-[11px] font-bold text-[#7d3feb] uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-[#7d3feb]" />
              <span>Rincian Pembayaran &amp; Antrean:</span>
            </div>
            <div className="space-y-1.5 text-slate-700">
              <div className="flex justify-between items-center">
                <span>Kode Tracking:</span>
                <span className="font-mono font-black text-sm text-slate-900">{order.trackingCode}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Nomor Antrean Kerja:</span>
                <span className="font-black text-base text-[#7d3feb]">{order.queueNumber || '#08'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Metode Bayar:</span>
                <span className="font-semibold text-slate-900">{order.paymentMethod || 'Xendit Gateway'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Status Verifikasi:</span>
                <span className="font-bold text-emerald-700">Terverifikasi Otomatis (Settled)</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-purple-100">
                <span>Kanal Gateway:</span>
                <span className="text-slate-500">Xendit Official Partner</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabel Rincian Layanan & Biaya */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b-2 border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                <th className="py-3 pr-4">Deskripsi Layanan &amp; Spesifikasi</th>
                <th className="py-3 px-3 text-center">Luas Area</th>
                <th className="py-3 px-3 text-center">Status Lahan</th>
                <th className="py-3 pl-4 text-right">Biaya (IDR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="py-4 pr-4">
                  <div className="font-black text-slate-900 text-sm">
                    Paket Lengkap: Pemetaan Polygon GIS KKPR + Dokumen Rencana Tapak Bangunan (RTB)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Standar validasi topologi Kementerian ATR/BPN RI. Termasuk berkas .SHP, .KML, .GeoJSON, serta dokumen buku RTB bertanda tangan digital.
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                    <Sparkles className="w-3 h-3" />
                    <span>Garansi Revisi Topologi hingga terbit Persetujuan KKPR OSS</span>
                  </div>
                </td>
                <td className="py-4 px-3 text-center font-bold text-slate-900">
                  {order.areaSizeM2.toLocaleString('id-ID')} m²
                </td>
                <td className="py-4 px-3 text-center">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium">
                    {order.landOwnershipStatus}
                  </span>
                </td>
                <td className="py-4 pl-4 text-right font-black text-slate-900 text-sm">
                  {formatRupiah(order.subtotalBeforeDiscount || order.totalCost)}
                </td>
              </tr>

              {/* Baris Diskon jika ada */}
              {order.discountAmount > 0 && (
                <tr className="text-emerald-700 bg-emerald-50/60 font-semibold">
                  <td colSpan={3} className="py-3 pr-4 font-bold">
                    Potongan Promo / Kupon ({order.discountCode || 'Voucher Diskon'}):
                  </td>
                  <td className="py-3 pl-4 text-right font-mono font-bold">
                    -{formatRupiah(order.discountAmount)}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-900 bg-slate-50/70">
                <td colSpan={3} className="py-4 px-4 font-black text-slate-900 text-sm">
                  Total Biaya Lunas Terbayar:
                </td>
                <td className="py-4 px-4 text-right font-black text-[#7d3feb] text-xl font-mono">
                  {formatRupiah(order.totalCost)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Panduan Tahap Pengerjaan Selanjutnya */}
        <div className="p-5 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-200 space-y-3">
          <div className="font-bold text-sm text-purple-900 flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-[#7d3feb]" />
            <span>Tahapan Selanjutnya untuk Pemohon:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-purple-900">
            <div className="p-3 bg-white/80 rounded-xl border border-purple-100 space-y-1">
              <div className="font-bold text-[#7d3feb]">1. Verifikasi Berkas</div>
              <p className="text-slate-600">Tim GIS memvalidasi data koordinat &amp; kepemilikan lahan.</p>
            </div>
            <div className="p-3 bg-white/80 rounded-xl border border-purple-100 space-y-1">
              <div className="font-bold text-[#7d3feb]">2. Olah Data &amp; Dokumen RTB</div>
              <p className="text-slate-600">Penyusunan polygon topologi dan gambar rencana tapak.</p>
            </div>
            <div className="p-3 bg-white/80 rounded-xl border border-purple-100 space-y-1">
              <div className="font-bold text-[#7d3feb]">3. Pengunduhan Hasil</div>
              <p className="text-slate-600">Unduh berkas final langsung di halaman Live Tracking.</p>
            </div>
          </div>
        </div>

        {/* Digital Signature & Footer Keabsahan */}
        <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 border-2 border-[#7d3feb] rounded-xl flex items-center justify-center p-1 bg-purple-50 text-center font-mono text-[8px] text-[#7d3feb] font-black leading-tight shrink-0">
              MAP COURSE<br />AUTHENTIC<br />VERIFIED
            </div>
            <div className="space-y-0.5">
              <div className="font-bold text-slate-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Dokumen Bukti Transaksi Resmi Sah</span>
              </div>
              <div className="text-[11px] text-slate-500">
                Diterbitkan secara digital oleh MAP COURSE Gateway Engine. Sah sesuai ketentuan UU ITE.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onGoToTracking(order.trackingCode)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow transition"
            >
              <span>Lacak di Live Tracking</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
