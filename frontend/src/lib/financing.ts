/**
 * Property financing calculations for the Philippine real-estate market:
 * amortization schedule generation across the financing routes buyers actually
 * use here (spot cash, deferred/in-house cash, in-house financing, bank
 * financing, Pag-IBIG/HDMF financing), the RA 6552 (Maceda Law) installment
 * buyer refund computation, and advisory validation of financing terms.
 *
 * Pure, DB-free functions so the money math can be unit tested in isolation.
 */

export const FINANCING_TYPES = [
  "spot_cash",
  "deferred_cash",
  "in_house_financing",
  "bank_financing",
  "pagibig_financing",
] as const;
export type FinancingType = (typeof FINANCING_TYPES)[number];

export const SALE_STATUSES = [
  "reserved",
  "equity_paying",
  "financing_pending",
  "financing_approved",
  "fully_paid",
  "turned_over",
  "cancelled",
] as const;

export const FINANCING_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "disapproved",
  "cancelled",
  "completed",
] as const;

export const PAYMENT_TYPES = [
  "reservation",
  "equity",
  "amortization",
  "penalty",
  "refund",
] as const;

// ---- PH market parameters (2026, indicative) ----
// These are reasonable defaults for advisory checks, not authoritative rate
// sheets — always confirm current figures with the lender before quoting a buyer.
export const PAGIBIG_MAX_LOAN_AMOUNT = 10_000_000;
export const PAGIBIG_MAX_DTI_RATIO = 0.35;
export const PAGIBIG_SOCIALIZED_PRICE_CEILING = 2_499_999;
export const PAGIBIG_MAX_LTV_SOCIALIZED = 0.95;
export const PAGIBIG_MAX_LTV_STANDARD = 0.9;
export const PAGIBIG_MAX_TERM_MONTHS = 360;
export const BANK_MAX_TERM_MONTHS = 240;
export const IN_HOUSE_MAX_TERM_MONTHS = 120;
export const DEFERRED_CASH_MAX_TERM_MONTHS = 24;
export const SPOT_CASH_TERM_MONTHS = 1;

// ---- RA 6552 (Maceda Law) ----
export const MACEDA_MIN_YEARS_FOR_REFUND = 2;
export const MACEDA_BASE_REFUND_PERCENT = 50;
export const MACEDA_BONUS_PERCENT_PER_YEAR = 5;
export const MACEDA_BONUS_STARTS_AFTER_YEARS = 5;
export const MACEDA_MAX_REFUND_PERCENT = 90;
export const MACEDA_SHORT_TERM_GRACE_DAYS = 60;

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Adds whole months to a UTC date, clamping to the last valid day of the
 * target month (so a loan taken out on Jan 31 due next on Feb 28/29, not a
 * rolled-over March date).
 */
function addMonthsUTC(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const firstOfTargetMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
  const daysInTargetMonth = new Date(
    Date.UTC(
      firstOfTargetMonth.getUTCFullYear(),
      firstOfTargetMonth.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();
  firstOfTargetMonth.setUTCDate(Math.min(day, daysInTargetMonth));
  return firstOfTargetMonth;
}

export interface AmortizationInput {
  principal: number;
  annualInterestRatePercent: number;
  termMonths: number;
  startDate: Date;
}

export interface AmortizationRow {
  installment_number: number;
  due_date: Date;
  principal_amount: number;
  interest_amount: number;
  amount_due: number;
  running_balance: number;
}

/**
 * Generates a reducing-balance amortization schedule. A 0% rate (deferred
 * cash / interest-free in-house terms) falls back to equal-principal,
 * zero-interest installments. The final installment always absorbs any
 * rounding drift so the balance lands on exactly 0.00.
 */
export function generateAmortizationSchedule(
  input: AmortizationInput,
): AmortizationRow[] {
  const { principal, annualInterestRatePercent, termMonths, startDate } = input;

  if (!(principal > 0)) {
    throw new Error("principal must be greater than zero");
  }
  if (!Number.isInteger(termMonths) || termMonths <= 0) {
    throw new Error("termMonths must be a positive integer");
  }
  if (annualInterestRatePercent < 0) {
    throw new Error("annualInterestRatePercent cannot be negative");
  }

  const monthlyRate = annualInterestRatePercent / 100 / 12;
  const monthlyPayment =
    monthlyRate === 0
      ? round2(principal / termMonths)
      : round2(
          (principal * monthlyRate) /
            (1 - Math.pow(1 + monthlyRate, -termMonths)),
        );

  const rows: AmortizationRow[] = [];
  let balance = round2(principal);

  for (let i = 1; i <= termMonths; i++) {
    const dueDate = addMonthsUTC(startDate, i);

    const interest = monthlyRate === 0 ? 0 : round2(balance * monthlyRate);
    let principalPortion =
      monthlyRate === 0 ? monthlyPayment : round2(monthlyPayment - interest);

    if (i === termMonths || principalPortion > balance) {
      principalPortion = balance;
    }

    balance = round2(balance - principalPortion);

    rows.push({
      installment_number: i,
      due_date: dueDate,
      principal_amount: principalPortion,
      interest_amount: interest,
      amount_due: round2(principalPortion + interest),
      running_balance: balance,
    });
  }

  return rows;
}

export interface MacedaRefundInput {
  totalPaymentsMade: number;
  contractStartDate: Date;
  asOfDate: Date;
}

export interface MacedaRefundResult {
  monthsPaid: number;
  yearsPaid: number;
  eligibleForRefund: boolean;
  refundPercent: number;
  refundAmount: number;
  graceMonths: number;
  shortTermGraceDays: number;
  legalBasis: string;
}

/**
 * RA 6552 (Maceda Law) cash-surrender-value computation for a cancelled
 * installment sale. Buyers with under 2 years of installments get no refund
 * but a 60-day grace period to update instead. From 2 years, the refund is
 * 50% of total payments, +5% per year after year 5, capped at 90%.
 *
 * This is an operational approximation for internal decision support, not a
 * legal determination — cancellation still requires a notarized notice served
 * 30 days in advance with simultaneous payment of the refund, and the grace
 * period may only be exercised once every 5 years of the contract. Confirm
 * with counsel before acting on the figures returned here.
 */
export function computeMacedaRefund(
  input: MacedaRefundInput,
): MacedaRefundResult {
  const { totalPaymentsMade, contractStartDate, asOfDate } = input;

  if (totalPaymentsMade < 0) {
    throw new Error("totalPaymentsMade cannot be negative");
  }
  if (asOfDate < contractStartDate) {
    throw new Error("asOfDate cannot precede contractStartDate");
  }

  const monthsPaid =
    (asOfDate.getUTCFullYear() - contractStartDate.getUTCFullYear()) * 12 +
    (asOfDate.getUTCMonth() - contractStartDate.getUTCMonth());
  const yearsPaid = Math.floor(monthsPaid / 12);
  const eligibleForRefund = yearsPaid >= MACEDA_MIN_YEARS_FOR_REFUND;

  const refundPercent = eligibleForRefund
    ? Math.min(
        MACEDA_MAX_REFUND_PERCENT,
        MACEDA_BASE_REFUND_PERCENT +
          Math.max(0, yearsPaid - MACEDA_BONUS_STARTS_AFTER_YEARS) *
            MACEDA_BONUS_PERCENT_PER_YEAR,
      )
    : 0;

  return {
    monthsPaid,
    yearsPaid,
    eligibleForRefund,
    refundPercent,
    refundAmount: round2(totalPaymentsMade * (refundPercent / 100)),
    graceMonths: eligibleForRefund ? yearsPaid : 0,
    shortTermGraceDays: eligibleForRefund ? 0 : MACEDA_SHORT_TERM_GRACE_DAYS,
    legalBasis:
      "RA 6552 (Maceda Law) — indicative computation only; the grace period may " +
      "be exercised once every 5 years of the contract, and cancellation " +
      "additionally requires a notarized notice served 30 days in advance with " +
      "simultaneous payment of the refund. Confirm with legal counsel before " +
      "acting on this figure.",
  };
}

export interface FinancingTermsCheckInput {
  financingType: FinancingType;
  totalContractPrice: number;
  downPaymentAmount: number;
  loanAmount: number;
  loanTermMonths: number;
  interestRateAnnual: number;
  buyerMonthlyIncome?: number | null;
}

export interface FinancingTermsCheckResult {
  errors: string[];
  warnings: string[];
}

/**
 * Advisory validation against typical PH financing-route conventions.
 * `errors` flag terms that are structurally inconsistent with the chosen
 * financing type (e.g. interest on a "deferred cash" plan) and should block
 * saving. `warnings` flag figures outside typical market norms (loan caps,
 * equity minimums, debt-to-income) that a manager may still choose to accept.
 */
export function validateFinancingTerms(
  input: FinancingTermsCheckInput,
): FinancingTermsCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const {
    financingType,
    totalContractPrice,
    downPaymentAmount,
    loanAmount,
    loanTermMonths,
    interestRateAnnual,
    buyerMonthlyIncome,
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
          `Deferred cash terms beyond ${DEFERRED_CASH_MAX_TERM_MONTHS} months are unusual in the PH market`,
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

    case "pagibig_financing": {
      if (loanAmount > PAGIBIG_MAX_LOAN_AMOUNT) {
        warnings.push(
          `Loan amount exceeds the Pag-IBIG program cap of PHP ${PAGIBIG_MAX_LOAN_AMOUNT.toLocaleString()}`,
        );
      }
      if (loanTermMonths > PAGIBIG_MAX_TERM_MONTHS) {
        warnings.push(
          `Pag-IBIG loan terms beyond ${PAGIBIG_MAX_TERM_MONTHS} months (30 years) are not offered`,
        );
      }
      const maxLtv =
        totalContractPrice <= PAGIBIG_SOCIALIZED_PRICE_CEILING
          ? PAGIBIG_MAX_LTV_SOCIALIZED
          : PAGIBIG_MAX_LTV_STANDARD;
      const minDownPayment = round2(totalContractPrice * (1 - maxLtv));
      if (downPaymentAmount < minDownPayment) {
        warnings.push(
          `Down payment is below the typical Pag-IBIG minimum equity of PHP ${minDownPayment.toLocaleString()} (${Math.round(
            (1 - maxLtv) * 100,
          )}%)`,
        );
      }
      break;
    }
  }

  if (buyerMonthlyIncome && loanAmount > 0 && loanTermMonths > 0) {
    const [firstInstallment] = generateAmortizationSchedule({
      principal: loanAmount,
      annualInterestRatePercent: interestRateAnnual,
      termMonths: loanTermMonths,
      startDate: new Date(),
    });
    const maxAllowed = round2(buyerMonthlyIncome * PAGIBIG_MAX_DTI_RATIO);
    if (firstInstallment.amount_due > maxAllowed) {
      warnings.push(
        `Estimated monthly amortization (PHP ${firstInstallment.amount_due.toLocaleString()}) exceeds ${Math.round(
          PAGIBIG_MAX_DTI_RATIO * 100,
        )}% of the buyer's declared monthly income`,
      );
    }
  }

  return { errors, warnings };
}
