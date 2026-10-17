// Unit sales + financing over Supabase. The money math lives in
// src/lib/{financing,loanLedger}.ts (vendored verbatim from the source
// Express services); the multi-row write flows (payment allocation, schedule
// regeneration on approval, Maceda cancellation) are orchestrated client-side,
// same tradeoff as the source project's ported UI. shortcut: sequential
// Supabase calls instead of one SQL transaction, upgrade by moving steps into
// a Postgres RPC if concurrent admin edits become a real risk.
import { supabase } from "./client";
import { ilikeTerm, paginate } from "./properties";
import {
  computeMacedaRefund,
  generateAmortizationSchedule,
  validateFinancingTerms,
} from "../lib/financing";
import {
  allocatePayment,
  calcPenalty,
  type PenaltyMethod,
} from "../lib/loanLedger";

export const FINANCING_TYPES = [
  "spot_cash",
  "deferred_cash",
  "in_house_financing",
  "bank_financing",
  "pagibig_financing",
] as const;
export type FinancingType = (typeof FINANCING_TYPES)[number];

export const FINANCING_TYPE_LABELS: Record<FinancingType, string> = {
  spot_cash: "Spot Cash",
  deferred_cash: "Deferred Cash (0% in-house)",
  in_house_financing: "In-House Financing",
  bank_financing: "Bank Financing",
  pagibig_financing: "Pag-IBIG (HDMF) Financing",
};

export const PAYMENT_TYPES = ["reservation", "equity", "amortization", "penalty", "refund"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const FINANCING_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["under_review", "cancelled"],
  under_review: ["approved", "disapproved", "cancelled"],
  approved: ["completed", "cancelled"],
  disapproved: ["draft", "cancelled"],
  cancelled: [],
  completed: [],
};

const CANCELLABLE_STATUSES = [
  "reserved",
  "equity_paying",
  "financing_pending",
  "financing_approved",
];

export interface SaleBuyer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  monthly_income?: string | number | null;
  employment_status?: string | null;
  employer?: string | null;
}

export interface UnitSale {
  id: string;
  unit_id: string;
  buyer_id: string;
  total_contract_price: string | number;
  reservation_fee?: string | number | null;
  reservation_date?: string | null;
  reservation_paid: boolean;
  status:
    | "reserved"
    | "equity_paying"
    | "financing_pending"
    | "financing_approved"
    | "fully_paid"
    | "turned_over"
    | "cancelled";
  target_turnover_date?: string | null;
  turned_over_at?: string | null;
  broker_name?: string | null;
  notes?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  refund_amount?: string | number | null;
  created_at: string;
  unit?: {
    id: string;
    unit_number: string;
    properties?: { id: string; name: string; address?: string; city?: string };
  };
  buyer?: SaleBuyer;
  financing_application?: FinancingApplication | null;
}

export interface FinancingApplication {
  id: string;
  sale_id: string;
  financing_type: FinancingType;
  lender_name?: string | null;
  loan_amount?: string | number | null;
  down_payment_amount?: string | number | null;
  down_payment_term_months?: number | null;
  interest_rate_annual?: string | number | null;
  loan_term_months?: number | null;
  repricing_period_years?: number | null;
  processing_fee?: string | number | null;
  mri_premium?: string | number | null;
  fire_insurance_premium?: string | number | null;
  status:
    | "draft"
    | "submitted"
    | "under_review"
    | "approved"
    | "disapproved"
    | "cancelled"
    | "completed";
  submitted_at?: string | null;
  approved_at?: string | null;
  disapproval_reason?: string | null;
  loan_takeout_date?: string | null;
  notes?: string | null;
}

export interface AmortizationInstallment {
  id: string;
  installment_number: number;
  due_date: string;
  principal_amount: string | number;
  interest_amount: string | number;
  amount_due: string | number;
  running_balance: string | number;
  status: "pending" | "partial" | "paid";
  paid_amount?: string | number | null;
  paid_date?: string | null;
}

export interface SalePayment {
  id: string;
  sale_id: string;
  amortization_schedule_id?: string | null;
  payment_type: PaymentType;
  amount: string | number;
  payment_method: string;
  payment_date: string;
  reference?: string | null;
  notes?: string | null;
  or_number?: string | null;
}

export interface MacedaRefund {
  monthsPaid: number;
  yearsPaid: number;
  eligibleForRefund: boolean;
  refundPercent: number;
  refundAmount: number;
  graceMonths: number;
  shortTermGraceDays: number;
  legalBasis: string;
}

export interface FinancingAdvisory {
  errors: string[];
  warnings: string[];
}

type Row = Record<string, unknown>;

type SaleRow = Row & {
  unit?: (Row & { properties?: Row | null }) | null;
  buyer?: Row | null;
  financing_application?: FinancingApplication | null;
};

const SALE_DETAIL_SELECT =
  "*, unit:units(id, unit_number, properties(id, name, address, city)), " +
  "buyer:tenants!unit_sales_buyer_id_fkey(id, full_name, email, phone, " +
  "monthly_income, employment_status, employer), " +
  "financing_application:financing_applications(*)";

const SALE_LIST_SELECT =
  "*, unit:units(id, unit_number, properties(id, name, address, city)), " +
  "buyer:tenants!unit_sales_buyer_id_fkey(id, full_name, email, phone, " +
  "monthly_income, employment_status, employer)";

function mapBuyer(buyer?: Row | null): SaleBuyer | undefined {
  if (!buyer) return undefined;
  return {
    id: String(buyer.id),
    name: String(buyer.full_name ?? ""),
    email: (buyer.email as string) ?? null,
    phone: (buyer.phone as string) ?? null,
    monthly_income:
      buyer.monthly_income != null ? Number(buyer.monthly_income) : null,
    employment_status: (buyer.employment_status as string) ?? null,
    employer: (buyer.employer as string) ?? null,
  };
}

export function mapSale(row: SaleRow): UnitSale {
  const unit = (row.unit ?? null) as (Row & { properties?: Row | null }) | null;
  return {
    id: String(row.id),
    unit_id: String(row.unit_id ?? ""),
    buyer_id: String(row.buyer_id ?? ""),
    total_contract_price: row.total_contract_price != null ? Number(row.total_contract_price) : 0,
    reservation_fee: row.reservation_fee != null ? Number(row.reservation_fee) : null,
    reservation_date: (row.reservation_date as string) ?? null,
    reservation_paid: !!row.reservation_paid,
    status: (row.status as UnitSale["status"]) ?? "reserved",
    target_turnover_date: (row.target_turnover_date as string) ?? null,
    turned_over_at: (row.turned_over_at as string) ?? null,
    broker_name: (row.broker_name as string) ?? null,
    notes: (row.notes as string) ?? null,
    cancelled_at: (row.cancelled_at as string) ?? null,
    cancellation_reason: (row.cancellation_reason as string) ?? null,
    refund_amount: row.refund_amount != null ? Number(row.refund_amount) : null,
    created_at: String(row.created_at ?? ""),
    unit: unit
      ? {
          id: String(unit.id),
          unit_number: String(unit.unit_number ?? ""),
          properties: unit.properties
            ? {
                id: String((unit.properties as Row).id ?? ""),
                name: String((unit.properties as Row).name ?? ""),
                address: ((unit.properties as Row).address as string) ?? undefined,
                city: ((unit.properties as Row).city as string) ?? undefined,
              }
            : undefined,
        }
      : undefined,
    buyer: mapBuyer(row.buyer),
    financing_application:
      (row.financing_application as FinancingApplication | null) ?? null,
  };
}

function validateStatusTransition(
  current: string,
  next: string,
  transitions: Record<string, string[]>,
) {
  const allowed = transitions[current] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(
      `Cannot move from "${current}" to "${next}" (allowed: ${allowed.join(", ") || "none"})`,
    );
  }
}

const SALE_COLS = new Set([
  "unit_id",
  "buyer_id",
  "total_contract_price",
  "reservation_fee",
  "reservation_date",
  "target_turnover_date",
  "broker_name",
  "notes",
]);

function saleBody(body: Partial<UnitSale>): Row {
  const row: Row = {};
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && SALE_COLS.has(k)) row[k] = v;
  }
  if (row.unit_id) row.unit_id = String(row.unit_id);
  return row;
}

const FINANCING_COLS = new Set([
  "financing_type",
  "lender_name",
  "loan_amount",
  "down_payment_amount",
  "down_payment_term_months",
  "interest_rate_annual",
  "loan_term_months",
  "repricing_period_years",
  "processing_fee",
  "mri_premium",
  "fire_insurance_premium",
  "notes",
]);

function financingBody(body: Record<string, unknown>): Row {
  const row: Row = {};
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && FINANCING_COLS.has(k)) row[k] = v;
  }
  return row;
}

async function getActiveSale(id: string | number): Promise<UnitSale> {
  const { data, error } = await supabase
    .from("unit_sales")
    .select(SALE_DETAIL_SELECT)
    .eq("id", String(id))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sale not found");
  return mapSale(data as unknown as SaleRow);
}

function termsCheckInput(
  sale: UnitSale,
  app: FinancingApplication,
): Parameters<typeof validateFinancingTerms>[0] {
  return {
    financingType: app.financing_type,
    totalContractPrice: Number(sale.total_contract_price),
    downPaymentAmount: Number(app.down_payment_amount ?? 0),
    loanAmount: Number(app.loan_amount ?? 0),
    loanTermMonths: Number(app.loan_term_months ?? 0),
    interestRateAnnual: Number(app.interest_rate_annual ?? 0),
    buyerMonthlyIncome: sale.buyer?.monthly_income
      ? Number(sale.buyer.monthly_income)
      : null,
  };
}

export interface FinancingPreviewInput {
  financing_type: FinancingType;
  total_contract_price?: number;
  down_payment_amount?: number;
  loan_amount?: number;
  interest_rate_annual?: number;
  loan_term_months?: number;
  buyer_monthly_income?: number | null;
}

/**
 * Pure mirror of POST /api/financing/preview from the source server.
 */
export async function previewFinancing(
  input: FinancingPreviewInput,
): Promise<{
  data: {
    monthly_payment: number;
    first_due_date: string;
    term_months: number;
    total_interest: number;
    total_payments: number;
  } | null;
  advisory: FinancingAdvisory;
}> {
  const advisory = validateFinancingTerms({
    financingType: input.financing_type,
    totalContractPrice: Number(input.total_contract_price ?? input.loan_amount),
    downPaymentAmount: Number(input.down_payment_amount ?? 0),
    loanAmount: Number(input.loan_amount ?? 0),
    loanTermMonths: Number(input.loan_term_months ?? 0),
    interestRateAnnual: Number(input.interest_rate_annual ?? 0),
    buyerMonthlyIncome: input.buyer_monthly_income ?? null,
  });

  if (advisory.errors.length > 0) {
    return { data: null, advisory };
  }

  const schedule = generateAmortizationSchedule({
    principal: Number(input.loan_amount),
    annualInterestRatePercent: Number(input.interest_rate_annual ?? 0),
    termMonths: Number(input.loan_term_months),
    startDate: new Date(),
  });

  const totalInterest = schedule.reduce((sum, r) => sum + r.interest_amount, 0);
  const totalPayments = schedule.reduce((sum, r) => sum + r.amount_due, 0);

  return {
    data: {
      monthly_payment: schedule[0].amount_due,
      first_due_date: schedule[0].due_date.toISOString().slice(0, 10),
      term_months: schedule.length,
      total_interest: Math.round(totalInterest * 100) / 100,
      total_payments: Math.round(totalPayments * 100) / 100,
    },
    advisory,
  };
}

// ─── Sales ────────────────────────────────────────────────────────────

export async function getSales(params?: Record<string, string>) {
  const page = Math.max(1, Number(params?.page ?? 1));
  const limit = Math.max(1, Number(params?.limit ?? 20));
  const search = params?.search ? ilikeTerm(params.search) : "";

  let base = supabase
    .from("unit_sales")
    .select(SALE_LIST_SELECT, { count: "exact" })
    .order("created_at", { ascending: false });

  if (params?.status) base = base.eq("status", params.status);
  if (search) {
    base = base.or(
      `tenants.full_name.ilike.%${search}%,broker_name.ilike.%${search}%`,
    );
  }

  const from = (page - 1) * limit;
  const { data, error, count } = await base.range(from, from + limit - 1);
  if (error) throw new Error(error.message);
  const sales = (data ?? []).map((s) => mapSale(s as unknown as SaleRow));
  return paginate(sales, page, limit, count ?? sales.length);
}

export async function getSale(id: string | number): Promise<UnitSale> {
  return getActiveSale(id);
}

export interface CreateSaleInput {
  unit_id: string;
  buyer_id?: string;
  buyer?: {
    name: string;
    email?: string;
    phone?: string;
    monthly_income?: number;
    employment_status?: string;
    employer?: string;
  };
  total_contract_price: number;
  reservation_fee?: number;
  reservation_date?: string;
  target_turnover_date?: string;
  broker_name?: string;
  notes?: string;
}

export async function createSale(body: CreateSaleInput): Promise<UnitSale> {
  let buyerId = body.buyer_id ? String(body.buyer_id) : undefined;

  // Create buyer inline (mirror of the source: buyer lives in `tenants`).
  if (!buyerId && body.buyer) {
    const { data: buyerRow, error } = await supabase
      .from("tenants")
      .insert({
        full_name: body.buyer.name,
        email: body.buyer.email ?? null,
        phone: body.buyer.phone ?? null,
        monthly_income: body.buyer.monthly_income ?? null,
        employment_status: body.buyer.employment_status ?? null,
        employer: body.buyer.employer ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    buyerId = String(buyerRow.id);
  }
  if (!buyerId) throw new Error("buyer_id or inline buyer is required");

  const payload = saleBody({
    unit_id: body.unit_id,
    total_contract_price: body.total_contract_price,
    reservation_fee: body.reservation_fee,
    reservation_date: body.reservation_date,
    target_turnover_date: body.target_turnover_date,
    broker_name: body.broker_name,
    notes: body.notes,
  });
  payload.buyer_id = buyerId;
  payload.status = "reserved";

  const { data, error } = await supabase
    .from("unit_sales")
    .insert(payload)
    .select(SALE_DETAIL_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapSale(data as unknown as SaleRow);
}

/**
 * POST /sales/:id/cancel — RA 6552 (Maceda Law) refund computation is the
 * vendored pure function; qualifying payments are equity + amortization sums
 * (same rule as the source route).
 */
export async function cancelSale(
  id: string | number,
  reason: string,
  cancellation_date?: string,
): Promise<{ data: UnitSale; maceda_refund: MacedaRefund }> {
  const existing = await getActiveSale(id);
  if (!CANCELLABLE_STATUSES.includes(existing.status)) {
    throw new Error(`Cannot cancel a sale with status "${existing.status}"`);
  }

  const asOfDate = cancellation_date ? new Date(cancellation_date) : new Date();

  const { data: sums, error: sumsErr } = await supabase
    .from("sale_payments")
    .select("amount")
    .eq("sale_id", String(id))
    .in("payment_type", ["equity", "amortization"]);
  if (sumsErr) throw new Error(sumsErr.message);
  const totalPaymentsMade = (sums ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);

  const refund = computeMacedaRefund({
    totalPaymentsMade,
    contractStartDate: new Date(existing.reservation_date ?? existing.created_at),
    asOfDate,
  });

  if (existing.financing_application) {
    const { error: finErr } = await supabase
      .from("financing_applications")
      .update({ status: "cancelled" })
      .eq("id", existing.financing_application.id);
    if (finErr) throw new Error(finErr.message);
  }

  const { data, error } = await supabase
    .from("unit_sales")
    .update({
      status: "cancelled",
      cancelled_at: asOfDate.toISOString(),
      cancellation_reason: reason ?? null,
      refund_amount: refund.refundAmount,
    })
    .eq("id", String(id))
    .select(SALE_DETAIL_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return { data: mapSale(data as unknown as SaleRow), maceda_refund: refund };
}

export async function turnOverSale(
  id: string | number,
  turnover_date?: string,
): Promise<UnitSale> {
  const existing = await getActiveSale(id);
  if (existing.status !== "fully_paid") {
    throw new Error('Only a "fully_paid" sale can be turned over');
  }
  const turnedOverAt = turnover_date ? new Date(turnover_date) : new Date();
  const { data, error } = await supabase
    .from("unit_sales")
    .update({ status: "turned_over", turned_over_at: turnedOverAt.toISOString() })
    .eq("id", String(id))
    .select(SALE_DETAIL_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapSale(data as unknown as SaleRow);
}

// ─── Sale payments ────────────────────────────────────────────────────

export async function getSalePayments(saleId: string | number) {
  const { data, error } = await supabase
    .from("sale_payments")
    .select("*")
    .eq("sale_id", String(saleId))
    .order("payment_date", { ascending: false });
  if (error) throw new Error(error.message);
  const payments = (data ?? []) as SalePayment[];
  const totals: Record<string, number> = {};
  for (const p of payments) {
    totals[p.payment_type] = (totals[p.payment_type] ?? 0) + Number(p.amount);
  }
  return { data: payments, totals };
}

/**
 * All payment transactions across sales, filterable by type and date range.
 */
export async function getPayments(params?: {
  payment_type?: string;
  start_date?: string;
  end_date?: string;
}) {
  let base = supabase
    .from("sale_payments")
    .select(
      "*, sale:unit_sales(id, status, total_contract_price, unit:units(unit_number, properties(name)), buyer:tenants!unit_sales_buyer_id_fkey(full_name))",
      { count: "exact" },
    )
    .order("payment_date", { ascending: false });

  if (params?.payment_type) base = base.eq("payment_type", params.payment_type);
  if (params?.start_date) base = base.gte("payment_date", params.start_date);
  if (params?.end_date) base = base.lte("payment_date", params.end_date);

  const { data, error, count } = await base.range(0, 499);
  if (error) throw new Error(error.message);
  return {
    data: data ?? [],
    total: count ?? (data ?? []).length,
    total_amount: (data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0),
  };
}

export interface RecordPaymentInput {
  payment_type: PaymentType;
  amount: number;
  payment_method: string;
  payment_date?: string;
  reference?: string;
  notes?: string;
  amortization_schedule_id?: string;
}

/**
 * recordSalePayment — mirrors the source transaction: allocation buckets from
 * the active penalty rule (penalty → charges → interest → principal), then
 * reservation → equity_paying, installment paid/partial, all-paid → fully_paid.
 */
export async function recordSalePayment(
  saleId: string | number,
  body: RecordPaymentInput,
): Promise<SalePayment> {
  const sale = await getActiveSale(saleId);
  if (sale.status === "cancelled") {
    throw new Error("Cannot record a payment on a cancelled sale");
  }
  if (sale.status === "fully_paid") {
    throw new Error("Cannot record a payment: sale is fully paid");
  }
  if (!PAYMENT_TYPES.includes(body.payment_type)) {
    throw new Error(`payment_type must be one of: ${PAYMENT_TYPES.join(", ")}`);
  }
  if (!(body.amount > 0)) throw new Error("amount must be greater than zero");
  if (!body.payment_method) throw new Error("payment_method is required");

  const paymentDate = body.payment_date ? new Date(body.payment_date) : new Date();

  // Active penalty rule drives allocation order (as in the source).
  let order: string[] = ["penalty", "charges", "interest", "principal"];
  let rule: { method: PenaltyMethod; rate: number; grace_days: number } | null = null;
  const { data: found } = await supabase
    .from("penalty_rules")
    .select("method, rate, grace_days, allocation_order")
    .eq("active", true)
    .limit(1);
  const activeRule = (found ?? [])[0] as Row | undefined;
  if (activeRule) {
    rule = {
      method: activeRule.method as PenaltyMethod,
      rate: Number(activeRule.rate ?? 0),
      grace_days: activeRule.grace_days != null ? Number(activeRule.grace_days) : 0,
    };
    if (activeRule.allocation_order) {
      const parsed: unknown = JSON.parse(String(activeRule.allocation_order));
      if (Array.isArray(parsed) && parsed.length > 0) {
        order = parsed.map(String);
      }
    }
  }

  let linkedSchedule: Row | null = null;
  let buckets: { penalty: number; charges: number; interest: number; principal: number };
  if (body.payment_type === "penalty") {
    buckets = { penalty: Number(body.amount), charges: 0, interest: 0, principal: 0 };
  } else if (body.amortization_schedule_id) {
    const { data: linked, error } = await supabase
      .from("amortization_schedules")
      .select("*, financing_applications!inner(sale_id)")
      .eq("id", String(body.amortization_schedule_id))
      .eq("financing_applications.sale_id", String(saleId))
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!linked) {
      throw new Error("Amortization installment not found for this sale");
    }
    linkedSchedule = linked;
    const amountDue = Number(linked.amount_due);
    const paidBefore = Number(linked.paid_amount ?? 0);
    const remaining = Math.max(0, Math.round((amountDue - paidBefore) * 100) / 100);
    const interestDue = Math.min(Number(linked.interest_amount), remaining);
    const principalDue = Math.round((remaining - interestDue) * 100) / 100;
    let penaltyDue = 0;
    if (rule) {
      const daysOverdue = Math.floor(
        (paymentDate.getTime() - new Date(linked.due_date).getTime()) / 86_400_000,
      );
      if (daysOverdue > 0) {
        penaltyDue = calcPenalty(
          rule.method,
          amountDue,
          rule.rate,
          daysOverdue,
          rule.grace_days,
        );
      }
    }
    buckets = { penalty: penaltyDue, charges: 0, interest: interestDue, principal: principalDue };
  } else {
    buckets = { penalty: 0, charges: 0, interest: 0, principal: Number(body.amount) };
  }

  const allocation = allocatePayment(Number(body.amount), buckets, order);

  const { data: payment, error: payErr } = await supabase
    .from("sale_payments")
    .insert({
      sale_id: String(saleId),
      amortization_schedule_id: body.amortization_schedule_id
        ? String(body.amortization_schedule_id)
        : null,
      payment_type: body.payment_type,
      amount: body.amount,
      payment_method: body.payment_method,
      payment_date: paymentDate.toISOString().slice(0, 10),
      reference: body.reference ?? null,
      notes: body.notes ?? null,
      allocation_json: JSON.stringify(allocation),
    })
    .select("*")
    .single();
  if (payErr) throw new Error(payErr.message);

  if (body.payment_type === "reservation") {
    await supabase
      .from("unit_sales")
      .update({
        reservation_paid: true,
        reservation_date:
          sale.reservation_date ?? paymentDate.toISOString().slice(0, 10),
        status: sale.status === "reserved" ? "equity_paying" : sale.status,
      })
      .eq("id", String(saleId));
  }

  if (body.payment_type === "amortization" && linkedSchedule) {
    const installment = linkedSchedule;
    const paidSoFar =
      Math.round(
        (Number(installment.paid_amount ?? 0) + allocation.interest + allocation.principal) *
          100,
      ) / 100;
    await supabase
      .from("amortization_schedules")
      .update({
        paid_amount: paidSoFar,
        paid_date: paymentDate.toISOString().slice(0, 10),
        status: paidSoFar >= Number(installment.amount_due) ? "paid" : "partial",
      })
      .eq("id", String(installment.id));

    const { count: remaining } = await supabase
      .from("amortization_schedules")
      .select("id", { count: "exact" })
      .eq("financing_application_id", String(installment.financing_application_id))
      .neq("status", "paid");
    if (remaining === 0) {
      await supabase
        .from("unit_sales")
        .update({ status: "fully_paid" })
        .eq("id", String(saleId));
    }
  }

  return payment as SalePayment;
}

// ─── Financing ────────────────────────────────────────────────────────

export async function getFinancing(saleId: string | number) {
  const { data, error } = await supabase
    .from("financing_applications")
    .select("*")
    .eq("sale_id", String(saleId))
    .maybeSingle();
  if (error) throw new Error(error.message);
  const app = (data as FinancingApplication | null) ?? null;
  if (!app) return { data: null, advisory: null };
  const sale = await getActiveSale(saleId);
  const check = validateFinancingTerms(termsCheckInput(sale, app));
  return { data: app, advisory: check };
}

export interface CreateFinancingInput {
  financing_type: FinancingType;
  lender_name?: string;
  loan_amount?: number;
  down_payment_amount?: number;
  down_payment_term_months?: number;
  interest_rate_annual?: number;
  loan_term_months?: number;
  repricing_period_years?: number;
  processing_fee?: number;
  mri_premium?: number;
  fire_insurance_premium?: number;
  notes?: string;
}

export async function createFinancing(
  saleId: string | number,
  body: CreateFinancingInput,
): Promise<{ data: FinancingApplication; advisory: FinancingAdvisory }> {
  const sale = await getActiveSale(saleId);
  const draftApp: FinancingApplication = {
    id: "",
    sale_id: String(saleId),
    financing_type: body.financing_type,
    lender_name: body.lender_name ?? null,
    loan_amount: body.loan_amount ?? null,
    down_payment_amount: body.down_payment_amount ?? null,
    down_payment_term_months: body.down_payment_term_months ?? null,
    interest_rate_annual: body.interest_rate_annual ?? null,
    loan_term_months: body.loan_term_months ?? null,
    repricing_period_years: body.repricing_period_years ?? null,
    processing_fee: body.processing_fee ?? null,
    mri_premium: body.mri_premium ?? null,
    fire_insurance_premium: body.fire_insurance_premium ?? null,
    status: "draft",
  };
  const advisory = validateFinancingTerms(termsCheckInput(sale, draftApp));
  if (advisory.errors.length > 0) {
    throw new Error(
      `Financing terms are invalid for the chosen type:\n- ${advisory.errors.join("\n- ")}`,
    );
  }

  const { data, error } = await supabase
    .from("financing_applications")
    .insert({
      sale_id: String(saleId),
      ...financingBody(body as unknown as Row),
      down_payment_term_months:
        body.down_payment_term_months ?? 0,
      interest_rate_annual: body.interest_rate_annual ?? 0,
      status: "draft",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await supabase
    .from("unit_sales")
    .update({ status: "financing_pending" })
    .eq("id", String(saleId));

  return { data: data as FinancingApplication, advisory };
}

export async function updateFinancing(
  saleId: string | number,
  body: Partial<CreateFinancingInput>,
): Promise<FinancingApplication> {
  const { data: existing } = await supabase
    .from("financing_applications")
    .select("status")
    .eq("sale_id", String(saleId))
    .maybeSingle();
  const current = (existing ?? { status: null }) as { status: string | null };
  if (!current.status) throw new Error("No financing application on this sale yet");
  if (!["draft", "disapproved"].includes(current.status)) {
    throw new Error(`Cannot edit terms while status is "${current.status}"`);
  }

  const { data, error } = await supabase
    .from("financing_applications")
    .update(financingBody(body as unknown as Row))
    .eq("sale_id", String(saleId))
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as FinancingApplication;
}

export async function updateFinancingStatus(
  saleId: string | number,
  status: string,
  extra?: { disapproval_reason?: string; loan_takeout_date?: string },
): Promise<{ data: FinancingApplication; installments_generated?: number }> {
  const current = (await getFinancing(saleId)).data;
  if (!current) throw new Error("No financing application on this sale yet");
  validateStatusTransition(current.status, status, FINANCING_STATUS_TRANSITIONS);

  if (status === "approved") {
    const sale = await getActiveSale(saleId);
    const check = validateFinancingTerms(termsCheckInput(sale, current));
    if (check.errors.length > 0) {
      throw new Error(
        `Cannot approve — financing terms are invalid:\n- ${check.errors.join("\n- ")}`,
      );
    }
    if (!current.loan_amount || Number(current.loan_amount) <= 0) {
      throw new Error("loan_amount must be set before approval");
    }
    if (!current.loan_term_months || current.loan_term_months <= 0) {
      throw new Error("loan_term_months must be set before approval");
    }

    const takeoutDate = extra?.loan_takeout_date
      ? new Date(extra.loan_takeout_date)
      : new Date();
    const schedule = generateAmortizationSchedule({
      principal: Number(current.loan_amount),
      annualInterestRatePercent: Number(current.interest_rate_annual ?? 0),
      termMonths: current.loan_term_months,
      startDate: takeoutDate,
    });

    // Regenerate: delete + rebuild (same as source transaction).
    await supabase
      .from("amortization_schedules")
      .delete()
      .eq("financing_application_id", current.id);
    const { error: insErr } = await supabase
      .from("amortization_schedules")
      .insert(
        schedule.map((row) => ({
          financing_application_id: current.id,
          installment_number: row.installment_number,
          due_date: row.due_date.toISOString().slice(0, 10),
          principal_amount: row.principal_amount,
          interest_amount: row.interest_amount,
          amount_due: row.amount_due,
          running_balance: row.running_balance,
        })),
      );
    if (insErr) throw new Error(insErr.message);

    await supabase
      .from("unit_sales")
      .update({ status: "financing_approved" })
      .eq("id", String(saleId));

    const { data, error } = await supabase
      .from("financing_applications")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        loan_takeout_date: takeoutDate.toISOString().slice(0, 10),
        disapproval_reason: null,
      })
      .eq("sale_id", String(saleId))
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { data: data as FinancingApplication, installments_generated: schedule.length };
  }

  await supabase
    .from("financing_applications")
    .update({
      status,
      submitted_at: status === "submitted" ? new Date().toISOString() : undefined,
      disapproval_reason: status === "disapproved" ? (extra?.disapproval_reason ?? null) : null,
    })
    .eq("sale_id", String(saleId));
  return (await getFinancing(saleId)) as { data: FinancingApplication };
}

export async function getAmortizationSchedule(
  saleId: string | number,
): Promise<AmortizationInstallment[]> {
  const financing = (await getFinancing(saleId)).data;
  if (!financing) {
    throw new Error("No financing application on this sale yet");
  }
  const { data, error } = await supabase
    .from("amortization_schedules")
    .select("*")
    .eq("financing_application_id", financing.id)
    .order("installment_number");
  if (error) throw new Error(error.message);
  return (data ?? []) as AmortizationInstallment[];
}
