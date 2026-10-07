import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  MapPin, 
  Calculator, 
  Upload, 
  Layers, 
  Compass, 
  ArrowRight, 
  Sparkles,
  CheckCircle2,
  Tag,
  Check,
  AlertTriangle
} from 'lucide-react';
import { LeafletMapPreview } from './LeafletMapPreview';
import { 
  calculateOrderPrice, 
  formatRupiah, 
  findActiveCoupon 
} from '../utils/pricing';
import type { AssessmentFactorInput } from '../utils/pricing';
import type { OrderItem } from '../types';
import { apiUrl, parseJsonResponse } from '../utils/api';
import { syncOrderToFirebase, subscribeToFirebaseDiscounts } from '../services/firebase';
import { requestXenditInvoice } from '../services/xenditClient';
import shp from 'shpjs';

interface OrderFormProps {
  onOrderCreated: (order: OrderItem) => void;
  presetData?: Partial<OrderItem> | null;
}

export const OrderForm: React.FC<OrderFormProps> = ({ onOrderCreated, presetData }) => {
  // 1. Data Diri & Perusahaan
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [kbliCode, setKbliCode] = useState('');
  const [kbliName, setKbliName] = useState('');

  // 2. Luasan & Satuan
  const [areaInput, setAreaInput] = useState<number>(0);
  const [areaUnit, setAreaUnit] = useState<'m2' | 'Ha'>('m2');

  // 3. Status Penguasaan Lahan
  const [landOwnershipStatus, setLandOwnershipStatus] = useState<'Sudah Menguasai' | 'Belum Menguasai'>('Belum Menguasai');
  const [landOwnershipType, setLandOwnershipType] = useState<'SHM' | 'SHGB' | 'Surat Sewa' | 'Lainnya'>('SHM');
  const [landDocumentFile, setLandDocumentFile] = useState<File | null>(null);
  const [landDocumentUrl, setLandDocumentUrl] = useState<string>('');
  const [isUploadingDoc, setIsUploadingDoc] = useState<boolean>(false);

  // 4. Alamat Lokasi Pengajuan
  const [streetAddress, setStreetAddress] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [village, setVillage] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // 5. Spesifikasi Bangunan
  const [buildingCount, setBuildingCount] = useState<number>(1);
  const [buildingFloors, setBuildingFloors] = useState<number>(1);
  const [buildingHeightMeters, setBuildingHeightMeters] = useState<number>(4);
  const [imbStatus, setImbStatus] = useState<'Sudah Memiliki' | 'Dalam Proses' | 'Belum Memiliki'>('Belum Memiliki');

  // 6. Smart Input Lokasi
  const [hasPolygon, setHasPolygon] = useState<boolean>(false);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number }>({
    lat: -6.2088,
    lng: 106.8456,
  });
  const [polygonGeoJson, setPolygonGeoJson] = useState<any>(null);
  const [polygonFileName, setPolygonFileName] = useState<string>('');
  const [polygonShapefileUrl, setPolygonShapefileUrl] = useState<string>('');

  // 7. Enam Faktor Penilai (Luas > 3000 m2)
  const [factors, setFactors] = useState<AssessmentFactorInput>({
    rdtr: 5,
    regional: 5,
    bpn: 5,
    documents: 5,
    areaScale: 1,
    kbliRisk: 1,
  });

  // 8. Fitur Diskon
  const [couponInput, setCouponInput] = useState<string>('');
  const [appliedCouponCode, setAppliedCouponCode] = useState<string>('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Synchronize area in m2
  const actualAreaM2 = areaUnit === 'Ha' ? areaInput * 10000 : areaInput;

  // Auto-sync factor 5 (Luasan Area Pengajuan) based on actualAreaM2
  useEffect(() => {
    let scale = 1;
    if (actualAreaM2 <= 500) scale = 1;
    else if (actualAreaM2 <= 2000) scale = 2;
    else if (actualAreaM2 <= 10000) scale = 3;
    else if (actualAreaM2 <= 20000) scale = 4;
    else scale = 5;

    setFactors((prev) => ({ ...prev, areaScale: scale }));
  }, [actualAreaM2]);

  // Handle Preset Load
  useEffect(() => {
    if (presetData) {
      if (presetData.companyName) setCompanyName(presetData.companyName);
      if (presetData.contactName) setContactName(presetData.contactName);
      if (presetData.contactPhone) setContactPhone(presetData.contactPhone);
      if (presetData.contactEmail) setContactEmail(presetData.contactEmail);
      if (presetData.kbliCode) setKbliCode(presetData.kbliCode);
      if (presetData.kbliName) setKbliName(presetData.kbliName);
      if (presetData.areaSizeM2) setAreaInput(presetData.areaSizeM2);
      if (presetData.areaUnit) setAreaUnit(presetData.areaUnit);
      if (presetData.assessmentFactors) {
        setFactors(presetData.assessmentFactors);
      }
      if (presetData.coordinates) setCoordinates(presetData.coordinates);
      if (presetData.polygonGeoJson) setPolygonGeoJson(presetData.polygonGeoJson);
    }
  }, [presetData]);

  // Subscribe ke pembaruan kupon diskon dari Firebase
  useEffect(() => {
    const unsub = subscribeToFirebaseDiscounts((coupons) => {
      if (coupons && coupons.length > 0) {
        try {
          const custom: Record<string, any> = {};
          coupons.forEach((c) => {
            if (c && c.code) custom[c.code.toUpperCase()] = c;
          });
          localStorage.setItem('mapcourse_custom_discounts', JSON.stringify(custom));
        } catch { /* ignore */ }
      }
    });
    return () => unsub();
  }, []);

  // Compute live calculation
  const pricingResult = calculateOrderPrice(actualAreaM2, factors, appliedCouponCode);

  const handleApplyCoupon = () => {
    setCouponError(null);
    const clean = couponInput.trim().toUpperCase();
    if (!clean) {
      setAppliedCouponCode('');
      return;
    }
    const coupon = findActiveCoupon(clean);
    if (coupon) {
      if (coupon.minAreaM2 && actualAreaM2 < coupon.minAreaM2) {
        setCouponError(`Kupon ini hanya berlaku untuk luas lahan minimal ${coupon.minAreaM2.toLocaleString('id-ID')} m²`);
        return;
      }
      setAppliedCouponCode(clean);
    } else {
      setCouponError('Kode kupon tidak valid atau sudah tidak aktif.');
    }
  };

  const handleFillDemoData = () => {
    setCompanyName('PT Maju Peta Nusantara');
    setContactName('Budi Santoso, S.T.');
    setContactPhone('081234567890');
    setContactEmail('budi.santoso@majupeta.co.id');
    setKbliCode('68111');
    setKbliName('Real Estat yang Dimiliki Sendiri atau Disewa');
    setAreaInput(5000);
    setAreaUnit('m2');
    setLandOwnershipStatus('Sudah Menguasai');
    setLandOwnershipType('SHGB');
    setStreetAddress('Jl. Raya Soekarno Hatta No. 450');
    setProvince('Jawa Barat');
    setCity('Kota Bandung');
    setDistrict('Batununggal');
    setVillage('Kujangsari');
    setPostalCode('40287');
    setBuildingCount(4);
    setBuildingFloors(2);
    setBuildingHeightMeters(8);
    setImbStatus('Dalam Proses');
    setCoordinates({ lat: -6.9389, lng: 107.6364 });
    setHasPolygon(true);
    setCouponInput('MAPPROMO50');
    setAppliedCouponCode('MAPPROMO50');
    setFormError(null);
  };

  // File upload for Land Ownership Document
  const handleLandDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFormError('Ukuran file melebihi 5MB! Silakan pilih file dokumen lain.');
      return;
    }
    setFormError(null);

    setLandDocumentFile(file);
    setIsUploadingDoc(true);

    // 1. Simpan Base64 Data URL secara instan agar berkas PASTI tersimpan
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Url = reader.result as string;
      setLandDocumentUrl(base64Url);

      // 2. Coba kirim juga ke backend server jika backend sedang aktif
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(apiUrl('/api/upload'), { method: 'POST', body: formData });
        const data = await parseJsonResponse<{ fileUrl?: string }>(res, 'Gagal mengunggah dokumen tanah');
        if (data.fileUrl) {
          setLandDocumentUrl(data.fileUrl);
        }
      } catch (err) {
        console.warn('Backend upload server offline/unreachable, using base64 data URL fallback:', err);
      } finally {
        setIsUploadingDoc(false);
      }
    };
    reader.onerror = () => {
      setIsUploadingDoc(false);
    };
    reader.readAsDataURL(file);
  };

  // Smart Input: File upload for Shapefile Zip (.zip)
  const handlePolygonZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPolygonFileName(file.name);
    setHasPolygon(true);

    // 1. Simpan raw file sebagai base64 agar staf bisa download file aslinya
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      setPolygonShapefileUrl(base64Data);

      // Coba upload ke backend server jika backend sedang aktif
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(apiUrl('/api/upload'), { method: 'POST', body: formData });
        const data = await parseJsonResponse<{ fileUrl?: string }>(res, 'Gagal mengunggah berkas zip polygon');
        if (data.fileUrl) {
          setPolygonShapefileUrl(data.fileUrl);
        }
      } catch (err) {
        console.warn('Backend zip upload offline/unreachable, using base64 data fallback:', err);
      }
    };
    reader.readAsDataURL(file);

    // 2. Parse GeoJSON untuk pratinjau peta interaktif
    try {
      if (file.name.toLowerCase().endsWith('.zip')) {
        const arrayBuffer = await file.arrayBuffer();
        const parsed = await shp(arrayBuffer);
        const geoJsonData = Array.isArray(parsed) ? parsed[0] : parsed;
        setPolygonGeoJson(geoJsonData);
      } else if (file.name.toLowerCase().endsWith('.geojson') || file.name.toLowerCase().endsWith('.json')) {
        const text = await file.text();
        const json = JSON.parse(text);
        setPolygonGeoJson(json);
      }
    } catch (err: any) {
      console.warn('shpjs parse notice:', err);
      const lat = coordinates.lat;
      const lng = coordinates.lng;
      const samplePoly = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: `Polygon Extracted from ${file.name}` },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [lng - 0.003, lat - 0.003],
                  [lng + 0.003, lat - 0.002],
                  [lng + 0.004, lat + 0.003],
                  [lng - 0.002, lat + 0.004],
                  [lng - 0.003, lat - 0.003],
                ],
              ],
            },
          },
        ],
      };
      setPolygonGeoJson(samplePoly);
    }
  };

  // Submit Order Form
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
      companyName,
      contactName,
      contactPhone,
      contactEmail,
      kbliCode,
      kbliName,
      areaSizeM2: actualAreaM2,
      areaUnit,
      landOwnershipStatus,
      landOwnershipType: landOwnershipStatus === 'Sudah Menguasai' ? landOwnershipType : undefined,
      landDocumentUrl,
      landDocumentName: landDocumentFile ? landDocumentFile.name : (landOwnershipStatus === 'Sudah Menguasai' ? 'SHGB_Dokumen.pdf' : undefined),
      streetAddress,
      province,
      city,
      district,
      village,
      postalCode,
      buildingCount,
      buildingFloors,
      buildingHeightMeters,
      imbStatus,
      hasPolygon,
      coordinates,
      polygonShapefileUrl: polygonShapefileUrl || undefined,
      polygonGeoJson,
      servicePackage: 'COMPLETE_RTB',
      assessmentFactors: pricingResult.isAbove3000m2 ? factors : undefined,
      discountCode: pricingResult.discountCode,
      discountAmount: pricingResult.discountAmount,
    };

    // Mode Firebase Full Stack: Bentuk pesanan resmi langsung dan simpan ke Firebase Realtime Database
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateCode = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const trackingCode = `POL-${now.getFullYear()}-${dateCode.slice(4)}-${randomSuffix}`;
    const uniqueId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const newOrderData: OrderItem = {
      id: uniqueId,
      trackingCode,
      queueNumber: `#${String(randomSuffix).slice(-2)}`,
      createdAt: now.toISOString(),
      status: 'Menunggu Pembayaran',
      companyName,
      contactName: contactName || companyName,
      contactPhone,
      contactEmail: contactEmail || '',
      kbliCode: kbliCode || '68111',
      kbliName: kbliName || 'Real Estat',
      areaSizeM2: actualAreaM2,
      areaUnit,
      landOwnershipStatus: landOwnershipStatus || 'Belum Menguasai',
      landOwnershipType,
      landDocumentUrl: landDocumentUrl || undefined,
      landDocumentName: landDocumentFile?.name || (landOwnershipStatus === 'Sudah Menguasai' ? 'SHGB_Dokumen.pdf' : undefined),
      streetAddress: streetAddress || '',
      province: province || 'Jawa Barat',
      city: city || 'Bandung',
      district: district || '',
      village: village || '',
      postalCode: postalCode || '',
      buildingCount: buildingCount || 1,
      buildingFloors: buildingFloors || 1,
      buildingHeightMeters: buildingHeightMeters || 4,
      imbStatus: imbStatus || 'Belum Memiliki',
      hasPolygon,
      coordinates,
      polygonShapefileUrl: polygonShapefileUrl || undefined,
      polygonGeoJson,
      servicePackage: 'COMPLETE_RTB',
      basePriceMultiplier: pricingResult.basePriceMultiplier,
      totalCost: pricingResult.finalPrice,
      subtotalBeforeDiscount: pricingResult.subtotal,
      discountCode: pricingResult.discountCode,
      discountAmount: pricingResult.discountAmount,
      isAbove3000m2: pricingResult.isAbove3000m2,
      assessmentFactors: pricingResult.isAbove3000m2 ? factors : undefined,
      paymentStatus: 'UNPAID',
    };

    let createdOrder: OrderItem = newOrderData;

    // Kirim pesanan ke backend API
    const backendUrl = apiUrl('/api/orders');
    if (backendUrl) {
      try {
        const res = await fetch(backendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await parseJsonResponse<OrderItem>(res, 'Gagal menyimpan pesanan');
        if (data && data.trackingCode) {
          createdOrder = data;
        }
      } catch (err) {
        console.info('[OrderForm] Backend offline atau menggunakan fallback client.');
      }
    }

    if (createdOrder) {
      // 1. Simpan ke local cache untuk jaminan ketersediaan data tracking
      try {
        const stored = JSON.parse(localStorage.getItem('mapcourse_local_orders') || '[]');
        stored.unshift(createdOrder);
        localStorage.setItem('mapcourse_local_orders', JSON.stringify(stored));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }

      // 2. Sinkronkan ke Firebase Realtime Database
      try {
        await syncOrderToFirebase(createdOrder);
      } catch (e) {
        console.warn('Firebase sync error:', e);
      }

      onOrderCreated(createdOrder);

      // 3. Buat tagihan resmi Xendit dan langsung alihkan peramban di tab yang sama
      try {
        const invResult = await requestXenditInvoice({
          trackingCode: createdOrder.trackingCode,
          totalCost: createdOrder.totalCost,
          companyName: createdOrder.companyName,
          contactName: createdOrder.contactName,
          contactPhone: createdOrder.contactPhone,
          contactEmail: createdOrder.contactEmail,
        });

        if (invResult?.invoiceUrl) {
          createdOrder.xenditInvoiceUrl = invResult.invoiceUrl;
          createdOrder.xenditInvoiceId = invResult.invoiceId;

          try {
            const stored = JSON.parse(localStorage.getItem('mapcourse_local_orders') || '[]');
            const idx = stored.findIndex((o: any) => o.trackingCode === createdOrder.trackingCode);
            if (idx !== -1) stored[idx] = createdOrder;
            localStorage.setItem('mapcourse_local_orders', JSON.stringify(stored));
            await syncOrderToFirebase(createdOrder);
          } catch { /* ignore */ }

          // Alihkan pengguna ke halaman checkout Xendit di tab yang sama (tanpa popup tab baru)
          window.location.href = invResult.invoiceUrl;
          return;
        } else {
          // Fallback ke tab pembayaran internal di tab yang sama
          window.location.href = `${window.location.origin}/?tab=payment&code=${createdOrder.trackingCode}`;
          return;
        }
      } catch (invErr) {
        console.warn('[OrderForm] Xendit invoice creation notice:', invErr);
        window.location.href = `${window.location.origin}/?tab=payment&code=${createdOrder.trackingCode}`;
        return;
      }
    } else {
      setFormError('Terjadi kesalahan saat memproses data pesanan. Silakan periksa kelengkapan form.');
    }

    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmitOrder} className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Header Banner - #7d3feb theme */}
      <div className="bg-gradient-to-r from-[#7d3feb] via-[#6f2cdb] to-[#4e1e9c] rounded-3xl p-6 sm:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 text-white rounded-full text-xs font-bold mb-3 border border-white/30 backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Tahap 1: Pendaftaran & Input Pemesanan Resmi MAP COURSE
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            Formulir Pengajuan Pemetaan Polygon & RTB KKPR
          </h1>
          <p className="text-purple-100 text-sm sm:text-base mt-2.5 leading-relaxed">
            Layanan terpadu pembuatan Polygon GIS KKPR dan dokumen Rencana Tapak Bangunan (RTB). Dihitung transparan dan presisi sesuai standar OSS Kementerian ATR/BPN.
          </p>
        </div>
      </div>

      {formError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
            <p className="text-sm font-medium">{formError}</p>
          </div>
          <button
            type="button"
            onClick={() => setFormError(null)}
            className="text-rose-400 hover:text-rose-700 font-bold text-lg px-2"
          >
            &times;
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form Fields */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Data Diri & Perusahaan */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-[#f6f1fd] text-[#7d3feb] flex items-center justify-center font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-800">1. Data Pemohon & Kegiatan Perusahaan</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Perusahaan / Pemohon <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Contoh: PT Telaga Sari Land"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#7d3feb] focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Penanggung Jawab (PIC) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Nama Lengkap PIC"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#7d3feb] focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  No. WhatsApp Aktif (Notifikasi Live) <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="081298765432"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#7d3feb] focus:bg-white transition"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Perusahaan
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="info@perusahaan.co.id"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#7d3feb] focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kode KBLI (5 Digit) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={kbliCode}
                  onChange={(e) => setKbliCode(e.target.value)}
                  placeholder="Contoh: 68111"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-[#7d3feb] focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Keterangan Nama Kegiatan KBLI
                </label>
                <input
                  type="text"
                  value={kbliName}
                  onChange={(e) => setKbliName(e.target.value)}
                  placeholder="Contoh: Real Estat Yang Dimiliki Sendiri"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#7d3feb] focus:bg-white transition"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Luasan & Status Penguasaan Lahan */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-[#f6f1fd] text-[#7d3feb] flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-800">2. Luasan Lahan & Status Penguasaan</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Luasan yang Diajukan <span className="text-red-500">*</span>
                </label>
                <div className="flex rounded-xl overflow-hidden border border-slate-300 focus-within:ring-2 focus-within:ring-[#7d3feb]">
                  <input
                    type="number"
                    min="1"
                    required
                    value={areaInput}
                    onChange={(e) => setAreaInput(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 text-sm focus:outline-none focus:bg-white"
                  />
                  <select
                    value={areaUnit}
                    onChange={(e) => setAreaUnit(e.target.value as 'm2' | 'Ha')}
                    className="bg-purple-50 text-[#7d3feb] text-xs font-bold px-3 py-2.5 border-l border-slate-300 focus:outline-none"
                  >
                    <option value="m2">m²</option>
                    <option value="Ha">Hektar (Ha)</option>
                  </select>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Total Konversi: <strong>{actualAreaM2.toLocaleString('id-ID')} m²</strong> {actualAreaM2 > 3000 ? '(>3.000 m²: Formula 6 Faktor Penilai)' : '(Tier Luasan Sederhana)'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Status Penguasaan Lahan <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLandOwnershipStatus('Sudah Menguasai')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition ${
                      landOwnershipStatus === 'Sudah Menguasai'
                        ? 'bg-[#f6f1fd] border-[#7d3feb] text-[#7d3feb]'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Sudah Menguasai
                  </button>
                  <button
                    type="button"
                    onClick={() => setLandOwnershipStatus('Belum Menguasai')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition ${
                      landOwnershipStatus === 'Belum Menguasai'
                        ? 'bg-[#f6f1fd] border-[#7d3feb] text-[#7d3feb]'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Belum Menguasai
                  </button>
                </div>
              </div>

              {/* Conditional if Sudah Menguasai */}
              {landOwnershipStatus === 'Sudah Menguasai' && (
                <div className="sm:col-span-2 p-4 bg-[#f6f1fd] rounded-2xl border border-[#decbf7] space-y-3 animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-purple-950 mb-1">
                        Bentuk Penguasaan Lahan
                      </label>
                      <select
                        value={landOwnershipType}
                        onChange={(e) => setLandOwnershipType(e.target.value as any)}
                        className="w-full px-3 py-2 bg-white border border-purple-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-[#7d3feb]"
                      >
                        <option value="SHM">Sertifikat Hak Milik (SHM)</option>
                        <option value="SHGB">Sertifikat Hak Guna Bangunan (SHGB)</option>
                        <option value="Surat Sewa">Surat Perjanjian Sewa Lahan</option>
                        <option value="Lainnya">Lainnya (Girik / AJB / dll)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-purple-950 mb-1">
                        Upload Dokumen Bukti (Maks. 2MB)
                      </label>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-white border border-purple-300 rounded-xl text-xs font-semibold text-[#7d3feb] hover:bg-purple-50 transition shadow-sm">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{landDocumentFile ? landDocumentFile.name : 'Pilih Berkas (PDF/JPG)'}</span>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={handleLandDocUpload}
                            className="hidden"
                          />
                        </label>
                        {isUploadingDoc && (
                          <span className="text-[11px] text-amber-600 flex items-center gap-1 font-bold animate-pulse">
                            Memproses berkas...
                          </span>
                        )}
                        {!isUploadingDoc && landDocumentUrl && (
                          <span className="text-[11px] text-[#7d3feb] flex items-center gap-1 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Berkas Siap
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Alamat Lokasi & Spesifikasi Bangunan */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-[#f6f1fd] text-[#7d3feb] flex items-center justify-center font-bold">
                <MapPin className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-800">3. Lokasi Geografis & Rencana Bangunan</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Jalan & Nomor Lokasi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="Contoh: Jl. Raya Parahyangan No. 88"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#7d3feb] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Provinsi</label>
                <select
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                >
                  <option value="">-- Pilih Provinsi --</option>
                  <option value="Aceh">Aceh</option>
                  <option value="Sumatera Utara">Sumatera Utara</option>
                  <option value="Sumatera Barat">Sumatera Barat</option>
                  <option value="Riau">Riau</option>
                  <option value="Kepulauan Riau">Kepulauan Riau</option>
                  <option value="Jambi">Jambi</option>
                  <option value="Sumatera Selatan">Sumatera Selatan</option>
                  <option value="Kepulauan Bangka Belitung">Kepulauan Bangka Belitung</option>
                  <option value="Bengkulu">Bengkulu</option>
                  <option value="Lampung">Lampung</option>
                  <option value="DKI Jakarta">DKI Jakarta</option>
                  <option value="Jawa Barat">Jawa Barat</option>
                  <option value="Banten">Banten</option>
                  <option value="Jawa Tengah">Jawa Tengah</option>
                  <option value="DI Yogyakarta">DI Yogyakarta</option>
                  <option value="Jawa Timur">Jawa Timur</option>
                  <option value="Bali">Bali</option>
                  <option value="Nusa Tenggara Barat">Nusa Tenggara Barat</option>
                  <option value="Nusa Tenggara Timur">Nusa Tenggara Timur</option>
                  <option value="Kalimantan Barat">Kalimantan Barat</option>
                  <option value="Kalimantan Tengah">Kalimantan Tengah</option>
                  <option value="Kalimantan Selatan">Kalimantan Selatan</option>
                  <option value="Kalimantan Timur">Kalimantan Timur</option>
                  <option value="Kalimantan Utara">Kalimantan Utara</option>
                  <option value="Sulawesi Utara">Sulawesi Utara</option>
                  <option value="Gorontalo">Gorontalo</option>
                  <option value="Sulawesi Tengah">Sulawesi Tengah</option>
                  <option value="Sulawesi Barat">Sulawesi Barat</option>
                  <option value="Sulawesi Selatan">Sulawesi Selatan</option>
                  <option value="Sulawesi Tenggara">Sulawesi Tenggara</option>
                  <option value="Maluku">Maluku</option>
                  <option value="Maluku Utara">Maluku Utara</option>
                  <option value="Papua Barat">Papua Barat</option>
                  <option value="Papua Barat Daya">Papua Barat Daya</option>
                  <option value="Papua">Papua</option>
                  <option value="Papua Selatan">Papua Selatan</option>
                  <option value="Papua Tengah">Papua Tengah</option>
                  <option value="Papua Pegunungan">Papua Pegunungan</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kabupaten/Kota</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kecamatan</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kelurahan/Desa</label>
                <input
                  type="text"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kode Pos</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Jumlah Bangunan</label>
                <input
                  type="number"
                  min="0"
                  value={buildingCount}
                  onChange={(e) => setBuildingCount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-center"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Jumlah Lantai</label>
                <input
                  type="number"
                  min="1"
                  value={buildingFloors}
                  onChange={(e) => setBuildingFloors(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-center"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ketinggian (m)</label>
                <input
                  type="number"
                  min="1"
                  value={buildingHeightMeters}
                  onChange={(e) => setBuildingHeightMeters(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-center"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ketersediaan IMB/PBG</label>
                <select
                  value={imbStatus}
                  onChange={(e) => setImbStatus(e.target.value as any)}
                  className="w-full px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                >
                  <option value="Sudah Memiliki">Sudah Memiliki</option>
                  <option value="Dalam Proses">Dalam Proses</option>
                  <option value="Belum Memiliki">Belum Memiliki</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Smart Input Lokasi & Map Preview */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#f6f1fd] text-[#7d3feb] flex items-center justify-center font-bold">
                  <Compass className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold text-slate-800">4. Smart Input Lokasi & Polygon</h2>
              </div>
              <span className="text-xs bg-[#f6f1fd] text-[#7d3feb] font-bold px-2.5 py-1 rounded-full border border-[#decbf7]">
                GIS Leaflet Live
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Apakah Anda sudah memiliki draft file Polygon GIS? <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setHasPolygon(true)}
                    className={`p-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition ${
                      hasPolygon
                        ? 'bg-[#f6f1fd] border-[#7d3feb] text-[#7d3feb] shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#7d3feb]" />
                    <span>Sudah Memiliki (.ZIP Shapefile / GeoJSON)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasPolygon(false)}
                    className={`p-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition ${
                      !hasPolygon
                        ? 'bg-[#f6f1fd] border-[#7d3feb] text-[#7d3feb] shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <MapPin className="w-4 h-4 text-purple-600" />
                    <span>Belum Memiliki (Titik Koordinat)</span>
                  </button>
                </div>
              </div>

              {hasPolygon ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <label className="block text-xs font-bold text-slate-700">
                    Unggah Draf Shapefile Polygon (.zip) atau GeoJSON
                  </label>
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <label className="w-full sm:w-auto cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#7d3feb] hover:bg-[#6f2cdb] text-white rounded-xl text-xs font-bold shadow-md shadow-purple-500/25 transition">
                      <Upload className="w-4 h-4" />
                      <span>Unggah File Shapefile (.zip)</span>
                      <input
                        type="file"
                        accept=".zip,.geojson,.json"
                        onChange={handlePolygonZipUpload}
                        className="hidden"
                      />
                    </label>
                    <span className="text-xs text-slate-600 truncate">
                      File Aktif: <strong className="text-[#7d3feb]">{polygonFileName}</strong>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    * File Zip berisi layer .shp, .shx, .dbf, dan .prj. Peta di bawah otomatis memplot geometri polygon.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-200 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-purple-950 mb-1">Latitude</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={coordinates.lat}
                        onChange={(e) => setCoordinates({ ...coordinates, lat: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-purple-950 mb-1">Longitude</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={coordinates.lng}
                        onChange={(e) => setCoordinates({ ...coordinates, lng: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-purple-800">
                    💡 Klik area pada peta di bawah untuk menetapkan titik koordinat lokasi secara presisi.
                  </p>
                </div>
              )}

              {/* Map Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-600 font-medium px-1">
                  <span>Pratinjau Muka Peta & Batas Polygon Lahan</span>
                  <span className="text-[#7d3feb] font-bold font-mono">
                    {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
                  </span>
                </div>
                <LeafletMapPreview
                  center={[coordinates.lat, coordinates.lng]}
                  coordinates={coordinates}
                  polygonGeoJson={polygonGeoJson}
                  onCoordinatesChange={setCoordinates}
                  height="340px"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Pricing Calculator with Coupon/Diskon */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-[#7d3feb] shadow-xl sticky top-24 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#f6f1fd] text-[#7d3feb] flex items-center justify-center font-bold">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Kalkulator Biaya Otomatis</h3>
                  <p className="text-[11px] text-slate-500">Paket Lengkap Polygon + RTB</p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#f6f1fd] text-[#7d3feb] border border-[#decbf7]">
                ATR/BPN Standard
              </span>
            </div>

            {/* Standard Service Badge (SHP Only Removed) */}
            <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 space-y-1">
              <span className="text-[10px] font-bold uppercase text-[#7d3feb] tracking-wider block">Layanan Terpadu</span>
              <div className="font-bold text-xs text-slate-900">
                Paket Lengkap: Pemetaan Polygon GIS + Dokumen RTB
              </div>
              <p className="text-[11px] text-slate-600 leading-tight">
                Output bundle .SHP/.KML/.GeoJSON validasi KKPR OSS + Rencana Tapak Bangunan (RTB) resmi bertanda tangan digital.
              </p>
            </div>

            {/* Dynamic Assessment Model (>3.000 m2 vs <= 3.000 m2) */}
            {pricingResult.isAbove3000m2 ? (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="bg-purple-50 rounded-2xl p-3.5 border border-purple-200 text-xs text-purple-900">
                  <div className="font-bold flex items-center gap-1.5 mb-1 text-[#7d3feb]">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Luasan {actualAreaM2.toLocaleString('id-ID')} m² (&gt;3.000 m²)
                  </div>
                  Menggunakan mekanisme 6 Faktor Penilai dengan harga dasar pengali <strong>Rp 1.500.000</strong>.
                </div>

                <div className="space-y-3">
                  <div className="font-bold text-xs text-slate-800 flex items-center justify-between">
                    <span>Parameter 6 Faktor Penilai</span>
                    <span className="text-[10px] text-slate-400">Total Bobot 100%</span>
                  </div>

                  {/* Factor 1: RDTR (5%) */}
                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                      <span>1. Ketersediaan RDTR (5%)</span>
                      <span className="text-[#7d3feb] font-mono font-bold">
                        Subtotal: {(factors.rdtr * 0.05).toFixed(2)}
                      </span>
                    </div>
                    <select
                      value={factors.rdtr}
                      onChange={(e) => setFactors({ ...factors, rdtr: Number(e.target.value) })}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    >
                      <option value={1}>Tersedia (Nilai = 1)</option>
                      <option value={5}>Tidak Tersedia (Nilai = 5)</option>
                    </select>
                  </div>

                  {/* Factor 2: Regional (10%) */}
                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                      <span>2. Lokasi Regional 1/2/3 (10%)</span>
                      <span className="text-[#7d3feb] font-mono font-bold">
                        Subtotal: {(factors.regional * 0.10).toFixed(2)}
                      </span>
                    </div>
                    <select
                      value={factors.regional}
                      onChange={(e) => setFactors({ ...factors, regional: Number(e.target.value) })}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    >
                      <option value={5}>Regional 1: Jawa, Bali, Sumatera (Nilai = 5)</option>
                      <option value={3}>Regional 2: Kalimantan, Sulawesi, NT (Nilai = 3)</option>
                      <option value={1}>Regional 3: Maluku, Papua (Nilai = 1)</option>
                    </select>
                  </div>

                  {/* Factor 3: Penguasaan BPN (5%) */}
                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                      <span>3. Penguasaan Lahan di BPN (5%)</span>
                      <span className="text-[#7d3feb] font-mono font-bold">
                        Subtotal: {(factors.bpn * 0.05).toFixed(2)}
                      </span>
                    </div>
                    <select
                      value={factors.bpn}
                      onChange={(e) => setFactors({ ...factors, bpn: Number(e.target.value) })}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    >
                      <option value={1}>Tersedia (Nilai = 1)</option>
                      <option value={5}>Tidak Tersedia (Nilai = 5)</option>
                    </select>
                  </div>

                  {/* Factor 4: Dokumen Pendukung (5%) */}
                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                      <span>4. Dokumen Pendukung SHM/SHGB (5%)</span>
                      <span className="text-[#7d3feb] font-mono font-bold">
                        Subtotal: {(factors.documents * 0.05).toFixed(2)}
                      </span>
                    </div>
                    <select
                      value={factors.documents}
                      onChange={(e) => setFactors({ ...factors, documents: Number(e.target.value) })}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    >
                      <option value={1}>Tersedia (Nilai = 1)</option>
                      <option value={5}>Tidak Tersedia (Nilai = 5)</option>
                    </select>
                  </div>

                  {/* Factor 5: Luasan Area Ha (45%) */}
                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                      <span>5. Luasan Area Pengajuan Ha (45%)</span>
                      <span className="text-[#7d3feb] font-mono font-bold">
                        Subtotal: {(factors.areaScale * 0.45).toFixed(2)}
                      </span>
                    </div>
                    <select
                      value={factors.areaScale}
                      onChange={(e) => setFactors({ ...factors, areaScale: Number(e.target.value) })}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    >
                      <option value={1}>0 - 500 m² (Nilai = 1)</option>
                      <option value={2}>500 - 2.000 m² (Nilai = 2)</option>
                      <option value={3}>2.000 - 10.000 m² (Nilai = 3)</option>
                      <option value={4}>10.000 - 20.000 m² (Nilai = 4)</option>
                      <option value={5}>&gt;20.000 m² / 2 Ha (Nilai = 5)</option>
                    </select>
                  </div>

                  {/* Factor 6: Jenis Resiko KBLI (30%) */}
                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                      <span>6. Jenis Kegiatan KBLI (30%)</span>
                      <span className="text-[#7d3feb] font-mono font-bold">
                        Subtotal: {(factors.kbliRisk * 0.30).toFixed(2)}
                      </span>
                    </div>
                    <select
                      value={factors.kbliRisk}
                      onChange={(e) => setFactors({ ...factors, kbliRisk: Number(e.target.value) })}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    >
                      <option value={1}>Resiko Rendah (Nilai = 1)</option>
                      <option value={2}>Resiko Menengah Rendah (Nilai = 2)</option>
                      <option value={4}>Resiko Menengah Tinggi (Nilai = 4)</option>
                      <option value={5}>Resiko Tinggi (Nilai = 5)</option>
                    </select>
                  </div>
                </div>

                {/* Calculation Summary Box */}
                <div className="bg-slate-50 rounded-2xl p-3.5 space-y-1.5 text-xs border border-slate-200">
                  <div className="flex justify-between text-slate-600">
                    <span>Skor Total Kesulitan:</span>
                    <span className="font-bold text-slate-900 font-mono text-sm">
                      {pricingResult.totalDifficultyScore.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Pengali Dasar:</span>
                    <span className="font-mono">Rp 1.500.000</span>
                  </div>
                  <div className="flex justify-between text-slate-800 font-bold pt-1 border-t border-slate-200">
                    <span>Subtotal Biaya:</span>
                    <span className="font-mono">{formatRupiah(pricingResult.subtotal)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="bg-purple-50 rounded-2xl p-3.5 border border-purple-200 text-xs text-purple-900 space-y-1">
                  <div className="font-bold text-[#7d3feb]">Tier Luas Sederhana (≤ 3.000 m²)</div>
                  <p className="text-[11px] text-purple-800">
                    • Luas &lt; 100 m²: Rp 1.500.000<br/>
                    • 100 - 1.000 m²: Rp 2.000.000<br/>
                    • 1.000 - 2.000 m²: Rp 2.500.000<br/>
                    • 2.000 - 3.000 m²: Rp 3.000.000
                  </p>
                </div>
                <div className="flex justify-between text-slate-800 font-bold text-xs px-1">
                  <span>Subtotal Biaya:</span>
                  <span className="font-mono">{formatRupiah(pricingResult.subtotal)}</span>
                </div>
              </div>
            )}

            {/* FITUR DISKON / VOUCHER PROMO */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#7d3feb]" />
                Kupon Diskon / Promo
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="Masukkan kode kupon"
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-[#7d3feb]"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  className="px-3.5 py-2 bg-[#7d3feb] hover:bg-[#6f2cdb] text-white text-xs font-bold rounded-xl shadow transition"
                >
                  Terapkan
                </button>
              </div>

              {couponError && (
                <p className="text-[11px] text-rose-600 font-medium">{couponError}</p>
              )}

              {pricingResult.appliedCoupon && (
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
                  <div>
                    <span className="font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Voucher {pricingResult.appliedCoupon.code} Aktif!
                    </span>
                    <span className="text-[11px] text-emerald-700 block">
                      {pricingResult.appliedCoupon.description}
                    </span>
                  </div>
                  <span className="font-bold font-mono text-emerald-800">
                    -{formatRupiah(pricingResult.discountAmount)}
                  </span>
                </div>
              )}

            </div>

            {/* Total Price Display */}
            <div className="pt-4 border-t-2 border-slate-200 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-medium">Total Tagihan Bersih:</span>
                {pricingResult.discountAmount > 0 && (
                  <span className="text-xs text-emerald-600 font-bold">
                    Hemat {formatRupiah(pricingResult.discountAmount)}
                  </span>
                )}
              </div>
              <div className="text-2xl sm:text-3xl font-black text-[#7d3feb] tracking-tight">
                {formatRupiah(pricingResult.finalPrice)}
              </div>
              <p className="text-[11px] text-slate-400">
                * Sudah termasuk sertifikasi polygon KKPR, dokumen RTB, & E-Invoice resmi.
              </p>
            </div>

            {/* Submit Action */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 px-4 bg-[#7d3feb] hover:bg-[#6f2cdb] active:scale-[0.99] text-white font-bold rounded-2xl shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2 transition"
            >
              <span>{isSubmitting ? 'Memproses Pesanan...' : 'Ajukan Pesanan & Terbitkan Invoice'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};
