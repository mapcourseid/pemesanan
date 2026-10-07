import React, { useState, useEffect } from 'react';
import {
  Tag,
  Plus,
  Trash2,
  Edit,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Percent,
  Coins,
  ShieldCheck,
  Search,
  Filter,
  Sparkles,
  Info,
  Calendar,
  Layers,
  X,
} from 'lucide-react';
import {
  formatRupiah,
  getAllCoupons,
  saveCustomCoupon,
  deleteCustomCoupon,
  type PromoCoupon,
  DEFAULT_COUPONS,
} from '../utils/pricing';
import {
  syncDiscountToFirebase,
  deleteDiscountFromFirebase,
  subscribeToFirebaseDiscounts,
} from '../services/firebase';

interface DiscountManagerProps {
  staffUser: { name: string; role: string; email: string } | null;
}

export const DiscountManager: React.FC<DiscountManagerProps> = ({ staffUser }) => {
  const [coupons, setCoupons] = useState<PromoCoupon[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal / Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);

  // Form Fields
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [discountValue, setDiscountValue] = useState<number>(10);
  const [description, setDescription] = useState('');
  const [minAreaM2, setMinAreaM2] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(true);

  // UI Feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);

  // Load and subscribe to discounts
  useEffect(() => {
    // 1. Initial local load
    const currentList = Object.values(getAllCoupons());
    setCoupons(currentList);

    // 2. Firebase Realtime subscription
    const unsubscribe = subscribeToFirebaseDiscounts((firebaseCoupons) => {
      if (firebaseCoupons && firebaseCoupons.length > 0) {
        const merged: Record<string, PromoCoupon> = { ...DEFAULT_COUPONS };
        firebaseCoupons.forEach((c) => {
          if (c && c.code) {
            const clean = c.code.toUpperCase();
            merged[clean] = c;
            saveCustomCoupon(c);
          }
        });
        setCoupons(Object.values(merged));
      }
    });

    return () => unsubscribe();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyCode = (couponCode: string) => {
    navigator.clipboard.writeText(couponCode);
    setCopiedCode(couponCode);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const openAddForm = () => {
    setEditingCode(null);
    setCode('');
    setDiscountType('PERCENT');
    setDiscountValue(10);
    setDescription('');
    setMinAreaM2(0);
    setIsActive(true);
    setIsFormOpen(true);
  };

  const openEditForm = (c: PromoCoupon) => {
    setEditingCode(c.code);
    setCode(c.code);
    setDiscountType(c.discountType);
    setDiscountValue(c.discountValue);
    setDescription(c.description);
    setMinAreaM2(c.minAreaM2 || 0);
    setIsActive(c.isActive ?? true);
    setIsFormOpen(true);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '');
    if (!cleanCode) {
      alert('Kode kupon tidak boleh kosong!');
      return;
    }

    if (discountValue <= 0) {
      alert('Besaran diskon harus lebih besar dari 0!');
      return;
    }

    if (discountType === 'PERCENT' && discountValue > 90) {
      alert('Diskon persentase maksimal 90%!');
      return;
    }

    const newCoupon: PromoCoupon = {
      code: cleanCode,
      discountType,
      discountValue: Number(discountValue),
      description: description.trim() || `Diskon ${discountType === 'PERCENT' ? `${discountValue}%` : formatRupiah(discountValue)} Layanan MAP COURSE`,
      minAreaM2: minAreaM2 > 0 ? Number(minAreaM2) : 0,
      isActive,
      createdAt: new Date().toISOString(),
      createdBy: staffUser?.name || 'Staf GIS',
    };

    // 1. Simpan ke local cache
    saveCustomCoupon(newCoupon);

    // 2. Simpan ke Firebase Realtime Database
    try {
      await syncDiscountToFirebase(newCoupon);
    } catch (err) {
      console.warn('[DiscountManager] Firebase sync notice:', err);
    }

    // 3. Update list state
    setCoupons(Object.values(getAllCoupons()));
    setIsFormOpen(false);
    showToast(editingCode ? `Kupon ${cleanCode} berhasil diperbarui!` : `Kupon ${cleanCode} berhasil diterbitkan!`);
  };

  const handleToggleStatus = async (c: PromoCoupon) => {
    const updated: PromoCoupon = {
      ...c,
      isActive: !(c.isActive ?? true),
    };

    saveCustomCoupon(updated);
    try {
      await syncDiscountToFirebase(updated);
    } catch { /* ignore */ }

    setCoupons(Object.values(getAllCoupons()));
    showToast(`Status kupon ${c.code} diubah menjadi ${updated.isActive ? 'AKTIF' : 'NONAKTIF'}`);
  };

  const confirmDelete = async () => {
    if (!deletingCode) return;
    deleteCustomCoupon(deletingCode);
    try {
      await deleteDiscountFromFirebase(deletingCode);
    } catch { /* ignore */ }

    setCoupons(Object.values(getAllCoupons()));
    showToast(`Kupon ${deletingCode} berhasil dihapus.`);
    setDeletingCode(null);
  };

  // Filtered coupons
  const filteredCoupons = coupons.filter((c) => {
    const matchesSearch =
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase());

    const activeState = c.isActive ?? true;
    if (filterActive === 'ACTIVE') return matchesSearch && activeState;
    if (filterActive === 'INACTIVE') return matchesSearch && !activeState;
    return matchesSearch;
  });

  const activeCount = coupons.filter((c) => c.isActive !== false).length;
  const inactiveCount = coupons.filter((c) => c.isActive === false).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold border border-purple-500/30 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-[#7d3feb] to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-purple-900/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-purple-200 border border-white/20">
            <Tag className="w-3.5 h-3.5 text-amber-300" />
            <span>Manajemen Promo &amp; Diskon Staf</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Kelola Kupon Diskon &amp; Voucher
          </h2>
          <p className="text-purple-200 text-xs sm:text-sm max-w-xl leading-relaxed">
            Terbitkan kode kupon baru untuk pemohon pemetaan KKPR &amp; RTB. Kupon yang aktif langsung dapat diterapkan pelanggan pada formulir pemesanan secara otomatis.
          </p>
        </div>

        <button
          onClick={openAddForm}
          className="inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-white text-purple-900 hover:bg-purple-50 font-black text-xs rounded-2xl shadow-lg transition transform active:scale-95"
        >
          <Plus className="w-4 h-4 text-purple-700" />
          <span>Tambah Kupon Baru</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs text-slate-500 font-medium">Total Kupon</span>
          <div className="text-2xl font-black text-slate-900">{coupons.length}</div>
          <span className="text-[11px] text-slate-400 block">Tersimpan di Cloud</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs text-emerald-600 font-medium">Kupon Aktif</span>
          <div className="text-2xl font-black text-emerald-600">{activeCount}</div>
          <span className="text-[11px] text-emerald-700/80 block">Dapat dipakai pemohon</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs text-slate-400 font-medium">Kupon Nonaktif</span>
          <div className="text-2xl font-black text-slate-400">{inactiveCount}</div>
          <span className="text-[11px] text-slate-400 block">Ditangguhkan</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs text-[#7d3feb] font-medium">Auto-Sync</span>
          <div className="text-base font-black text-[#7d3feb] flex items-center gap-1.5 pt-1">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <span>Firebase Live</span>
          </div>
          <span className="text-[11px] text-slate-400 block">Realtime sinkronisasi</span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kode kupon atau deskripsi..."
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#7d3feb] focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs">
          <button
            onClick={() => setFilterActive('ALL')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              filterActive === 'ALL'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua ({coupons.length})
          </button>
          <button
            onClick={() => setFilterActive('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              filterActive === 'ACTIVE'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Aktif ({activeCount})
          </button>
          <button
            onClick={() => setFilterActive('INACTIVE')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              filterActive === 'INACTIVE'
                ? 'bg-white text-slate-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Nonaktif ({inactiveCount})
          </button>
        </div>
      </div>

      {/* Grid of Coupons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCoupons.map((c) => {
          const isLive = c.isActive !== false;
          return (
            <div
              key={c.code}
              className={`bg-white rounded-3xl p-5 border transition shadow-sm space-y-4 flex flex-col justify-between ${
                isLive
                  ? 'border-slate-200 hover:border-purple-300 hover:shadow-md'
                  : 'border-slate-200 bg-slate-50/70 opacity-75'
              }`}
            >
              <div className="space-y-3">
                {/* Top Badge Row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-sm px-2.5 py-1 bg-purple-50 text-[#7d3feb] border border-purple-200 rounded-xl tracking-wider">
                      {c.code}
                    </span>
                    <button
                      onClick={() => handleCopyCode(c.code)}
                      title="Salin Kode Kupon"
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                    >
                      {copiedCode === c.code ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                      isLive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-300'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isLive ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    />
                    {isLive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>

                {/* Discount Value */}
                <div>
                  <div className="text-xl font-black text-slate-900 flex items-center gap-1.5">
                    {c.discountType === 'PERCENT' ? (
                      <>
                        <Percent className="w-5 h-5 text-[#7d3feb]" />
                        <span>Diskon {c.discountValue}%</span>
                      </>
                    ) : (
                      <>
                        <Coins className="w-5 h-5 text-emerald-600" />
                        <span>Potongan {formatRupiah(c.discountValue)}</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {c.description}
                  </p>
                </div>

                {/* Conditions & Details */}
                <div className="pt-2 border-t border-slate-100 space-y-1 text-[11px] text-slate-500">
                  {c.minAreaM2 && c.minAreaM2 > 0 ? (
                    <div className="flex items-center gap-1.5 text-amber-700 font-medium">
                      <Layers className="w-3.5 h-3.5 text-amber-600" />
                      <span>Syarat Luas: Minimal {c.minAreaM2.toLocaleString('id-ID')} m²</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      <span>Berlaku untuk semua luasan lahan</span>
                    </div>
                  )}

                  {c.createdBy && (
                    <div className="text-slate-400 text-[10px]">
                      Dibuat oleh: {c.createdBy}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleToggleStatus(c)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
                    isLive
                      ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                      : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  {isLive ? 'Nonaktifkan' : 'Aktifkan'}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditForm(c)}
                    title="Edit Kupon"
                    className="p-1.5 text-slate-500 hover:text-[#7d3feb] hover:bg-purple-50 rounded-xl transition"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeletingCode(c.code)}
                    title="Hapus Kupon"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredCoupons.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-200 p-8 space-y-3">
            <Tag className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="font-bold text-slate-700 text-sm">Tidak ada kupon ditemukan</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Tidak ada kupon yang cocok dengan kriteria pencarian Anda. Tambahkan kupon diskon baru untuk mulai memberikan potongan harga kepada pelanggan.
            </p>
            <button
              onClick={openAddForm}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[#7d3feb] text-white text-xs font-bold rounded-xl shadow transition"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Kupon Sekarang</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal Form Tambah / Edit Kupon */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-900 to-[#7d3feb] p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                  <Tag className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-black text-base">
                    {editingCode ? `Edit Kupon: ${editingCode}` : 'Buat Kupon Diskon Baru'}
                  </h3>
                  <p className="text-xs text-purple-200">
                    Kupon akan otomatis tersinkronisasi ke formulir pemesanan
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-black/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveCoupon} className="p-6 space-y-4 text-xs">
              {/* Kode Kupon */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span>Kode Kupon Diskon (Wajib)*</span>
                  <span className="text-[10px] text-slate-400 font-normal">Otomatis Huruf Kapital</span>
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  disabled={!!editingCode}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                  placeholder="Contoh: INVESTOR20, DISKONATR, KEMITRAAN"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold uppercase text-slate-900 focus:ring-2 focus:ring-[#7d3feb] disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              {/* Tipe Diskon & Besaran */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Tipe Potongan*</label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-[#7d3feb]"
                  >
                    <option value="PERCENT">Persentase (%)</option>
                    <option value="FIXED">Nominal Tetap (Rp)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">
                    {discountType === 'PERCENT' ? 'Nilai Persen (%)*' : 'Nominal Potongan (Rp)*'}
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={discountType === 'PERCENT' ? 90 : 100000000}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    placeholder={discountType === 'PERCENT' ? 'Contoh: 15' : 'Contoh: 500000'}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#7d3feb]"
                  />
                </div>
              </div>

              {/* Deskripsi Kupon */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Deskripsi / Keterangan Voucher*</label>
                <textarea
                  rows={2}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Contoh: Voucher Diskon 15% untuk Kemitraan Korporasi Kawasan Industri"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-[#7d3feb]"
                />
              </div>

              {/* Minimal Luas Lahan Syarat */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span>Syarat Minimal Luas Lahan (m²)</span>
                  <span className="text-[10px] text-slate-400">Isi 0 jika berlaku semua luas</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={minAreaM2}
                  onChange={(e) => setMinAreaM2(Number(e.target.value))}
                  placeholder="0 (Semua luasan)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-[#7d3feb]"
                />
              </div>

              {/* Status Aktif Switch */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 block">Status Kupon Aktif</span>
                  <span className="text-[11px] text-slate-500">
                    Pelanggan dapat langsung memasukkan kode ini di formulir
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#7d3feb]" />
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#7d3feb] hover:bg-[#6f2cdb] text-white font-black shadow-md shadow-purple-500/25 transition active:scale-95"
                >
                  {editingCode ? 'Simpan Perubahan' : 'Terbitkan Kupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 text-base">Hapus Kupon Diskon?</h4>
              <p className="text-xs text-slate-500">
                Apakah Anda yakin ingin menghapus kupon <strong className="font-mono text-slate-900">{deletingCode}</strong>? Pelanggan tidak akan dapat lagi menggunakan kode ini.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDeletingCode(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-700 transition"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow transition"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
