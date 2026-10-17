/**
 * Financing Service — Unit Tests
 * Covers amortization schedule generation (bank / Pag-IBIG / in-house / deferred /
 * spot cash), the RA 6552 (Maceda Law) refund calculator, and PH-market advisory
 * validation of financing terms. Pure functions — no database required.
 */

import {
  generateAmortizationSchedule,
  computeMacedaRefund,
  validateFinancingTerms,
  PAGIBIG_MAX_LOAN_AMOUNT,
  DEFERRED_CASH_MAX_TERM_MONTHS,
} from "./financing";
import { describe, it, expect } from "vitest";

describe("generateAmortizationSchedule", () => {
  it("amortizes an interest-bearing loan to exactly zero balance", () => {
    const rows = generateAmortizationSchedule({
      principal: 1_000_000,
      annualInterestRatePercent: 6,
      termMonths: 12,
      startDate: new Date("2026-01-01"),
    });

    expect(rows).toHaveLength(12);
    expect(rows[rows.length - 1].running_balance).toBe(0);

    const totalPrincipal = rows.reduce((sum, r) => sum + r.principal_amount, 0);
    expect(Math.round(totalPrincipal * 100) / 100).toBe(1_000_000);

    rows.forEach((row) => {
      expect(Math.round((row.principal_amount + row.interest_amount) * 100) / 100).toBe(
        row.amount_due,
      );
    });

    expect(rows[0].due_date.getUTCMonth()).toBe(1); // Feb (0-indexed)
    expect(rows[0].installment_number).toBe(1);
  });

  it("produces equal-principal, zero-interest installments for deferred (0%) cash", () => {
    const rows = generateAmortizationSchedule({
      principal: 240_000,
      annualInterestRatePercent: 0,
      termMonths: 24,
      startDate: new Date("2026-01-01"),
    });

    expect(rows).toHaveLength(24);
    rows.forEach((row) => expect(row.interest_amount).toBe(0));
    const totalPrincipal = rows.reduce((sum, r) => sum + r.principal_amount, 0);
    expect(Math.round(totalPrincipal * 100) / 100).toBe(240_000);
    expect(rows[rows.length - 1].running_balance).toBe(0);
  });

  it("settles spot cash as a single zero-interest payment", () => {
    const rows = generateAmortizationSchedule({
      principal: 500_000,
      annualInterestRatePercent: 0,
      termMonths: 1,
      startDate: new Date("2026-01-01"),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].principal_amount).toBe(500_000);
    expect(rows[0].interest_amount).toBe(0);
    expect(rows[0].running_balance).toBe(0);
  });

  it("clamps due dates for a month-end takeout instead of rolling into the next month", () => {
    const rows = generateAmortizationSchedule({
      principal: 100_000,
      annualInterestRatePercent: 6,
      termMonths: 3,
      startDate: new Date("2026-01-31"),
    });

    // Jan 31 + 1 month must land in February (28/29), not roll into March.
    expect(rows[0].due_date.getUTCMonth()).toBe(1); // Feb
    expect(rows[0].due_date.getUTCDate()).toBeLessThanOrEqual(29);
    expect(rows[1].due_date.getUTCMonth()).toBe(2); // Mar
    expect(rows[2].due_date.getUTCMonth()).toBe(3); // Apr
  });

  it("rejects non-positive principal", () => {
    expect(() =>
      generateAmortizationSchedule({
        principal: 0,
        annualInterestRatePercent: 5,
        termMonths: 12,
        startDate: new Date(),
      }),
    ).toThrow();
  });

  it("rejects a non-positive or fractional term", () => {
    expect(() =>
      generateAmortizationSchedule({
        principal: 100_000,
        annualInterestRatePercent: 5,
        termMonths: 0,
        startDate: new Date(),
      }),
    ).toThrow();
  });

  it("rejects a negative interest rate", () => {
    expect(() =>
      generateAmortizationSchedule({
        principal: 100_000,
        annualInterestRatePercent: -1,
        termMonths: 12,
        startDate: new Date(),
      }),
    ).toThrow();
  });
});

describe("computeMacedaRefund", () => {
  it("grants no refund entitlement before 2 years of installments, but a 60-day grace period", () => {
    const result = computeMacedaRefund({
      totalPaymentsMade: 300_000,
      contractStartDate: new Date("2025-01-01"),
      asOfDate: new Date("2026-06-01"), // 17 months
    });

    expect(result.eligibleForRefund).toBe(false);
    expect(result.refundAmount).toBe(0);
    expect(result.shortTermGraceDays).toBe(60);
  });

  it("grants the 50% base refund at exactly 2 years paid", () => {
    const result = computeMacedaRefund({
      totalPaymentsMade: 1_000_000,
      contractStartDate: new Date("2024-01-01"),
      asOfDate: new Date("2026-01-01"),
    });

    expect(result.eligibleForRefund).toBe(true);
    expect(result.refundPercent).toBe(50);
    expect(result.refundAmount).toBe(500_000);
    expect(result.graceMonths).toBe(2);
  });

  it("adds 5% per year once past year 5", () => {
    const result = computeMacedaRefund({
      totalPaymentsMade: 1_000_000,
      contractStartDate: new Date("2020-01-01"),
      asOfDate: new Date("2026-01-01"), // 6 years
    });

    expect(result.refundPercent).toBe(55);
  });

  it("caps the refund at 90%", () => {
    const result = computeMacedaRefund({
      totalPaymentsMade: 1_000_000,
      contractStartDate: new Date("2006-01-01"),
      asOfDate: new Date("2026-01-01"), // 20 years
    });

    expect(result.refundPercent).toBe(90);
    expect(result.refundAmount).toBe(900_000);
  });

  it("rejects an as-of date earlier than the contract start", () => {
    expect(() =>
      computeMacedaRefund({
        totalPaymentsMade: 1000,
        contractStartDate: new Date("2026-01-01"),
        asOfDate: new Date("2025-01-01"),
      }),
    ).toThrow();
  });
});

describe("validateFinancingTerms", () => {
  const base = {
    totalContractPrice: 3_000_000,
    downPaymentAmount: 300_000,
    loanAmount: 2_700_000,
    loanTermMonths: 120,
    interestRateAnnual: 6,
  };

  it("accepts a well-formed spot cash terms", () => {
    const result = validateFinancingTerms({
      ...base,
      financingType: "spot_cash",
      loanTermMonths: 1,
      interestRateAnnual: 0,
    });
    expect(result.errors).toHaveLength(0);
  });

  it("rejects spot cash spread over more than one month", () => {
    const result = validateFinancingTerms({
      ...base,
      financingType: "spot_cash",
      loanTermMonths: 3,
      interestRateAnnual: 0,
    });
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects deferred cash carrying interest", () => {
    const result = validateFinancingTerms({
      ...base,
      financingType: "deferred_cash",
      loanTermMonths: 12,
      interestRateAnnual: 5,
    });
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("warns when deferred cash term exceeds the 24-month convention", () => {
    const result = validateFinancingTerms({
      ...base,
      financingType: "deferred_cash",
      loanTermMonths: DEFERRED_CASH_MAX_TERM_MONTHS + 6,
      interestRateAnnual: 0,
    });
    expect(result.warnings.some((w) => w.includes("24"))).toBe(true);
  });

  it("warns when a Pag-IBIG loan exceeds the program cap", () => {
    const result = validateFinancingTerms({
      ...base,
      financingType: "pagibig_financing",
      loanAmount: PAGIBIG_MAX_LOAN_AMOUNT + 1,
    });
    expect(result.warnings.some((w) => w.toLowerCase().includes("cap"))).toBe(true);
  });

  it("warns when Pag-IBIG down payment is below the socialized-housing minimum equity", () => {
    const result = validateFinancingTerms({
      financingType: "pagibig_financing",
      totalContractPrice: 2_000_000,
      downPaymentAmount: 10_000, // well under 5%
      loanAmount: 1_990_000,
      loanTermMonths: 360,
      interestRateAnnual: 6.25,
    });
    expect(result.warnings.some((w) => w.toLowerCase().includes("equity"))).toBe(true);
  });

  it("warns when estimated amortization exceeds 35% of the buyer's income", () => {
    const result = validateFinancingTerms({
      ...base,
      financingType: "bank_financing",
      loanAmount: 2_700_000,
      loanTermMonths: 60,
      interestRateAnnual: 8,
      buyerMonthlyIncome: 15_000,
    });
    expect(result.warnings.some((w) => w.toLowerCase().includes("income"))).toBe(true);
  });
});
