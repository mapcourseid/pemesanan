import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  ArrowRight,
  Clock,
  Printer,
  MessageSquare,
  ShieldCheck,
  FileDown,
  Copy,
  Check,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Building2,
  AlertCircle,
  Eye,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { OrderItem } from '../types';
import { formatRupiah } from '../utils/pricing';
import { apiUrl, parseJsonResponse } from '../utils/api';
import { syncOrderToFirebase, fetchSingleOrderFromFirebase } from '../services/firebase';
import { WhatsAppPreviewModal } from './WhatsAppPreviewModal';
import { ADMIN_WHATSAPP_NUMBER, ADMIN_WHATSAPP_URL } from '../config/constants';

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
  const [showWaModal, setShowWaModal] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Copy States
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(order?.paymentProofUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Modal Preview Bukti Pembayaran
  const [showProofPreviewModal, setShowProofPreviewModal] = useState(false);

  // Active Order State (bisa diupdate secara lokal saat bukti terunggah atau saat staf memverifikasi)
  const [currentOrder, setCurrentOrder] = useState<OrderItem | null>(order);

  useEffect(() => {
    if (order) {
      setCurrentOrder(order);
      if (order.paymentProofUrl) {
        setFilePreview(order.paymentProofUrl);
      }
    }
  }, [order]);

  // Real-time Auto-Detection: Pantau status verifikasi staf di Firebase & backend setiap 3 detik
  useEffect(() => {
    if (!currentOrder || currentOrder.paymentStatus === 'PAID') return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        // Coba periksa Firebase
        const fbOrder = await fetchSingleOrderFromFirebase(currentOrder.trackingCode);
        if (fbOrder && fbOrder.paymentStatus === 'PAID') {
          if (!isMounted) return;
          clearInterval(interval);
          setCurrentOrder(fbOrder);
          onPaymentSuccess(fbOrder);
          confetti({
            particleCount: 120,
            spread: 70,
            origin: { y: 0.6 },
          });
          return;
        }

        // Coba periksa server backend jika ada
        const res = await fetch(apiUrl(`/api/orders/${currentOrder.trackingCode}`));
        if (res.ok) {
          const srvOrder: OrderItem = await res.json();
          if (srvOrder && srvOrder.paymentStatus === 'PAID') {
            if (!isMounted) return;
            clearInterval(interval);
            setCurrentOrder(srvOrder);
            onPaymentSuccess(srvOrder);
            confetti({
              particleCount: 120,
              spread: 70,
              origin: { y: 0.6 },
            });
          }
        }
      } catch {
        // Silently ignore background polling errors
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentOrder?.trackingCode, currentOrder?.paymentStatus, onPaymentSuccess]);

  if (!currentOrder) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-purple-50 text-[#7d3feb] mx-auto flex items-center justify-center">
          <Clock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Menunggu Data Pesanan</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Belum ada pesanan yang dipilih untuk pembayaran. Silakan lakukan pemesanan terlebih dahulu atau gunakan fitur lacak.
        </p>
      </div>
    );
  }

  const isPaid = currentOrder.paymentStatus === 'PAID';

  // Copy Helpers
  const handleCopy = (text: string, type: 'account' | 'amount' | 'code') => {
    navigator.clipboard.writeText(text);
    if (type === 'account') {
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2000);
    } else if (type === 'amount') {
      setCopiedAmount(true);
      setTimeout(() => setCopiedAmount(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  // Handle Pilih Berkas Bukti Pembayaran
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Ukuran file maksimal 10MB! Silakan pilih file yang lebih kecil.');
      return;
    }

    setUploadError(null);
    setSelectedFile(file);

    // Pratinjau gambar instan
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  // Handle Unggah Bukti Pembayaran
  const handleUploadProof = async () => {
    if (!selectedFile && !filePreview) {
      setUploadError('Silakan pilih berkas bukti transfer terlebih dahulu.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccessMessage(null);

    try {
      let proofUrl = currentOrder.paymentProofUrl || '';
      const proofName = selectedFile ? selectedFile.name : (currentOrder.paymentProofName || 'Bukti_Transfer_BNI.jpg');

      // 1. Simpan Base64 Data URL jika ada file baru yang dipilih
      if (selectedFile) {
        const base64Promise = new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(selectedFile);
        });

        proofUrl = await base64Promise;
      }

      // 2. Coba kirim juga ke backend server jika endpoint tersedia
      try {
        await fetch(apiUrl(`/api/orders/${currentOrder.trackingCode}/payment-proof`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentProofUrl: proofUrl,
            paymentProofName: proofName,
          }),
        });
      } catch (srvErr) {
        console.warn('Backend server notification notice:', srvErr);
      }

      // 3. Update objek order
      const updatedOrder: OrderItem = {
        ...currentOrder,
        paymentProofUrl: proofUrl,
        paymentProofName: proofName,
        paymentProofUploadedAt: new Date().toISOString(),
        paymentProofStatus: 'WAITING_VERIFICATION',
      };

      // 4. Simpan ke LocalStorage
      try {
        const stored: OrderItem[] = JSON.parse(localStorage.getItem('mapcourse_local_orders') || '[]');
        const idx = stored.findIndex((o) => o.trackingCode === currentOrder.trackingCode);
        if (idx !== -1) stored[idx] = updatedOrder; else stored.unshift(updatedOrder);
        localStorage.setItem('mapcourse_local_orders', JSON.stringify(stored));
      } catch { /* ignore */ }

      // 5. Sinkronkan ke Firebase Realtime Database
      try {
        await syncOrderToFirebase(updatedOrder);
      } catch { /* ignore */ }

      setCurrentOrder(updatedOrder);
      setSelectedFile(null);
      setFilePreview(proofUrl);
      setUploadSuccessMessage('Bukti pembayaran berhasil diunggah! Berkas telah masuk ke dashboard staf untuk diverifikasi.');
    } catch (err: any) {
      console.error('Error uploading payment proof:', err);
      setUploadError('Terjadi kendala saat menyimpan bukti pembayaran. Silakan coba kembali.');
    } finally {
      setIsUploading(false);
    }
  };

  // Unduh E-Invoice PDF Resmi saat sudah LUNAS
  const handleDownloadPdfReceipt = async () => {
    if (!currentOrder) return;
    setIsDownloadingPdf(true);
    const el = document.getElementById('printable-invoice');
    if (!el) {
      window.print();
      setIsDownloadingPdf(false);
      return;
    }
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 20) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Invoice_Resmi_${currentOrder.trackingCode}.pdf`);
    } catch (e) {
      console.warn('PDF generation notice, falling back to print:', e);
      window.print();
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handlePrintInvoice = () => {
    window.print();
  };

  // Format Pesan WhatsApp Konfirmasi
  const waConfirmMessage = `Halo Admin MAP COURSE,\n\nSaya telah melakukan transfer pembayaran untuk pesanan pemetaan:\n📌 *Kode Tracking:* ${currentOrder.trackingCode}\n🏢 *Perusahaan:* ${currentOrder.companyName}\n👤 *PIC:* ${currentOrder.contactName} (${currentOrder.contactPhone})\n💰 *Nominal:* ${formatRupiah(currentOrder.totalCost)}\n🏦 *Tujuan:* BNI 178-619-5190 an PT Map Course Indonesia\n\nBukti transfer telah saya unggah ke sistem. Mohon bantuannya untuk verifikasi pembayaran. Terima kasih!`;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* WhatsApp Modal */}
      <WhatsAppPreviewModal
        isOpen={showWaModal}
        onClose={() => setShowWaModal(false)}
        phone={ADMIN_WHATSAPP_NUMBER}
        recipientName="Admin MAP COURSE"
        messageText={waConfirmMessage}
        title="Konfirmasi Pembayaran via WhatsApp Admin"
      />

      {/* Modal Preview Bukti Pembayaran */}
      {showProofPreviewModal && (filePreview || currentOrder.paymentProofUrl) && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[#7d3feb]" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Pratinjau Bukti Pembayaran ({currentOrder.paymentProofName || 'Bukti Transfer'})
                </h3>
              </div>
              <button
                onClick={() => setShowProofPreviewModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto rounded-2xl bg-slate-50 p-2 flex items-center justify-center border border-slate-200">
              {(filePreview || currentOrder.paymentProofUrl)?.startsWith('data:image') ||
              (filePreview || currentOrder.paymentProofUrl)?.match(/\.(jpeg|jpg|gif|png|webp)/i) ? (
                <img
                  src={filePreview || currentOrder.paymentProofUrl}
                  alt="Bukti Transfer"
                  className="max-h-[60vh] w-auto object-contain rounded-xl shadow-sm"
                />
              ) : (
                <div className="p-12 text-center space-y-3">
                  <FileText className="w-12 h-12 text-[#7d3feb] mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">Berkas Bukti Transfer Dokumen / PDF</p>
                  <a
                    href={filePreview || currentOrder.paymentProofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#7d3feb] text-white text-xs font-bold rounded-xl shadow"
                  >
                    <span>Buka / Unduh Berkas</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowProofPreviewModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#7d3feb] bg-[#f6f1fd] px-2.5 py-0.5 rounded-full border border-[#decbf7]">
              Tahap 2: Pembayaran &amp; Konfirmasi Transfer
            </span>
            <span className="text-xs font-mono text-slate-500">
              {currentOrder.trackingCode}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
            {isPaid ? 'Rangkuman Invoice Resmi • Pembayaran Lunas' : 'Instruksi Pembayaran Transfer Bank BNI'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {isPaid ? (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              LUNAS / DIVERIFIKASI
            </span>
          ) : currentOrder.paymentProofUrl ? (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-300">
              <Clock className="w-4 h-4 text-sky-600" />
              Bukti Terkirim • Menunggu Verifikasi Staf
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
        /* ================= INTRUKSI TRANSFER BNI & UPLOAD BUKTI ================= */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Rekening BNI & Slot Upload Bukti (2 cols) */}
          <div className="md:col-span-2 space-y-6">
            {/* Rekening BNI Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center font-black text-orange-600 text-lg shadow-sm">
                    BNI
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Transfer Bank Negara Indonesia (BNI)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Rekening Resmi Operasional Pemetaan
                    </p>
                  </div>
                </div>

                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold rounded-full">
                  Rekening Terverifikasi
                </span>
              </div>

              {/* Teks Instruksi Sesuai Permintaan User */}
              <div className="p-4 bg-orange-50/70 border border-orange-200/80 rounded-2xl">
                <p className="text-xs sm:text-sm font-semibold text-orange-950 leading-relaxed">
                  Silahkan lakukan pembayaran ke <strong className="font-bold underline decoration-orange-400">BNI 178-619-5190</strong> an <strong className="font-bold">PT Map Course Indonesia</strong>
                </p>
              </div>

              {/* Detail Kotak Transfer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nomor Rekening */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1 relative">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Nomor Rekening Tujuan
                  </span>
                  <div className="text-lg font-black font-mono text-slate-900 tracking-wider">
                    178-619-5190
                  </div>
                  <div className="text-xs text-slate-600 font-medium">
                    Bank BNI
                  </div>
                  <button
                    onClick={() => handleCopy('1786195190', 'account')}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-sm transition"
                  >
                    {copiedAccount ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin No. Rekening</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Atas Nama Rekening */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Atas Nama Rekening
                  </span>
                  <div className="text-base font-black text-slate-900 pt-1">
                    PT Map Course Indonesia
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Pastikan nama penerima transfer tepat sesuai rekening resmi di atas.
                  </p>
                </div>
              </div>

              {/* Jumlah Nominal Transfer */}
              <div className="p-5 bg-purple-50/70 border border-purple-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wider block">
                    Total Nominal Transfer Bersih
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-[#7d3feb] font-mono tracking-tight mt-0.5">
                    {formatRupiah(currentOrder.totalCost)}
                  </div>
                  <span className="text-[11px] text-purple-700">
                    * Tidak ada biaya admin tambahan
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(String(currentOrder.totalCost), 'amount')}
                    className="px-3.5 py-2 bg-white hover:bg-purple-100/60 text-[#7d3feb] text-xs font-bold rounded-xl border border-purple-300 shadow-sm transition flex items-center gap-1.5"
                  >
                    {copiedAmount ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Nominal</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Catatan Berita Transfer */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-slate-700">Berita / Catatan Transfer:</span>{' '}
                  <span className="font-mono font-bold text-slate-900">{currentOrder.trackingCode}</span>
                </div>
                <button
                  onClick={() => handleCopy(currentOrder.trackingCode, 'code')}
                  className="text-xs font-bold text-[#7d3feb] hover:underline flex items-center gap-1"
                >
                  {copiedCode ? 'Tersalin' : 'Salin Kode'}
                </button>
              </div>
            </div>

            {/* SLOT UPLOAD BUKTI PEMBAYARAN */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-purple-100 text-[#7d3feb] flex items-center justify-center font-bold">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Slot Unggah Bukti Pembayaran
                    </h3>
                    <p className="text-xs text-slate-500">
                      Bukti pembayaran akan otomatis masuk ke dashboard tim staf
                    </p>
                  </div>
                </div>

                {currentOrder.paymentProofUrl && (
                  <span className="px-3 py-1 bg-sky-50 text-sky-700 border border-sky-200 text-[11px] font-bold rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                    Sudah Diunggah
                  </span>
                )}
              </div>

              {/* Notifikasi Upload Sukses / Error */}
              {uploadSuccessMessage && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-start gap-2.5 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">{uploadSuccessMessage}</span>
                    <span className="text-[11px] text-emerald-700">
                      Tim staf kami segera memverifikasi transaksi Anda. Anda dapat mengecek status secara berkala.
                    </span>
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Status Bukti yang Sudah Ada */}
              {currentOrder.paymentProofUrl && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 text-[#7d3feb] flex items-center justify-center">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-xs truncate max-w-[200px] sm:max-w-xs">
                          {currentOrder.paymentProofName || 'Bukti_Transfer_BNI.jpg'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Diunggah pada: {new Date(currentOrder.paymentProofUploadedAt || Date.now()).toLocaleString('id-ID')}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowProofPreviewModal(true)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-sm transition flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#7d3feb]" />
                      <span>Lihat Bukti</span>
                    </button>
                  </div>
                </div>
              )}

              {/* File Input Upload Box */}
              <div className="space-y-4">
                <label className="block border-2 border-dashed border-purple-200 hover:border-[#7d3feb] bg-purple-50/30 hover:bg-purple-50/60 rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 text-[#7d3feb] mx-auto flex items-center justify-center mb-3">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    {selectedFile ? selectedFile.name : 'Pilih Berkas Struk / Tangkapan Layar Transfer BNI'}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Mendukung format JPG, PNG, WEBP, atau PDF (maksimal 10MB).
                  </p>
                  {selectedFile && (
                    <span className="inline-block mt-3 px-3 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
                      Ukuran: {(selectedFile.size / 1024).toFixed(1)} KB • Siap Diunggah
                    </span>
                  )}
                </label>

                {/* Tombol Kirim / Unggah Bukti */}
                <button
                  type="button"
                  onClick={handleUploadProof}
                  disabled={isUploading || (!selectedFile && !filePreview)}
                  className="w-full py-3.5 px-4 bg-[#7d3feb] hover:bg-[#6f2cdb] active:scale-[0.99] text-white font-bold rounded-2xl shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>
                    {isUploading
                      ? 'Mengunggah Bukti Transfer...'
                      : currentOrder.paymentProofUrl
                      ? 'Perbarui / Unggah Ulang Bukti Transfer'
                      : 'Kirim & Simpan Bukti Pembayaran'}
                  </span>
                </button>
              </div>

              {/* WhatsApp Notifikasi Admin */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-500 text-center sm:text-left">
                  <span>Konfirmasi pembayaran ke Admin WhatsApp:</span>
                  <strong className="text-slate-800 ml-1 block sm:inline font-mono">{ADMIN_WHATSAPP_NUMBER}</strong>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowWaModal(true)}
                    className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-1.5"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Chat Admin WA</span>
                  </button>
                  <a
                    href={`${ADMIN_WHATSAPP_URL}?text=${encodeURIComponent(waConfirmMessage)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl text-xs transition"
                    title="Buka langsung di WhatsApp"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Ringkasan Pesanan (1 col) */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#7d3feb]" />
                Ringkasan Pesanan
              </h3>

              <div className="space-y-2 text-xs divide-y divide-slate-100">
                <div className="pt-2">
                  <span className="text-slate-400 block">Perusahaan Pemesan:</span>
                  <span className="font-bold text-slate-900">{currentOrder.companyName}</span>
                </div>
                <div className="pt-2">
                  <span className="text-slate-400 block">PIC &amp; Kontak:</span>
                  <span className="font-semibold text-slate-800">{currentOrder.contactName} ({currentOrder.contactPhone})</span>
                </div>
                <div className="pt-2">
                  <span className="text-slate-400 block">Luasan Pemetaan:</span>
                  <span className="font-semibold text-slate-800">{currentOrder.areaSizeM2.toLocaleString('id-ID')} m²</span>
                </div>
                <div className="pt-2">
                  <span className="text-slate-400 block">KBLI Kegiatan:</span>
                  <span className="font-semibold text-slate-800">{currentOrder.kbliCode} - {currentOrder.kbliName}</span>
                </div>
                <div className="pt-2">
                  <span className="text-slate-400 block">Lokasi:</span>
                  <span className="text-slate-700">{currentOrder.city}, {currentOrder.province}</span>
                </div>
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-slate-400">Total Tagihan:</span>
                  <span className="font-bold text-[#7d3feb] font-mono text-sm">
                    {formatRupiah(currentOrder.totalCost)}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 text-purple-950 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#7d3feb]" />
                  Jaminan Transaksi Resmi
                </div>
                <p className="text-[11px] text-purple-800">
                  Staf kami akan segera memverifikasi bukti pembayaran yang Anda unggah dan menerbitkan E-Invoice resmi seketika.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ================= OFFICIAL E-INVOICE VIEW (LUNAS) ================= */
        <div className="space-y-6 animate-fadeIn">
          {/* Action Ribbon */}
          <div className="bg-[#f6f1fd] border border-[#decbf7] rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#7d3feb] text-white flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">
                  Pembayaran Terverifikasi &amp; Lunas
                </div>
                <div className="text-xs text-purple-700">
                  E-Invoice resmi PDF dan antrean pengerjaan telah aktif.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <button
                onClick={handleDownloadPdfReceipt}
                disabled={isDownloadingPdf}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition"
              >
                <FileDown className="w-4 h-4" />
                <span>{isDownloadingPdf ? 'Memproses PDF...' : 'Download PDF E-Invoice'}</span>
              </button>

              <button
                onClick={() => setShowWaModal(true)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#7d3feb] hover:bg-[#6f2cdb] text-white rounded-xl text-xs font-bold shadow transition"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp Resi</span>
              </button>

              <button
                onClick={() => onGoToTracking(currentOrder.trackingCode)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow transition"
              >
                <span>Live Tracking ({currentOrder.queueNumber || '#08'})</span>
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
                    Badan Layanan Pemetaan Polygon KKPR &amp; Rencana Tapak Bangunan OSS<br />
                    Standar Kementerian Agraria dan Tata Ruang / BPN RI
                  </p>
                </div>
              </div>

              <div className="sm:text-right">
                <span className="text-xs font-bold uppercase tracking-widest text-[#7d3feb] bg-[#f6f1fd] px-3 py-1 rounded-full border border-[#decbf7]">
                  LUNAS / PAID
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-2 font-mono">
                  {currentOrder.invoiceNumber || `INV/${new Date().getFullYear()}/${currentOrder.trackingCode}`}
                </h2>
                <div className="text-xs text-slate-500 mt-0.5">
                  Tanggal: {new Date(currentOrder.paidAt || Date.now()).toLocaleDateString('id-ID', { dateStyle: 'long' })}
                </div>
              </div>
            </div>

            {/* Bill To & Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
              <div>
                <span className="text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                  Diterbitkan Untuk:
                </span>
                <div className="font-bold text-sm text-slate-900">{currentOrder.companyName}</div>
                <div className="text-slate-600 mt-0.5">PIC: {currentOrder.contactName} ({currentOrder.contactPhone})</div>
                <div className="text-slate-600">{currentOrder.streetAddress}, {currentOrder.city}, {currentOrder.province}</div>
                <div className="text-slate-500 font-mono mt-1">KBLI: {currentOrder.kbliCode} - {currentOrder.kbliName}</div>
              </div>

              <div className="sm:text-right space-y-1">
                <span className="text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                  Informasi Antrean &amp; Pembayaran:
                </span>
                <div>Kode Tracking: <strong className="font-mono text-slate-900">{currentOrder.trackingCode}</strong></div>
                <div>Nomor Antrean Kerja: <strong className="text-[#7d3feb] text-sm font-bold">{currentOrder.queueNumber || '#08'}</strong></div>
                <div>Metode Bayar: <strong>{currentOrder.paymentMethod || 'Transfer BNI (178-619-5190)'}</strong></div>
                <div className="text-emerald-600 font-medium">Status: Terverifikasi Lunas</div>
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
                      {currentOrder.areaSizeM2.toLocaleString('id-ID')} m²
                    </td>
                    <td className="py-4 text-center font-mono font-bold text-[#7d3feb]">
                      {currentOrder.isAbove3000m2 ? currentOrder.difficultyScore?.toFixed(2) : '1.00 (Standard)'}
                    </td>
                    <td className="py-4 text-right font-bold text-slate-900">
                      {formatRupiah(currentOrder.subtotalBeforeDiscount || currentOrder.totalCost)}
                    </td>
                  </tr>

                  {currentOrder.discountAmount > 0 && (
                    <tr className="text-emerald-700 bg-emerald-50/50">
                      <td colSpan={3} className="py-2.5 font-bold">
                        Potongan Kupon Promo ({currentOrder.discountCode || 'Voucher Diskon'}):
                      </td>
                      <td className="py-2.5 text-right font-bold font-mono">
                        -{formatRupiah(currentOrder.discountAmount)}
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
                      {formatRupiah(currentOrder.totalCost)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Digital Stamp */}
            <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-slate-500">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 border-2 border-[#7d3feb] rounded-xl flex items-center justify-center p-1 bg-purple-50 text-center font-mono text-[9px] text-[#7d3feb] font-bold leading-tight">
                  MAP COURSE VALIDATED
                </div>
                <div>
                  <div className="font-bold text-slate-800">Sertifikat Digital Transaksi Sah</div>
                  <div className="text-[11px]">Diterbitkan otomatis oleh MAP COURSE. Bebas materai sesuai UU ITE.</div>
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
