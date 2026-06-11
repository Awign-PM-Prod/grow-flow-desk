import {
  computeStaffingGrossMarginTypeA,
  computeStaffingGrossMarginTypeB,
  computeStaffingGrossMarginTypeC,
} from "@/lib/staffingGrossMargin";

export type StaffingRevenueTypeAInputs = {
  headcount: number;
  salaryPayouts: number;
  programManagement: number;
  saasUsageFee: number;
  monthlyAgencyFeePercent: number;
  salesForceAutomationSetupFee: number;
  recruitmentCost: number;
  miscRecurring: number;
  miscOneTime: number;
  activeMonthsPerYear: number;
  gmPercent: number;
};

/** Type A MCV = per-head base + agency fee on same base + per-head misc recurring. */
export function computeStaffingMcvTypeA(input: {
  headcount: number;
  salaryPayouts: number;
  programManagement: number;
  saasUsageFee: number;
  monthlyAgencyFeePercent: number;
  miscRecurring: number;
}): number {
  const { headcount, salaryPayouts, programManagement, saasUsageFee, monthlyAgencyFeePercent, miscRecurring } =
    input;
  const agencyFeeBase = headcount * (salaryPayouts + saasUsageFee) + programManagement;
  return (
    agencyFeeBase +
    (agencyFeeBase * monthlyAgencyFeePercent) / 100 +
    headcount * miscRecurring
  );
}

/** Type A ACV = (MCV × active months) + ((SFA setup + recruitment) × headcount) + misc one-time. */
export function computeStaffingAcvTypeA(
  mcv: number,
  input: Pick<
    StaffingRevenueTypeAInputs,
    | "activeMonthsPerYear"
    | "salesForceAutomationSetupFee"
    | "recruitmentCost"
    | "headcount"
    | "miscOneTime"
  >,
): number {
  return (
    mcv * input.activeMonthsPerYear +
    (input.salesForceAutomationSetupFee + input.recruitmentCost) * input.headcount +
    input.miscOneTime
  );
}

export function computeStaffingRevenueTypeA(input: StaffingRevenueTypeAInputs) {
  const mcv = computeStaffingMcvTypeA(input);
  const acv = computeStaffingAcvTypeA(mcv, input);
  const grossMargin = computeStaffingGrossMarginTypeA({ acv, gmPercent: input.gmPercent });
  return { mcv, acv, grossMargin };
}

export function computeStaffingMcvTypeB(numStores: number, costPerStore: number): number {
  return numStores * costPerStore;
}

export function computeStaffingAcvTypeB(mcv: number, activeMonthsPerYear: number): number {
  return mcv * activeMonthsPerYear;
}

export function computeStaffingRevenueTypeB(input: {
  numStores: number;
  costPerStore: number;
  activeMonthsPerYear: number;
  gmPercent: number;
}) {
  const mcv = computeStaffingMcvTypeB(input.numStores, input.costPerStore);
  const acv = computeStaffingAcvTypeB(mcv, input.activeMonthsPerYear);
  const grossMargin = computeStaffingGrossMarginTypeB({ acv, gmPercent: input.gmPercent });
  return { mcv, acv, grossMargin };
}

export function computeStaffingMcvTypeC(monthlyRecurringFees: number): number {
  return monthlyRecurringFees;
}

export function computeStaffingAcvTypeC(
  monthlyRecurringFees: number,
  activeMonthsPerYear: number,
  oneTimeSetupFee: number,
): number {
  return monthlyRecurringFees * activeMonthsPerYear + oneTimeSetupFee;
}

export function computeStaffingRevenueTypeC(input: {
  monthlyRecurringFees: number;
  oneTimeSetupFee: number;
  activeMonthsPerYear: number;
  gmPercent: number;
}) {
  const mcv = computeStaffingMcvTypeC(input.monthlyRecurringFees);
  const acv = computeStaffingAcvTypeC(
    input.monthlyRecurringFees,
    input.activeMonthsPerYear,
    input.oneTimeSetupFee,
  );
  const grossMargin = computeStaffingGrossMarginTypeC({ acv, gmPercent: input.gmPercent });
  return { mcv, acv, grossMargin };
}
