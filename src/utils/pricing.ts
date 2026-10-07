export interface AssessmentFactorInput {
  rdtr: number; // 1 (Tersedia) | 5 (Tidak Tersedia)
  regional: number; // 5 (Reg 1: Jawa, Bali, Sumatera) | 3 (Reg 2: Kalimantan, Sulawesi, NT) | 1 (Reg 3: Maluku, Papua)
  bpn: number; // 1 (Tersedia) | 5 (Tidak Tersedia)
  documents: number; // 1 (Tersedia) | 5 (Tidak Tersedia)
  areaScale: number; // 1 (0-500) | 2 (500-2k) | 3 (2k-10k) | 4 (10k-20k) | 5 (>20k m2)
  kbliRisk: number; // 1 (Rendah) | 2 (Menengah Rendah) | 4 (Menengah Tinggi) | 5 (Tinggi)
}

export interface PromoCoupon {
  code: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  description: string;
  isActive?: boolean;
  minAreaM2?: number;
  createdAt?: string;
  createdBy?: string;
}

export const DEFAULT_COUPONS: Record<string, PromoCoupon> = {
  'DISKON10': {
    code: 'DISKON10',
    discountType: 'PERCENT',
    discountValue: 10,
    description: 'Diskon Spesial 10% Semua Luasan Proyek',
    isActive: true,
  },
  'MAPCOURSE20': {
    code: 'MAPCOURSE20',
    discountType: 'PERCENT',
    discountValue: 20,
    description: 'Promo Eksklusif Kemitraan MAP COURSE (Diskon 20%)',
    isActive: true,
  },
  'LAUNCH1JT': {
    code: 'LAUNCH1JT',
    discountType: 'FIXED',
    discountValue: 1000000,
    description: 'Potongan Khusus Peluncuran Rp 1.000.000',
    isActive: true,
  },
};

// Compatibility alias
export const AVAILABLE_COUPONS = DEFAULT_COUPONS;

/**
 * Mengambil seluruh daftar kupon diskon (gabungan default + custom dari staff)
 */
export function getAllCoupons(): Record<string, PromoCoupon> {
  const result: Record<string, PromoCoupon> = { ...DEFAULT_COUPONS };
  try {
    const custom = JSON.parse(localStorage.getItem('mapcourse_custom_discounts') || '{}');
    Object.keys(custom).forEach((k) => {
      const code = k.trim().toUpperCase();
      result[code] = custom[k];
    });
  } catch (err) {
    console.warn('[Pricing] Error loading custom coupons:', err);
  }
  return result;
}

/**
 * Mencari kupon yang sedang aktif dan valid
 */
export function findActiveCoupon(code: string): PromoCoupon | null {
  if (!code) return null;
  const cleanCode = code.trim().toUpperCase();
  const all = getAllCoupons();
  const coupon = all[cleanCode];
  if (!coupon) return null;
  if (coupon.isActive === false) return null;
  return coupon;
}

/**
 * Menyimpan kupon baru/update ke local cache
 */
export function saveCustomCoupon(coupon: PromoCoupon): void {
  try {
    const custom = JSON.parse(localStorage.getItem('mapcourse_custom_discounts') || '{}');
    const cleanCode = coupon.code.trim().toUpperCase();
    custom[cleanCode] = {
      ...coupon,
      code: cleanCode,
      isActive: coupon.isActive ?? true,
      createdAt: coupon.createdAt || new Date().toISOString(),
    };
    localStorage.setItem('mapcourse_custom_discounts', JSON.stringify(custom));
  } catch (err) {
    console.warn('[Pricing] Error saving custom coupon:', err);
  }
}

/**
 * Menghapus kupon dari local cache
 */
export function deleteCustomCoupon(code: string): void {
  try {
    const cleanCode = code.trim().toUpperCase();
    const custom = JSON.parse(localStorage.getItem('mapcourse_custom_discounts') || '{}');
    delete custom[cleanCode];
    localStorage.setItem('mapcourse_custom_discounts', JSON.stringify(custom));
  } catch (err) {
    console.warn('[Pricing] Error deleting custom coupon:', err);
  }
}

export interface PricingCalculationResult {
  isAbove3000m2: boolean;
  baseTierPrice?: number;
  factorsBreakdown?: {
    rdtr: { label: string; value: number; weight: number; subtotal: number };
    regional: { label: string; value: number; weight: number; subtotal: number };
    bpn: { label: string; value: number; weight: number; subtotal: number };
    documents: { label: string; value: number; weight: number; subtotal: number };
    areaScale: { label: string; value: number; weight: number; subtotal: number };
    kbliRisk: { label: string; value: number; weight: number; subtotal: number };
  };
  totalDifficultyScore: number;
  basePriceMultiplier: number; // Rp 1.500.000
  subtotal: number;
  discountCode?: string;
  discountAmount: number;
  finalPrice: number;
  appliedCoupon?: PromoCoupon;
}

export const BASE_PRICE_MULTIPLIER = 1500000;

export function getAreaScaleFactor(areaM2: number): number {
  if (areaM2 <= 500) return 1;
  if (areaM2 <= 2000) return 2;
  if (areaM2 <= 10000) return 3;
  if (areaM2 <= 20000) return 4;
  return 5;
}

export function calculateOrderPrice(
  areaM2: number,
  factors?: Partial<AssessmentFactorInput>,
  discountCode?: string,
  customDiscount?: number
): PricingCalculationResult {
  const isAbove3000m2 = areaM2 > 3000;
  let subtotal = 1500000;
  let totalScore = 1;
  let factorsBreakdown: any = undefined;

  if (!isAbove3000m2) {
    if (areaM2 < 100) {
      subtotal = 1500000;
    } else if (areaM2 <= 1000) {
      subtotal = 2000000;
    } else if (areaM2 <= 2000) {
      subtotal = 2500000;
    } else {
      subtotal = 3000000;
    }
  } else {
    // 6 Faktor Penilai
    const rdtrVal = factors?.rdtr ?? 5;
    const regVal = factors?.regional ?? 5;
    const bpnVal = factors?.bpn ?? 5;
    const docVal = factors?.documents ?? 1;
    const areaVal = factors?.areaScale ?? getAreaScaleFactor(areaM2);
    const kbliVal = factors?.kbliRisk ?? 5;

    const rdtrSub = Number((rdtrVal * 0.05).toFixed(4));
    const regSub = Number((regVal * 0.10).toFixed(4));
    const bpnSub = Number((bpnVal * 0.05).toFixed(4));
    const docSub = Number((docVal * 0.05).toFixed(4));
    const areaSub = Number((areaVal * 0.45).toFixed(4));
    const kbliSub = Number((kbliVal * 0.30).toFixed(4));

    totalScore = Number((rdtrSub + regSub + bpnSub + docSub + areaSub + kbliSub).toFixed(2));
    subtotal = Math.round(totalScore * BASE_PRICE_MULTIPLIER);

    factorsBreakdown = {
      rdtr: {
        label: rdtrVal === 1 ? 'Tersedia' : 'Tidak Tersedia',
        value: rdtrVal,
        weight: 0.05,
        subtotal: rdtrSub,
      },
      regional: {
        label: regVal === 5 ? 'Regional 1 (Jawa, Bali, Sumatera)' : regVal === 3 ? 'Regional 2 (Kalimantan, Sulawesi, NT)' : 'Regional 3 (Maluku, Papua)',
        value: regVal,
        weight: 0.10,
        subtotal: regSub,
      },
      bpn: {
        label: bpnVal === 1 ? 'Tersedia' : 'Tidak Tersedia',
        value: bpnVal,
        weight: 0.05,
        subtotal: bpnSub,
      },
      documents: {
        label: docVal === 1 ? 'Tersedia (SHM/SHGB/Sewa)' : 'Tidak Tersedia',
        value: docVal,
        weight: 0.05,
        subtotal: docSub,
      },
      areaScale: {
        label: areaVal === 1 ? '0-500 m²' : areaVal === 2 ? '500-2.000 m²' : areaVal === 3 ? '2.000-10.000 m²' : areaVal === 4 ? '10.000-20.000 m²' : '>20.000 m² / 2 Ha',
        value: areaVal,
        weight: 0.45,
        subtotal: areaSub,
      },
      kbliRisk: {
        label: kbliVal === 1 ? 'Resiko Rendah' : kbliVal === 2 ? 'Resiko Menengah Rendah' : kbliVal === 4 ? 'Resiko Menengah Tinggi' : 'Resiko Tinggi',
        value: kbliVal,
        weight: 0.30,
        subtotal: kbliSub,
      }
    };
  }

  // Hitung Diskon dari Kupon Aktif
  let discountAmount = 0;
  let appliedCoupon: PromoCoupon | undefined = undefined;

  if (discountCode) {
    const coupon = findActiveCoupon(discountCode);
    if (coupon) {
      // Periksa minimal luas jika ada
      if (!coupon.minAreaM2 || areaM2 >= coupon.minAreaM2) {
        appliedCoupon = coupon;
        if (coupon.discountType === 'PERCENT') {
          discountAmount = Math.round((subtotal * coupon.discountValue) / 100);
        } else {
          discountAmount = coupon.discountValue;
        }
      }
    }
  }

  if (customDiscount && customDiscount > 0) {
    discountAmount = Math.max(discountAmount, customDiscount);
  }

  // Final Price cannot be less than 0
  const finalPrice = Math.max(0, subtotal - discountAmount);

  return {
    isAbove3000m2,
    baseTierPrice: !isAbove3000m2 ? subtotal : undefined,
    factorsBreakdown,
    totalDifficultyScore: totalScore,
    basePriceMultiplier: BASE_PRICE_MULTIPLIER,
    subtotal,
    discountCode: appliedCoupon ? appliedCoupon.code : (customDiscount ? 'MANUAL_DISCOUNT' : undefined),
    discountAmount,
    finalPrice,
    appliedCoupon,
  };
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}
