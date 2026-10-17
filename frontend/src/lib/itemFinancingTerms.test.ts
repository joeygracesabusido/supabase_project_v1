/**
 * Item Financing Terms — Unit Tests (transplanted from
 * el-property server __tests__/item-financing.service.test.ts)
 * Covers advisory validation of financing terms for non-property requests
 * (repairs/maintenance, appliances, and any admin-defined category). Reuses
 * generateAmortizationSchedule from lib/financing.ts, so amortization
 * math itself is covered there. Pure functions — no database required.
 */

import { describe, it, expect } from "vitest";

import {
  validateItemFinancingTerms,
  ITEM_FINANCING_TYPES,
} from "./itemFinancingTerms";
import {
  DEFERRED_CASH_MAX_TERM_MONTHS,
  IN_HOUSE_MAX_TERM_MONTHS,
  BANK_MAX_TERM_MONTHS,
} from "./financing";

describe("ITEM_FINANCING_TYPES", () => {
  it("excludes pagibig_financing — that program is home loans only", () => {
    expect(ITEM_FINANCING_TYPES).not.toContain("pagibig_financing");
  });

  it("offers the four routes that make sense for a repair/appliance loan", () => {
    expect(ITEM_FINANCING_TYPES).toEqual([
      "spot_cash",
      "deferred_cash",
      "in_house_financing",
      "bank_financing",
    ]);
  });
});

describe("validateItemFinancingTerms", () => {
  const base = {
    totalCost: 60_000,
    downPaymentAmount: 10_000,
    loanAmount: 50_000,
    loanTermMonths: 12,
    interestRateAnnual: 6,
  };

  it("accepts well-formed in-house financing terms", () => {
    const result = validateItemFinancingTerms({
      ...base,
      financingType: "in_house_financing",
    });
    expect(result.errors).toHaveLength(0);
  });

  it("rejects spot cash spread over more than one month", () => {
    const result = validateItemFinancingTerms({
      ...base,
      financingType: "spot_cash",
      loanTermMonths: 3,
      interestRateAnnual: 0,
    });
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects spot cash carrying interest", () => {
    const result = validateItemFinancingTerms({
      ...base,
      financingType: "spot_cash",
      loanTermMonths: 1,
      interestRateAnnual: 2,
    });
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects deferred cash carrying interest", () => {
    const result = validateItemFinancingTerms({
      ...base,
      financingType: "deferred_cash",
      interestRateAnnual: 5,
    });
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("warns when deferred cash term exceeds the 24-month convention", () => {
    const result = validateItemFinancingTerms({
      ...base,
      financingType: "deferred_cash",
      loanTermMonths: DEFERRED_CASH_MAX_TERM_MONTHS + 6,
      interestRateAnnual: 0,
    });
    expect(result.warnings.some((w) => w.includes("24"))).toBe(true);
  });

  it("warns when in-house financing term exceeds the 10-year convention", () => {
    const result = validateItemFinancingTerms({
      ...base,
      financingType: "in_house_financing",
      loanTermMonths: IN_HOUSE_MAX_TERM_MONTHS + 1,
    });
    expect(result.warnings.some((w) => w.includes("10"))).toBe(true);
  });

  it("warns when bank financing term exceeds the 20-year convention", () => {
    const result = validateItemFinancingTerms({
      ...base,
      financingType: "bank_financing",
      loanTermMonths: BANK_MAX_TERM_MONTHS + 1,
    });
    expect(result.warnings.some((w) => w.includes("20"))).toBe(true);
  });

  it("warns when loan amount plus down payment doesn't reconcile with total cost", () => {
    const result = validateItemFinancingTerms({
      ...base,
      financingType: "in_house_financing",
      downPaymentAmount: 10_000,
      loanAmount: 20_000, // + down payment = 30,000, far short of totalCost 60,000
    });
    expect(result.warnings.some((w) => w.toLowerCase().includes("total cost"))).toBe(
      true,
    );
  });

  it("does not warn when loan amount plus down payment reconciles with total cost", () => {
    const result = validateItemFinancingTerms({
      ...base,
      financingType: "in_house_financing",
      totalCost: 60_000,
      downPaymentAmount: 10_000,
      loanAmount: 50_000,
    });
    expect(result.warnings.some((w) => w.toLowerCase().includes("total cost"))).toBe(
      false,
    );
  });
});
