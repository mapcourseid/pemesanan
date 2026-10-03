import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Search, 
  Upload, 
  Download, 
  MessageSquare, 
  Send, 
  ExternalLink,
  TrendingUp,
  Tag,
  Flame,
  UserCheck,
  ShieldCheck,
  Plus,
  FileText,
} from 'lucide-react';
import type { OrderItem, OrderStatus } from '../types';
import { formatRupiah, AVAILABLE_COUPONS } from '../utils/pricing';
import { WhatsAppPreviewModal } from './WhatsAppPreviewModal';
import { syncOrderToFirebase, subscribeToFirebaseOrders } from '../services/firebase';
import { apiUrl, fileUrl, parseJsonResponse } from '../utils/api';

const STATUS_OPTIONS: OrderStatus[] = [
  'Menunggu Pembayaran',
  'Verifikasi Berkas',
  'Olah Data Polygon',
  'Penyusunan Dokumen RTB',
  'Quality Control',
  'Selesai',
];

interface GisInternalDashboardProps {
  onSelectOrderForTracking: (code: string) => void;
  staffUser: { name: string; role: string; email: string } | null;
}

export const GisInternalDashboard: React.FC<GisInternalDashboardProps> = ({
  onSelectOrderForTracking,
  staffUser,
}) => {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Status Change State
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // GIS File Upload State
  const [shpZipFile, setShpZipFile] = useState<File | null>(null);
  const [rtbPdfFile, setRtbPdfFile] = useState<File | null>(null);
  const [uploadingGis, setUploadingGis] = useState(false);

  // Clarification Message State
  const [clarifyMessage, setClarifyMessage] = useState(
    'Halo Tim Telaga Sari Land, dari hasil overlay citra satelit dan ATR/BPN, patok batas timur laut bersinggungan 1.2m dengan sempadan jalan arteri. Mohon konfirmasi apakah batas mengikuti patok fisik atau batas sempadan?'
  );
  const [sendingClarify, setSendingClarify] = useState(false);
  const [showWaClarifyModal, setShowWaClarifyModal] = useState(false);

  // Discount Manager State
  const [manualDiscountAmount, setManualDiscountAmount] = useState<number>(0);
  const [applyingDiscount, setApplyingDiscount] = useState(false);

  const mergeOrders = (incoming: OrderItem[]) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return;
    setOrders((prev) => {
      const map = new Map<string, OrderItem>();
      prev.forEach((o) => map.set(o.trackingCode.toUpperCase(), o));
      incoming.forEach((o) => map.set(o.trackingCode.toUpperCase(), o));
      const list = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return list;
    });
  };

  const fetchOrdersAndStats = async () => {
    // 1. Coba ambil dari backend Express API
    try {
      const [ordersRes, statsRes] = await Promise.all([
        fetch(apiUrl('/api/orders')),
        fetch(apiUrl('/api/stats')),
      ]);
      const ordersData = await parseJsonResponse<OrderItem[]>(ordersRes, 'Gagal memuat daftar pesanan');
      const statsData = await parseJsonResponse<any>(statsRes, 'Gagal memuat statistik');
      if (Array.isArray(ordersData)) {
        mergeOrders(ordersData);
      }
      setStats(statsData);
    } catch (err) {
      console.warn('Notice backend API offline, sinkronisasi via Firebase & LocalStorage aktif:', err);
    }

    // 2. Ambil dari LocalStorage untuk pesanan yang dibuat di browser lokal
    try {
      const localOrders: OrderItem[] = JSON.parse(localStorage.getItem('mapcourse_local_orders') || '[]');
      if (Array.isArray(localOrders) && localOrders.length > 0) {
        mergeOrders(localOrders);
      }
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  };

  useEffect(() => {
    fetchOrdersAndStats();

    // 3. Realtime Listener ke Firebase Realtime Database
    const unsubscribeFirebase = subscribeToFirebaseOrders((fbOrders) => {
      if (Array.isArray(fbOrders) && fbOrders.length > 0) {
        mergeOrders(fbOrders);
      }
    });

    return () => {
      if (unsubscribeFirebase) unsubscribeFirebase();
    };
  }, []);

  // Update selectedOrder jika ada update
  useEffect(() => {
    if (!selectedOrder && orders.length > 0) {
      setSelectedOrder(orders[0]);
    } else if (selectedOrder) {
      const fresh = orders.find((o) => o.trackingCode.toUpperCase() === selectedOrder.trackingCode.toUpperCase());
      if (fresh) setSelectedOrder(fresh);
    }
  }, [orders]);

  // Real-Time Server-Sent Events (SSE)
  useEffect(() => {
    const eventSource = new EventSource(apiUrl('/api/events'));
    eventSource.addEventListener('order_updated', (e: MessageEvent) => {
      try {
        const updated: OrderItem = JSON.parse(e.data);
        mergeOrders([updated]);
      } catch (err) {
        console.error('SSE Error:', err);
      }
    });

    eventSource.addEventListener('order_created', (e: MessageEvent) => {
      try {
        const created: OrderItem = JSON.parse(e.data);
        mergeOrders([created]);
      } catch (err) {
        console.error('SSE Error:', err);
      }
    });

    return () => {
      eventSource.close();
    };
  }, []);

  // Update Status
  const handleUpdateStatus = async (newStatus: OrderStatus) => {
    if (!selectedOrder) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(apiUrl(`/api/orders/${selectedOrder.trackingCode}/status`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await parseJsonResponse<{ order: OrderItem }>(res, 'Gagal memperbarui status');
      setSelectedOrder(data.order);
      setOrders((prev) =>
        prev.map((item) => (item.id === data.order.id ? data.order : item))
      );
      // Sync to Firebase
      syncOrderToFirebase(data.order);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Upload GIS Deliverables
  const handleUploadDeliverables = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setUploadingGis(true);
    const formData = new FormData();
    if (shpZipFile) formData.append('shpZip', shpZipFile);
    if (rtbPdfFile) formData.append('rtbPdf', rtbPdfFile);

    try {
      const res = await fetch(apiUrl(`/api/orders/${selectedOrder.trackingCode}/upload-gis`), {
        method: 'POST',
        body: formData,
      });
      const data = await parseJsonResponse<{ order: OrderItem }>(res, 'Gagal mengunggah berkas GIS');
      setSelectedOrder(data.order);
      syncOrderToFirebase(data.order);
      alert('Berkas hasil pengerjaan GIS & RTB berhasil diperbarui dan disinkronkan!');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setUploadingGis(false);
    }
  };

  // Apply Manual Staff Discount
  const handleApplyStaffDiscount = async () => {
    if (!selectedOrder || manualDiscountAmount <= 0) return;
    setApplyingDiscount(true);
    try {
      const res = await fetch(apiUrl(`/api/orders/${selectedOrder.trackingCode}/discount`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discountAmount: manualDiscountAmount }),
      });
      const data = await parseJsonResponse<{ order: OrderItem }>(res, 'Gagal menerapkan diskon');
      setSelectedOrder(data.order);
      setOrders((prev) =>
        prev.map((item) => (item.id === data.order.id ? data.order : item))
      );
      syncOrderToFirebase(data.order);
      alert(`Diskon sebesar ${formatRupiah(manualDiscountAmount)} berhasil diterapkan!`);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setApplyingDiscount(false);
    }
  };

  // Send WhatsApp Clarification Alert
  const handleSendClarification = async () => {
    if (!selectedOrder || !clarifyMessage.trim()) return;
    setSendingClarify(true);
    try {
      const res = await fetch(apiUrl(`/api/orders/${selectedOrder.trackingCode}/clarify`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: clarifyMessage,
          sender: staffUser ? `${staffUser.name} (Tim GIS)` : 'Tim Pemetaan GIS & Drafter',
        }),
      });
      await parseJsonResponse(res, 'Gagal menyimpan notifikasi klarifikasi');
      setShowWaClarifyModal(true);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSendingClarify(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesFilter = filterStatus === 'ALL' || o.status === filterStatus;
    const matchesSearch =
      o.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.trackingCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.queueNumber.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* WhatsApp Clarification Modal */}
      {selectedOrder && (
        <WhatsAppPreviewModal
          isOpen={showWaClarifyModal}
          onClose={() => setShowWaClarifyModal(false)}
          phone={selectedOrder.contactPhone}
          recipientName={selectedOrder.companyName}
          messageText={`[KLARIFIKASI BATAS TANAH - MAP COURSE]\n\nHalo Bapak/Ibu PIC ${selectedOrder.companyName},\n\n${clarifyMessage}\n\nMohon konfirmasi agar tim dapat menyelesaikan penyusunan file SHP KKPR & dokumen RTB Anda.\nNomor Antrean: ${selectedOrder.queueNumber || '#08'}`}
          title="Kirim Pesan WhatsApp Klarifikasi Batas Tanah"
        />
      )}

      {/* Internal Team Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/20 text-purple-300 text-xs font-bold rounded-full border border-purple-400/30">
              <Layers className="w-3.5 h-3.5 text-[#7d3feb]" />
              Workstation Internal Tim GIS & Drafter MAP COURSE
            </span>

            {staffUser && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/10 text-white text-xs font-semibold rounded-full border border-white/15">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                {staffUser.name} ({staffUser.role})
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Dashboard Pemetaan & Validasi KKPR Real-Time
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Kelola antrean pengerjaan file Polygon GIS (.SHP), dokumen Rencana Tapak Bangunan (RTB), sinkronisasi Firebase, dan alert pelanggan.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold rounded-xl shadow-sm">
            <Flame className="w-4 h-4 text-emerald-400" />
            <span>Firebase Auto-Sync</span>
          </div>

          <button
            onClick={fetchOrdersAndStats}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl border border-slate-700 transition"
          >
            Refresh Data
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-xs text-slate-500 font-medium">Total Masuk</span>
            <div className="text-2xl font-black text-slate-900">{stats.total}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-xs text-amber-600 font-medium">Belum Bayar</span>
            <div className="text-2xl font-black text-amber-600">{stats.pendingPayment}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-xs text-[#7d3feb] font-medium">Sedang Pengerjaan</span>
            <div className="text-2xl font-black text-[#7d3feb]">{stats.processing}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-xs text-purple-600 font-medium">Quality Control</span>
            <div className="text-2xl font-black text-purple-600">{stats.qc}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1 col-span-2 sm:col-span-1">
            <span className="text-xs text-emerald-600 font-medium">Selesai & Serah Terima</span>
            <div className="text-2xl font-black text-emerald-600">{stats.completed}</div>
          </div>
        </div>
      )}

      {/* Main Content Layout: Table & Workstation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Order Queue List (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
            {/* Search & Filters */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari perusahaan / kode tracking..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#7d3feb] focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {['ALL', 'Verifikasi Berkas', 'Olah Data Polygon', 'Penyusunan Dokumen RTB', 'Quality Control', 'Selesai'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition ${
                      filterStatus === st
                        ? 'bg-[#7d3feb] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st === 'ALL' ? 'Semua' : st}
                  </button>
                ))}
              </div>
            </div>

            {/* List of Orders */}
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {filteredOrders.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  Tidak ada pesanan dengan filter ini.
                </div>
              ) : (
                filteredOrders.map((ord) => {
                  const isSelected = selectedOrder?.id === ord.id;
                  return (
                    <div
                      key={ord.id}
                      onClick={() => setSelectedOrder(ord)}
                      className={`p-4 rounded-2xl border text-xs cursor-pointer transition space-y-2 ${
                        isSelected
                          ? 'bg-[#f6f1fd] border-[#7d3feb] shadow-md ring-2 ring-[#7d3feb]/20'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900 text-xs">
                          {ord.trackingCode}
                        </span>
                        <span className="font-mono font-bold text-[#7d3feb] bg-purple-100 px-2 py-0.5 rounded text-[11px]">
                          {ord.queueNumber}
                        </span>
                      </div>

                      <div>
                        <div className="font-bold text-slate-900 text-sm">{ord.companyName}</div>
                        <div className="text-[11px] text-slate-500">
                          {ord.areaSizeM2.toLocaleString('id-ID')} m² • {ord.city}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                        <span className={`font-semibold px-2 py-0.5 rounded ${
                          ord.status === 'Selesai'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ord.status === 'Menunggu Pembayaran'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-purple-100 text-[#7d3feb]'
                        }`}>
                          {ord.status}
                        </span>
                        <span className="font-bold text-slate-800">
                          {formatRupiah(ord.totalCost)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Workstation & Order Actions (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {selectedOrder ? (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
              {/* Top Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#7d3feb] text-sm">
                      {selectedOrder.trackingCode}
                    </span>
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">
                      Antrean: {selectedOrder.queueNumber}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 mt-1">
                    {selectedOrder.companyName}
                  </h2>
                  <div className="text-xs text-slate-500">
                    PIC: {selectedOrder.contactName} ({selectedOrder.contactPhone})
                  </div>
                </div>

                <button
                  onClick={() => onSelectOrderForTracking(selectedOrder.trackingCode)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  <span>Buka Live Tracking Pelanggan</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 1. Pengendali Status Real-Time */}
              <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-[#7d3feb]" />
                    Pembaruan Status Real-Time (Live Push ke HP Customer):
                  </span>
                  <span className="text-[11px] font-mono text-[#7d3feb] font-bold">
                    Aktif: {selectedOrder.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {STATUS_OPTIONS.map((st) => {
                    const isCurrent = selectedOrder.status === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        disabled={updatingStatus}
                        onClick={() => handleUpdateStatus(st)}
                        className={`p-3 rounded-xl text-xs font-bold transition text-left flex flex-col justify-between ${
                          isCurrent
                            ? 'bg-[#7d3feb] text-white shadow-md'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-purple-50 hover:border-[#7d3feb]'
                        }`}
                      >
                        <span className="text-[10px] opacity-75">Update ke:</span>
                        <span className="leading-tight">{st}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Unduh Raw Data Customer */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Raw Data & Spesifikasi Input Customer
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Legalitas Lahan:</span>
                      <span className="font-bold text-slate-900">
                        {selectedOrder.landOwnershipStatus} ({selectedOrder.landOwnershipType || 'N/A'})
                      </span>
                    </div>

                    {selectedOrder.landDocumentUrl ? (
                      <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                        <div className="text-[11px] text-slate-600 font-medium truncate flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span className="truncate">{selectedOrder.landDocumentName || 'Dokumen_Legalitas_Lahan.pdf'}</span>
                        </div>
                        <a
                          href={fileUrl(selectedOrder.landDocumentUrl)}
                          download={selectedOrder.landDocumentName || `Berkas_Legalitas_${selectedOrder.trackingCode}.pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 px-3 bg-[#7d3feb] hover:bg-[#6f2cdb] text-white rounded-lg text-xs font-bold transition shadow-sm"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Unduh Berkas Legalitas Lahan</span>
                        </a>
                      </div>
                    ) : (
                      <div className="pt-1 text-[11px] text-slate-400 italic">
                        {selectedOrder.landDocumentName ? (
                          <span>File: {selectedOrder.landDocumentName} (Menunggu upload fisik)</span>
                        ) : (
                          <span>Belum ada berkas dokumen fisik yang diunggah</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-slate-500 font-medium">KBLI & Bangunan:</span>
                    <div className="font-bold text-slate-900">
                      {selectedOrder.kbliCode} - {selectedOrder.kbliName}
                    </div>
                    <div className="text-slate-600">
                      {selectedOrder.buildingCount} Unit • {selectedOrder.buildingFloors} Lt • {selectedOrder.buildingHeightMeters}m
                    </div>
                    <div className="text-[11px] text-slate-500 pt-1">
                      Status IMB: <strong>{selectedOrder.imbStatus || 'Belum Memiliki'}</strong>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-slate-800 block">Draf Polygon / Geometri Customer:</span>
                    <span className="text-slate-500 text-[11px]">
                      {selectedOrder.hasPolygon
                        ? (selectedOrder.polygonShapefileUrl ? 'File Shapefile (.ZIP) diunggah customer' : 'Polygon GeoJSON tersedia')
                        : `Titik Koordinat: ${selectedOrder.coordinates?.lat?.toFixed(5) || '-'}, ${selectedOrder.coordinates?.lng?.toFixed(5) || '-'}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedOrder.polygonShapefileUrl && (
                      <a
                        href={fileUrl(selectedOrder.polygonShapefileUrl)}
                        download={`Raw_Shapefile_${selectedOrder.trackingCode}.zip`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#7d3feb] hover:bg-[#6f2cdb] text-white rounded-lg font-bold shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh .ZIP Asli</span>
                      </a>
                    )}
                    {selectedOrder.polygonGeoJson ? (
                      <a
                        href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(selectedOrder.polygonGeoJson, null, 2))}`}
                        download={`Polygon_GeoJSON_${selectedOrder.trackingCode}.geojson`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg font-bold text-slate-700 shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh .GeoJSON</span>
                      </a>
                    ) : (
                      <a
                        href={fileUrl(selectedOrder.gisResultFiles?.geoJsonUrl || '/uploads/samples/sample_polygon.geojson')}
                        download={`Draf_Polygon_${selectedOrder.trackingCode}.geojson`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg font-bold text-slate-700 shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh Geometri Draf</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Diskon / Voucher Management Staf */}
              <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-[#7d3feb]" />
                    Manajemen Diskon & Penyesuaian Harga Khusus Staf
                  </span>
                  <span className="text-xs font-mono font-bold text-[#7d3feb]">
                    Saat ini: {selectedOrder.discountAmount > 0 ? `Diskon ${formatRupiah(selectedOrder.discountAmount)}` : 'Tidak Ada Diskon'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="50000"
                    placeholder="Nominal Diskon Manual (Rp)"
                    value={manualDiscountAmount || ''}
                    onChange={(e) => setManualDiscountAmount(Number(e.target.value))}
                    className="flex-1 px-3 py-2 bg-white border border-purple-200 rounded-xl text-xs font-mono"
                  />
                  <button
                    type="button"
                    disabled={applyingDiscount}
                    onClick={handleApplyStaffDiscount}
                    className="px-4 py-2 bg-[#7d3feb] hover:bg-[#6f2cdb] text-white text-xs font-bold rounded-xl shadow transition"
                  >
                    {applyingDiscount ? 'Menyimpan...' : 'Terapkan Diskon'}
                  </button>
                </div>
              </div>

              {/* 4. Upload Deliverables Selesai */}
              <form onSubmit={handleUploadDeliverables} className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-[#7d3feb]" />
                    Upload Dokumen Selesai (.SHP & .PDF RTB):
                  </span>
                  <span className="text-[11px] text-purple-700 font-bold">
                    Tahap 5 Deliverables
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="block font-semibold text-slate-700">1. Bundle Zip .SHP KKPR</label>
                    <input
                      type="file"
                      accept=".zip"
                      onChange={(e) => setShpZipFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#7d3feb] file:text-white hover:file:bg-[#6f2cdb]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-semibold text-slate-700">2. Buku RTB Digital (.PDF)</label>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setRtbPdfFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#7d3feb] file:text-white hover:file:bg-[#6f2cdb]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={uploadingGis}
                  className="w-full py-2.5 px-4 bg-[#7d3feb] hover:bg-[#6f2cdb] text-white rounded-xl text-xs font-bold shadow-md shadow-purple-500/20 transition"
                >
                  {uploadingGis ? 'Menyimpan Berkas...' : 'Simpan & Publikasikan ke Portal Download Customer'}
                </button>
              </form>

              {/* 5. WhatsApp Alert Klarifikasi Batas Tanah */}
              <div className="space-y-3 p-4 bg-amber-50/60 rounded-2xl border border-amber-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-amber-700" />
                    Kirim WhatsApp Alert Klarifikasi Batas Tanah
                  </span>
                  <span className="text-[11px] text-amber-800">
                    Ke: {selectedOrder.contactPhone}
                  </span>
                </div>

                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={clarifyMessage}
                    onChange={(e) => setClarifyMessage(e.target.value)}
                    className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-amber-700">
                      * Pesan otomatis tercatat di timeline customer.
                    </span>
                    <button
                      type="button"
                      disabled={sendingClarify}
                      onClick={handleSendClarification}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl text-xs font-bold shadow transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{sendingClarify ? 'Mengirim...' : 'Kirim Alert WhatsApp'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center text-slate-400">
              Pilih pesanan di sebelah kiri untuk melihat workstation GIS.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
