export type OrderStatus = 
  | 'Menunggu Pembayaran'
  | 'Verifikasi Berkas'
  | 'Olah Data Polygon'
  | 'Penyusunan Dokumen RTB'
  | 'Quality Control'
  | 'Selesai';

export interface AssessmentFactors {
  rdtr: number; // 1 (Tersedia) | 5 (Tidak Tersedia) [Bobot 5%]
  regional: number; // 5 (Reg 1) | 3 (Reg 2) | 1 (Reg 3) [Bobot 10%]
  bpn: number; // 1 (Tersedia) | 5 (Tidak Tersedia) [Bobot 5%]
  documents: number; // 1 (Tersedia) | 5 (Tidak Tersedia) [Bobot 5%]
  areaScale: number; // 1-5 [Bobot 45%]
  kbliRisk: number; // 1, 2, 4, 5 [Bobot 30%]
}

export interface OrderItem {
  id: string;
  trackingCode: string;
  queueNumber: string;
  createdAt: string;
  status: OrderStatus;
  
  // Data Diri & Perusahaan
  companyName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  kbliCode: string;
  kbliName: string;

  // Luasan & Penguasaan Lahan
  areaSizeM2: number;
  areaUnit: 'm2' | 'Ha';
  landOwnershipStatus: 'Sudah Menguasai' | 'Belum Menguasai';
  landOwnershipType?: 'SHM' | 'SHGB' | 'Surat Sewa' | 'Lainnya';
  landDocumentUrl?: string;
  landDocumentName?: string;

  // Alamat Pengajuan
  streetAddress: string;
  province: string;
  city: string;
  district: string;
  village: string;
  postalCode: string;

  // Bangunan
  buildingCount: number;
  buildingFloors: number;
  buildingHeightMeters: number;
  imbStatus: 'Sudah Memiliki' | 'Dalam Proses' | 'Belum Memiliki';

  // Smart Input Lokasi
  hasPolygon: boolean;
  coordinates?: {
    lat: number;
    lng: number;
  };
  polygonShapefileUrl?: string;
  polygonGeoJson?: any;

  // Biaya & Paket Layanan (Hanya Paket Lengkap Polygon + RTB)
  servicePackage: 'COMPLETE_RTB';
  isAbove3000m2: boolean;
  assessmentFactors?: AssessmentFactors;
  difficultyScore?: number;
  basePriceMultiplier: number;
  
  // Fitur Diskon
  subtotalBeforeDiscount: number;
  discountCode?: string;
  discountAmount: number;
  totalCost: number;

  // Pembayaran
  paymentStatus: 'UNPAID' | 'PAID';
  paymentMethod?: string;
  paidAt?: string;
  invoiceNumber?: string;
  xenditInvoiceId?: string;
  xenditInvoiceUrl?: string;

  // Tim GIS & Drafter Output Files
  gisResultFiles?: {
    zipShpUrl?: string;
    kmlUrl?: string;
    geoJsonUrl?: string;
    rtbPdfUrl?: string;
    completedAt?: string;
  };

  // Feedback Customer
  rating?: number;
  review?: string;
  feedbackSubmittedAt?: string;

  // Log Klarifikasi Tim GIS
  clarificationNotes?: Array<{
    id: string;
    timestamp: string;
    message: string;
    sender: string;
  }>;

  // Calculated Queue Info
  queuePosition?: number;
  aheadCount?: number;
}

export interface PromoCoupon {
  code: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number; // e.g. 10 for 10%, or 500000 for Rp 500.000
  description: string;
  minSpend?: number;
}
