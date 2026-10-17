import { buildLoanNo, allocatePayment, computeDelinquency, calcPenalty } from "./loanLedger";
import { describe, it, expect } from "vitest";

describe("loan ledger", () => {
  it("builds LN-2026-0007", () => {
    expect(buildLoanNo(7, 2026)).toBe("LN-2026-0007");
  });

  it("allocates penalty first", () => {
    const r = allocatePayment(1000, { penalty: 200, charges: 100, interest: 500, principal: 5000 }, ["penalty", "charges", "interest", "principal"]);
    expect(r).toEqual({ penalty: 200, charges: 100, interest: 500, principal: 200, unapplied: 0 });
  });

  it("flags overdue", () => {
    const r = computeDelinquency(new Date("2026-01-05"), new Date("2026-01-10"), "pending");
    expect(r.isOverdue).toBe(true);
    expect(r.daysOverdue).toBe(5);
  });
});

describe("calcPenalty", () => {
  it("percent: never applies before the grace window", () => {
    expect(calcPenalty("percent", 12000, 0.02, 3, 3)).toBe(0);
  });

  it("percent: rounds to 2 decimals", () => {
    expect(calcPenalty("percent", 12000, 0.02, 5)).toBe(240);
  });

  it("monthly counts ceiling of 30-day months", () => {
    expect(calcPenalty("monthly", 12000, 0.05, 31, 0)).toBe(1200);
  });

  it("fixed returns the flat rate once overdue", () => {
    expect(calcPenalty("fixed", 0, 500, 10)).toBe(500);
  });
});
