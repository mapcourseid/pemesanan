export interface AssessmentFactorInput {
  rdtr: number;
  regional: number;
  bpn: number;
  documents: number;
  areaScale: number;
  kbliRisk: number;
}

export const AVAILABLE_COUPONS: Record<string, { code: string; discountType: 'PERCENT' | 'FIXED'; discountValue: number }> = {
  'PROMOATR': { code: 'PROMOATR', discountType: 'FIXED', discountValue: 500000 },
  'DISKON10': { code: 'DISKON10', discountType: 'PERCENT', discountValue: 10 },
  'MAPCOURSE20': { code: 'MAPCOURSE20', discountType: 'PERCENT', discountValue: 20 },
  'LAUNCH1JT': { code: 'LAUNCH1JT', discountType: 'FIXED', discountValue: 1000000 },
};

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
) {
  const isAbove3000m2 = areaM2 > 3000;
  let subtotal = 1500000;
  let totalScore = 1;

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
  }

  let discountAmount = 0;
  let validCode: string | undefined = undefined;

  if (discountCode) {
    const cleanCode = discountCode.trim().toUpperCase();
    if (AVAILABLE_COUPONS[cleanCode]) {
      const coupon = AVAILABLE_COUPONS[cleanCode];
      validCode = coupon.code;
      if (coupon.discountType === 'PERCENT') {
        discountAmount = Math.round((subtotal * coupon.discountValue) / 100);
      } else {
        discountAmount = coupon.discountValue;
      }
    }
  }

  if (customDiscount && customDiscount > 0) {
    discountAmount = Math.max(discountAmount, customDiscount);
    if (!validCode) validCode = 'MANUAL_DISCOUNT';
  }

  const finalPrice = Math.max(0, subtotal - discountAmount);

  return {
    isAbove3000m2,
    totalDifficultyScore: totalScore,
    basePriceMultiplier: BASE_PRICE_MULTIPLIER,
    subtotal,
    discountCode: validCode,
    discountAmount,
    finalPrice,
  };
}
