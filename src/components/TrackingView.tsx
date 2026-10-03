import React, { useState, useEffect } from 'react';
import { 
  Search, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Download, 
  Star, 
  MessageSquare, 
  AlertCircle, 
  FileCheck, 
  Layers, 
  Sparkles,
  Tag
} from 'lucide-react';
import type { OrderItem, OrderStatus } from '../types';
import { LeafletMapPreview } from './LeafletMapPreview';
import { formatRupiah } from '../utils/pricing';
import { apiUrl, fileUrl, parseJsonResponse } from '../utils/api';
import { WhatsAppPreviewModal } from './WhatsAppPreviewModal';

interface TrackingViewProps {
  initialTrackingCode?: string;
}

const STEPS: { status: OrderStatus; label: string; description: string }[] = [
  { 
    status: 'Verifikasi Berkas', 
    label: '1. Verifikasi Berkas', 
    description: 'Pengecekan kelengkapan sertifikat lahan & koordinat' 
  },
  { 
    status: 'Olah Data Polygon', 
    label: '2. Olah Data Polygon GIS', 
    description: 'Delineasi peta, koreksi topologi & format .SHP KKPR' 
  },
  { 
    status: 'Penyusunan Dokumen RTB', 
    label: '3. Penyusunan Dokumen RTB', 
    description: 'Drafting arsitektural tapak & tata bangunan digital' 
  },
  { 
    status: 'Quality Control', 
    label: '4. Quality Control', 
    description: 'Pemeriksaan validasi standar OSS Kementerian ATR/BPN' 
  },
  { 
    status: 'Selesai', 
    label: '5. Selesai & Serah Terima', 
    description: 'Dokumen final siap diunduh & digunakan di sistem KKPR' 
  },
];

export const TrackingView: React.FC<TrackingViewProps> = ({ initialTrackingCode = 'POL-2026-1003-014' }) => {
  const [searchCode, setSearchCode] = useState(initialTrackingCode);
  const [order, setOrder] = useState<OrderItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Rating & Review State
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [reviewText, setReviewText] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  // WhatsApp Simulation Modal
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waModalMessage, setWaModalMessage] = useState('');

  const fetchOrder = async (codeToFetch: string) => {
    if (!codeToFetch) return;
    setLoading(true);
    setErrorMessage(null);
    const cleanCode = codeToFetch.trim().toUpperCase();

    try {
      // 1. Coba ambil dari backend API
      try {
        const res = await fetch(apiUrl(`/api/orders/${encodeURIComponent(cleanCode)}`));
        const data = await parseJsonResponse<OrderItem>(res, 'Pesanan dengan kode tracking ini tidak ditemukan.');
        setOrder(data);
        if (data.rating) {
          setSelectedRating(data.rating);
          setReviewText(data.review || '');
          setFeedbackSuccess(true);
        }
        return;
      } catch (err: any) {
        console.warn('[TrackingView] Backend fetch notice:', err);
      }

      // 2. Fallback: Cari di local storage
      try {
        const localOrders: OrderItem[] = JSON.parse(localStorage.getItem('mapcourse_local_orders') || '[]');
        const found = localOrders.find((o) => o.trackingCode.toUpperCase() === cleanCode);
        if (found) {
          setOrder(found);
          if (found.rating) {
            setSelectedRating(found.rating);
            setReviewText(found.review || '');
            setFeedbackSuccess(true);
          }
          return;
        }
      } catch (e) {
        console.warn('LocalStorage lookup error:', e);
      }

      setErrorMessage('Pesanan dengan kode tracking ini tidak ditemukan. Silakan periksa kembali kode Anda.');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialTrackingCode) {
      setSearchCode(initialTrackingCode);
      fetchOrder(initialTrackingCode);
    }
  }, [initialTrackingCode]);

  // Real-Time Server-Sent Events (SSE) Listener
  useEffect(() => {
    const eventSource = new EventSource(apiUrl('/api/events'));
    eventSource.addEventListener('order_updated', (e: MessageEvent) => {
      try {
        const updated: OrderItem = JSON.parse(e.data);
        if (order && updated.id === order.id) {
          setOrder(updated);
        }
      } catch (err) {
        console.error('SSE Error:', err);
      }
    });

    return () => {
      eventSource.close();
    };
  }, [order?.id]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrder(searchCode);
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setIsSubmittingFeedback(true);
    try {
      const res = await fetch(apiUrl(`/api/orders/${order.trackingCode}/feedback`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: selectedRating, review: reviewText }),
      });
      const data = await parseJsonResponse<{ order: OrderItem }>(res, 'Gagal mengirimkan ulasan');
      setOrder(data.order);
      setFeedbackSuccess(true);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const getStepStatus = (stepStatus: OrderStatus) => {
    if (!order) return 'upcoming';

    const orderIndex = STEPS.findIndex((s) => s.status === order.status);
    const thisIndex = STEPS.findIndex((s) => s.status === stepStatus);

    if (order.status === 'Menunggu Pembayaran') return 'upcoming';
    if (thisIndex < orderIndex) return 'completed';
    if (thisIndex === orderIndex) return 'current';
    return 'upcoming';
  };

  const isCompleted = order?.status === 'Selesai';

  const openCompletedWaNotification = () => {
    if (!order) return;
    setWaModalMessage(
      `Dokumen Polygon & RTB Anda telah selesai diproses!\n\nNomor Antrean: ${order.queueNumber || '#08'}\nPerusahaan: ${order.companyName}\n\nSilakan unduh berkas resmi Anda di link tracking resmi berikut:\nhttps://tracking.domainanda.com/track/${order.trackingCode}\n\nBerkas siap digunakan untuk pengajuan KKPR pada sistem OSS Kementerian ATR/BPN.`
    );
    setWaModalOpen(true);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {/* WhatsApp Modal */}
      {order && (
        <WhatsAppPreviewModal
          isOpen={waModalOpen}
          onClose={() => setWaModalOpen(false)}
          phone={order.contactPhone}
          recipientName={order.companyName}
          messageText={waModalMessage}
          title="Notifikasi Penyelesaian via WhatsApp"
        />
      )}

      {/* Search Bar / Public Access Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#7d3feb] bg-[#f6f1fd] px-2.5 py-0.5 rounded-full border border-[#decbf7]">
              Tahap 3 & 5: Live Tracking Pelanggan
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              Pantau Progres Pengerjaan Polygon & RTB
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Bebas akses tanpa login langsung dari tautan WhatsApp pendaftaran.
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                placeholder="POL-2026-XXXX-XXX"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-semibold uppercase focus:ring-2 focus:ring-[#7d3feb] focus:bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 bg-[#7d3feb] hover:bg-[#6f2cdb] text-white rounded-xl text-xs font-bold shadow-md shadow-purple-500/20 transition"
            >
              {loading ? 'Mencari...' : 'Lacak'}
            </button>
          </form>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {order && (
        <div className="space-y-6 animate-fadeIn">
          {/* Main Status Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Nomor Antrean Pengerjaan:
                  </span>
                  <span className="px-3 py-1 bg-[#7d3feb] text-white font-mono font-black text-sm rounded-xl shadow-sm">
                    {order.queueNumber || '#08'}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  {order.companyName}
                </h2>
                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                  <span>KBLI: <strong>{order.kbliCode}</strong></span>
                  <span>•</span>
                  <span>Luas: <strong>{order.areaSizeM2.toLocaleString('id-ID')} m²</strong></span>
                  <span>•</span>
                  <span>Lokasi: <strong>{order.city}, {order.province}</strong></span>
                </div>
              </div>

              <div className="sm:text-right space-y-2">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#f6f1fd] text-[#7d3feb] border border-[#decbf7]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#7d3feb] animate-pulse" />
                  Status: {order.status}
                </div>
                {order.aheadCount !== undefined && order.status !== 'Selesai' && (
                  <div className="text-xs text-slate-500">
                    Posisi: Terdapat <strong className="text-[#7d3feb] font-bold">{order.aheadCount}</strong> antrean di depan Anda
                  </div>
                )}
              </div>
            </div>

            {/* Stepper Progress Bar */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Tahapan Pengerjaan GIS & Drafter:</span>
                <span className="text-[#7d3feb]">
                  {isCompleted ? '100% Selesai & Terverifikasi' : 'Sedang Diproses Tim'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {STEPS.map((step, idx) => {
                  const state = getStepStatus(step.status);
                  return (
                    <div
                      key={step.status}
                      className={`p-4 rounded-2xl border text-xs space-y-1.5 transition ${
                        state === 'completed'
                          ? 'bg-[#f6f1fd] border-[#decbf7] text-[#5e23be]'
                          : state === 'current'
                          ? 'bg-[#7d3feb] text-white shadow-lg shadow-purple-500/25 ring-2 ring-[#7d3feb]/30'
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-bold text-[10px] uppercase tracking-wide ${state === 'current' ? 'text-purple-200' : 'text-slate-400'}`}>
                          Step {idx + 1}
                        </span>
                        {state === 'completed' ? (
                          <CheckCircle2 className="w-4 h-4 text-[#7d3feb]" />
                        ) : state === 'current' ? (
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-300 animate-ping" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-slate-300" />
                        )}
                      </div>
                      <div className="font-bold text-xs">{step.label}</div>
                      <p className={`text-[10px] leading-tight ${state === 'current' ? 'text-purple-100' : 'opacity-75'}`}>
                        {step.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Clarification Alert from GIS Team if any */}
            {order.clarificationNotes && order.clarificationNotes.length > 0 && (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-300 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Pemberitahuan dari Tim GIS & Drafter:</span>
                </div>
                <div className="space-y-1.5 pl-6">
                  {order.clarificationNotes.map((note) => (
                    <div key={note.id} className="text-xs text-amber-800">
                      <div className="font-medium">"{note.message}"</div>
                      <div className="text-[10px] text-amber-600 mt-0.5">
                        Oleh {note.sender} • {new Date(note.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Map Preview */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                <span className="flex items-center gap-1.5 font-bold text-slate-800">
                  <MapPin className="w-4 h-4 text-[#7d3feb]" />
                  Visualisasi Polygon Lahan Proyek
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {order.coordinates?.lat.toFixed(4)}, {order.coordinates?.lng.toFixed(4)}
                </span>
              </div>
              <LeafletMapPreview
                center={order.coordinates ? [order.coordinates.lat, order.coordinates.lng] : [-6.8428, 107.4912]}
                coordinates={order.coordinates}
                polygonGeoJson={order.polygonGeoJson}
                interactive={false}
                height="320px"
              />
            </div>
          </div>

          {/* TAHAP 5: SERAH TERIMA DOKUMEN SELESAI */}
          {isCompleted && (
            <div className="bg-gradient-to-br from-[#411a7f] via-[#5e23be] to-[#7d3feb] text-white rounded-3xl p-6 sm:p-10 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/20">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 text-white text-xs font-bold rounded-full border border-white/30 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    Tahap 5: Serah Terima Dokumen Resmi Selesai
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight">
                    Portal Pengunduhan Hasil Pekerjaan GIS & RTB
                  </h3>
                  <p className="text-xs text-purple-200 mt-1">
                    Seluruh berkas telah melewati Quality Control dan siap digunakan untuk sistem KKPR OSS Kementerian ATR/BPN.
                  </p>
                </div>

                <button
                  onClick={openCompletedWaNotification}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-100 text-[#7d3feb] rounded-xl text-xs font-bold shadow-md transition"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Lihat Notifikasi WhatsApp</span>
                </button>
              </div>

              {/* Download Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Bundle Zip Shapefile */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/15 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-purple-200 font-bold text-sm">
                      <Layers className="w-5 h-5 text-amber-300" />
                      <span>1. File Polygon GIS KKPR (.ZIP)</span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      Bundle Shapefile terkompresi berisi file .SHP, .SHX, .DBF, dan .PRJ lengkap dengan proyeksi WGS 84 UTM standar OSS.
                    </p>
                    <div className="text-[11px] text-amber-200 font-mono">
                      Format: .SHP • Siap Upload Sistem KKPR
                    </div>
                  </div>

                  <a
                    href={fileUrl(order.gisResultFiles?.zipShpUrl || '/uploads/samples/sample_shp_bundle.zip')}
                    download={`Polygon_KKPR_${order.trackingCode}.zip`}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-100 text-[#7d3feb] rounded-xl text-xs font-bold shadow transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Bundle ZIP (.SHP)</span>
                  </a>
                </div>

                {/* Dokumen RTB PDF */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/15 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-purple-200 font-bold text-sm">
                      <FileCheck className="w-5 h-5 text-amber-300" />
                      <span>2. Dokumen RTB Resmi (.PDF)</span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      Buku Rencana Tapak Bangunan (RTB) resmi bertanda tangan digital QR Code, memuat denah tapak, KDB, KLB, dan sempadan.
                    </p>
                    <div className="text-[11px] text-amber-200 font-mono">
                      Format: PDF High-Resolution • Digital Signed
                    </div>
                  </div>

                  <a
                    href={fileUrl(order.gisResultFiles?.rtbPdfUrl || '/uploads/samples/sample_rtb_rencana_tapak.pdf')}
                    download={`Dokumen_RTB_${order.trackingCode}.pdf`}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-100 text-[#7d3feb] rounded-xl text-xs font-bold shadow transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Dokumen RTB (PDF)</span>
                  </a>
                </div>
              </div>

              {/* Extra Layer Downloads */}
              <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
                <span className="text-purple-200 font-medium">Format Tambahan:</span>
                <a
                  href={fileUrl(order.gisResultFiles?.kmlUrl || '/uploads/samples/sample_layer.kml')}
                  download={`Layer_${order.trackingCode}.kml`}
                  className="text-white hover:underline bg-white/10 px-3 py-1.5 rounded-lg border border-white/15"
                >
                  Download .KML (Google Earth)
                </a>
                <a
                  href={fileUrl(order.gisResultFiles?.geoJsonUrl || '/uploads/samples/sample_polygon.geojson')}
                  download={`Data_${order.trackingCode}.geojson`}
                  className="text-white hover:underline bg-white/10 px-3 py-1.5 rounded-lg border border-white/15"
                >
                  Download .GeoJSON (Web GIS)
                </a>
              </div>
            </div>
          )}

          {/* POST-SERVICE RATING & FEEDBACK */}
          {isCompleted && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center font-bold">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Evaluasi Kualitas Pelayanan (Post-Service Rating)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Bantu kami meningkatkan kecepatan dan akurasi pengerjaan Tim GIS & Drafter MAP COURSE.
                  </p>
                </div>
              </div>

              {feedbackSuccess ? (
                <div className="p-5 bg-purple-50 rounded-2xl border border-purple-200 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-[#7d3feb] mx-auto" />
                  <div className="text-sm font-bold text-purple-950">
                    Terima Kasih Atas Ulasan & Bintang Anda!
                  </div>
                  <div className="flex justify-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-5 h-5 ${
                          star <= (order.rating || selectedRating)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-purple-800 italic max-w-md mx-auto">
                    "{order.review || reviewText}"
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmitFeedback} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                      Beri Rating Pelayanan Tim (1 - 5 Bintang):
                    </label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          type="button"
                          key={star}
                          onClick={() => setSelectedRating(star)}
                          className="p-1 hover:scale-110 transition"
                        >
                          <Star
                            className={`w-7 h-7 ${
                              star <= selectedRating
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-300 hover:text-amber-200'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-xs font-bold text-slate-600 ml-2">
                        {selectedRating} dari 5 Bintang
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ulasan Singkat Pengalaman Pelayanan:
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder="Contoh: Pengerjaan sangat cepat, koordinat polygon presisi dan dokumen RTB rapi..."
                      className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#7d3feb] focus:bg-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingFeedback}
                    className="px-6 py-2.5 bg-[#7d3feb] hover:bg-[#6f2cdb] text-white font-bold rounded-xl text-xs shadow transition"
                  >
                    {isSubmittingFeedback ? 'Mengirim...' : 'Kirim Ulasan Pelayanan'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
