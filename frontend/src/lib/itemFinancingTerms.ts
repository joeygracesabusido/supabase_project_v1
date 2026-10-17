/**
 * Financing calculations for anything eligible for a loan besides a unit
 * sale: repairs/maintenance, appliances (aircon, refrigerator, furniture),
 * or any other admin-defined category. Reuses the reducing-balance
 * amortization engine from financing.service.ts — the money math doesn't
 * change based on what's being financed — and adds advisory validation
 * scaled to these generally-smaller, shorter-term loans.
 *
 * Pure, DB-free functions so the money math can be unit tested in isolation.
 */

import {
  DEFERRED_CASH_MAX_TERM_MONTHS,
  IN_HOUSE_MAX_TERM_MONTHS,
  BANK_MAX_TERM_MONTHS,
  SPOT_CASH_TERM_MONTHS,
} from "./financing";

// Pag-IBIG (HDMF) financing is a government home-loan program and doesn't
// apply to repair/appliance/furniture loans, so it's deliberately excluded
// here even though it's one of the five routes for property sales.
export const ITEM_FINANCING_TYPES = [
  "spot_cash",
  "deferred_cash",
  "in_house_financing",
  "bank_financing",
] as const;
export type ItemFinancingType = (typeof ITEM_FINANCING_TYPES)[number];

export const ITEM_PAYMENT_TYPES = [
  "down_payment",
  "installment",
  "penalty",
  "refund",
] as const;
export type ItemPaymentType = (typeof ITEM_PAYMENT_TYPES)[number];

export interface ItemFinancingTermsCheckInput {
  financingType: ItemFinancingType;
  totalCost: number;
  downPaymentAmount: number;
  loanAmount: number;
  loanTermMonths: number;
  interestRateAnnual: number;
}

export interface ItemFinancingTermsCheckResult {
  errors: string[];
  warnings: string[];
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Advisory validation for a non-property financing request. `errors` flag
 * terms that are structurally inconsistent with the chosen financing type
 * (e.g. interest on a spot-cash payoff) and should block saving. `warnings`
 * flag figures outside typical conventions that a manager may still choose
 * to accept.
 */
export function validateItemFinancingTerms(
  input: ItemFinancingTermsCheckInput,
): ItemFinancingTermsCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const {
    financingType,
    totalCost,
    downPaymentAmount,
    loanAmount,
    loanTermMonths,
    interestRateAnnual,
  } = input;

  switch (financingType) {
    case "spot_cash":
      if (loanTermMonths !== SPOT_CASH_TERM_MONTHS) {
        errors.push(
          "Spot cash must be settled within a single payment (term of 1 month)",
        );
      }
      if (interestRateAnnual !== 0) {
        errors.push("Spot cash carries no interest");
      }
      break;

    case "deferred_cash":
      if (interestRateAnnual !== 0) {
        errors.push("Deferred cash terms are 0% interest by convention");
      }
      if (loanTermMonths > DEFERRED_CASH_MAX_TERM_MONTHS) {
        warnings.push(
          `Deferred cash terms beyond ${DEFERRED_CASH_MAX_TERM_MONTHS} months are unusual`,
        );
      }
      break;

    case "in_house_financing":
      if (loanTermMonths > IN_HOUSE_MAX_TERM_MONTHS) {
        warnings.push(
          `In-house financing terms beyond ${IN_HOUSE_MAX_TERM_MONTHS} months (10 years) are uncommon`,
        );
      }
      break;

    case "bank_financing":
      if (loanTermMonths > BANK_MAX_TERM_MONTHS) {
        warnings.push(
          `Bank financing terms beyond ${BANK_MAX_TERM_MONTHS} months (20 years) are uncommon`,
        );
      }
      break;
  }

  const reconciled = round2(downPaymentAmount + loanAmount);
  if (Math.abs(reconciled - round2(totalCost)) > 0.01) {
    warnings.push(
      `Down payment (PHP ${downPaymentAmount.toLocaleString()}) plus loan amount (PHP ${loanAmount.toLocaleString()}) does not match the total cost (PHP ${totalCost.toLocaleString()})`,
    );
  }

  return { errors, warnings };
}
