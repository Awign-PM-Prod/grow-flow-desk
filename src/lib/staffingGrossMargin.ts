/**
 * Gross margin for Staffing revenue section types A, B, and C.
 * Formula (each type): (ACV × GM%) / 100.
 */

export function computeStaffingGrossMarginTypeA(input: {
  acv: number;
  gmPercent: number;
}): number {
  return (input.acv * input.gmPercent) / 100;
}

export function computeStaffingGrossMarginTypeB(input: {
  acv: number;
  gmPercent: number;
}): number {
  return (input.acv * input.gmPercent) / 100;
}

export function computeStaffingGrossMarginTypeC(input: {
  acv: number;
  gmPercent: number;
}): number {
  return (input.acv * input.gmPercent) / 100;
}
