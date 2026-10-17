// Item financing over Supabase (repairs, appliances, admin categories).
// Money math vendored from the source server: schedule generation on approval,
// full-amount credit to the linked installment, auto-complete when all paid.
import { supabase } from "./client";
import { ilikeTerm, paginate } from "./properties";
import { generateAmortizationSchedule } from "../lib/financing";
import { validateItemFinancingTerms } from "../lib/itemFinancingTerms";

export const ITEM_FINANCING_TYPES = [
  "spot_cash",
  "deferred_cash",
  "in_house_financing",
  "bank_financing",
] as const;
export type ItemFinancingType = (typeof ITEM_FINANCING_TYPES)[number];

export const ITEM_FINANCING_TYPE_LABELS: Record<ItemFinancingType, string> = {
  spot_cash: "Spot Cash",
  deferred_cash: "Deferred Cash (0% in-house)",
  in_house_financing: "In-House Financing",
  bank_financing: "Bank Financing",
};

export const ITEM_PAYMENT_TYPES = ["down_payment", "installment", "penalty", "refund"] as const;
export type ItemPaymentType = (typeof ITEM_PAYMENT_TYPES)[number];

export const ITEM_FINANCING_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["under_review", "cancelled"],
  under_review: ["approved", "disapproved", "cancelled"],
  approved: ["completed", "cancelled"],
  disapproved: ["draft", "cancelled"],
  cancelled: [],
  completed: [],
};

export interface ItemFinancingRequest {
  id: string;
  category_id: string;
  requester_id: string;
  unit_id?: string | null;
  maintenance_ticket_id?: string | null;
  item_description: string;
  vendor_name?: string | null;
  total_cost: string | number;
  financing_type: ItemFinancingType;
  loan_amount?: string | number | null;
  down_payment_amount?: string | number | null;
  interest_rate_annual?: string | number | null;
  loan_term_months?: number | null;
  processing_fee?: string | number | null;
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
  notes?: string | null;
  created_at: string;
  category?: FinancingCategoryRef;
  requester?: { id: string; name: string; email?: string | null; phone?: string | null };
  unit?: { id: string; unit_number: string; property_id: string } | null;
  maintenance_ticket?: { id: string; ticket_number: string; status: string } | null;
}

export interface FinancingCategoryRef {
  id: string;
  name: string;
}

export interface ItemAmortizationInstallment {
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

export interface ItemFinancingPayment {
  id: string;
  item_financing_request_id: string;
  amortization_schedule_id?: string | null;
  payment_type: ItemPaymentType;
  amount: string | number;
  payment_method: string;
  payment_date: string;
  reference?: string | null;
  notes?: string | null;
  or_number?: string | null;
}

export interface ItemFinancingAdvisory {
  errors: string[];
  warnings: string[];
}

type Row = Record<string, unknown>;

type RequestRow = Row & {
  category?: Row | null;
  requester?: Row | null;
  unit?: Row | null;
  maintenance_ticket?: Row | null;
};

const REQUEST_SELECT =
  "*, category:financing_categories(id, name), " +
  "requester:tenants!item_financing_requests_requester_id_fkey(id, full_name, email, phone), " +
  "unit:units(id, unit_number, property_id), " +
  "maintenance_ticket:maintenance_tickets(id, ticket_number, status)";

function mapRequest(row: RequestRow): ItemFinancingRequest {
  const unit = (row.unit ?? undefined) as (Row & { unit_number?: string }) | undefined;
  return {
    id: String(row.id),
    category_id: String(row.category_id ?? ""),
    requester_id: String(row.requester_id ?? ""),
    unit_id: (row.unit_id as string) ?? null,
    maintenance_ticket_id: (row.maintenance_ticket_id as string) ?? null,
    item_description: String(row.item_description ?? ""),
    vendor_name: (row.vendor_name as string) ?? null,
    total_cost: row.total_cost != null ? Number(row.total_cost) : 0,
    financing_type: (row.financing_type as ItemFinancingType) ?? "in_house_financing",
    loan_amount: row.loan_amount != null ? Number(row.loan_amount) : null,
    down_payment_amount:
      row.down_payment_amount != null ? Number(row.down_payment_amount) : null,
    interest_rate_annual:
      row.interest_rate_annual != null ? Number(row.interest_rate_annual) : null,
    loan_term_months: row.loan_term_months != null ? Number(row.loan_term_months) : null,
    processing_fee: row.processing_fee != null ? Number(row.processing_fee) : null,
    status:
      (row.status as ItemFinancingRequest["status"]) ?? "draft",
    submitted_at: (row.submitted_at as string) ?? null,
    approved_at: (row.approved_at as string) ?? null,
    disapproval_reason: (row.disapproval_reason as string) ?? null,
    notes: (row.notes as string) ?? null,
    created_at: String(row.created_at ?? ""),
    category: (row.category as ItemFinancingRequest["category"]) ?? undefined,
    requester: row.requester
      ? {
          id: String((row.requester as Row).id),
          name: String((row.requester as Row).full_name ?? ""),
          email: ((row.requester as Row).email as string) ?? null,
          phone: ((row.requester as Row).phone as string) ?? null,
        }
      : undefined,
    unit: unit
      ? {
          id: String(unit.id),
          unit_number: String(unit.unit_number ?? ""),
          property_id: String(unit.property_id ?? ""),
        }
      : null,
    maintenance_ticket: (row.maintenance_ticket as ItemFinancingRequest["maintenance_ticket"]) ?? null,
  };
}

const REQUEST_COLS = new Set([
  "item_description",
  "vendor_name",
  "total_cost",
  "financing_type",
  "loan_amount",
  "down_payment_amount",
  "interest_rate_annual",
  "loan_term_months",
  "processing_fee",
  "notes",
  "unit_id",
]);

function requestBody(body: Record<string, unknown>): Row {
  const row: Row = {};
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && REQUEST_COLS.has(k)) row[k] = v;
  }
  if (row.unit_id) row.unit_id = String(row.unit_id);
  return row;
}

async function getRequestRow(
  id: string | number,
): Promise<{ request: ItemFinancingRequest; row: RequestRow }> {
  const { data, error } = await supabase
    .from("item_financing_requests")
    .select(REQUEST_SELECT)
    .eq("id", String(id))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Item financing request not found");
  return { request: mapRequest(data as unknown as RequestRow), row: data as unknown as RequestRow };
}

function termsInput(row: RequestRow): Parameters<typeof validateItemFinancingTerms>[0] {
  return {
    financingType: row.financing_type as ItemFinancingType,
    totalCost: Number(row.total_cost ?? 0),
    downPaymentAmount: Number(row.down_payment_amount ?? 0),
    loanAmount: Number(row.loan_amount ?? 0),
    loanTermMonths: Number(row.loan_term_months ?? 0),
    interestRateAnnual: Number(row.interest_rate_annual ?? 0),
  };
}

// ─── Requests ─────────────────────────────────────────────────────────

export async function getItemFinancingRequests(params?: Record<string, string>) {
  const page = Math.max(1, Number(params?.page ?? 1));
  const limit = Math.max(1, Number(params?.limit ?? 100));
  const search = params?.search ? ilikeTerm(params.search) : "";

  let base = supabase
    .from("item_financing_requests")
    .select(REQUEST_SELECT, { count: "exact" })
    .order("created_at", { ascending: false });

  if (params?.status) base = base.eq("status", params.status);
  if (params?.category_id) base = base.eq("category_id", String(params.category_id));
  if (search) {
    base = base.or(
      `item_description.ilike.%${search}%,vendor_name.ilike.%${search}%`,
    );
  }

  const from = (page - 1) * limit;
  const { data, error, count } = await base.range(from, from + limit - 1);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((r) => mapRequest(r as unknown as RequestRow));
  return paginate(rows, page, limit, count ?? rows.length);
}

export async function getItemFinancingRequest(id: string | number) {
  const { request, row } = await getRequestRow(id);
  const advisoryReq = validateItemFinancingTerms(termsInput(row));
  const advisory: ItemFinancingAdvisory = {
    errors: advisoryReq.errors,
    warnings: advisoryReq.warnings,
  };
  return { data: request, advisory };
}

export interface CreateItemFinancingInput {
  category_id: string;
  requester_id: string;
  unit_id?: string;
  maintenance_ticket_id?: string;
  item_description: string;
  vendor_name?: string;
  total_cost: number;
  financing_type: ItemFinancingType;
  loan_amount?: number;
  down_payment_amount?: number;
  interest_rate_annual?: number;
  loan_term_months?: number;
  processing_fee?: number;
  notes?: string;
}

export async function createItemFinancingRequest(body: CreateItemFinancingInput) {
  const advisoryReq = validateItemFinancingTerms({
    financingType: body.financing_type,
    totalCost: Number(body.total_cost ?? 0),
    downPaymentAmount: Number(body.down_payment_amount ?? 0),
    loanAmount: Number(body.loan_amount ?? 0),
    loanTermMonths: Number(body.loan_term_months ?? 0),
    interestRateAnnual: Number(body.interest_rate_annual ?? 0),
  });
  const advisory: ItemFinancingAdvisory = {
    errors: advisoryReq.errors,
    warnings: advisoryReq.warnings,
  };

  const payload = requestBody(body as unknown as Row);
  payload.category_id = String(body.category_id);
  payload.requester_id = String(body.requester_id);
  if (body.maintenance_ticket_id) {
    payload.maintenance_ticket_id = String(body.maintenance_ticket_id);
  }
  payload.status = "draft";

  const { data, error } = await supabase
    .from("item_financing_requests")
    .insert(payload)
    .select(REQUEST_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return {
    data: mapRequest(data as unknown as RequestRow),
    advisory,
  };
}

export async function updateItemFinancingRequest(
  id: string | number,
  body: Partial<CreateItemFinancingInput>,
): Promise<ItemFinancingRequest> {
  const payload = requestBody(body as unknown as Row);
  const { data, error } = await supabase
    .from("item_financing_requests")
    .update(payload)
    .eq("id", String(id))
    .select(REQUEST_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapRequest(data as unknown as RequestRow);
}

function validateStatusTransition(current: string, next: string) {
  const allowed = ITEM_FINANCING_STATUS_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(
      `Cannot move from "${current}" to "${next}" (allowed: ${allowed.join(", ") || "none"})`,
    );
  }
}

export async function updateItemFinancingStatus(
  id: string | number,
  status: string,
  extra?: { disapproval_reason?: string },
) {
  const { row } = await getRequestRow(id);
  validateStatusTransition(row.status as string, status);

  if (status === "approved") {
    const check = validateItemFinancingTerms(termsInput(row));
    if (check.errors.length > 0) {
      throw new Error(
        `Cannot approve — financing terms are invalid:\n- ${check.errors.join("\n- ")}`,
      );
    }
    if (!row.loan_amount || Number(row.loan_amount) <= 0) {
      throw new Error("loan_amount must be set before approval");
    }
    if (!row.loan_term_months || Number(row.loan_term_months ?? 0) <= 0) {
      throw new Error("loan_term_months must be set before approval");
    }

    const schedule = generateAmortizationSchedule({
      principal: Number(row.loan_amount),
      annualInterestRatePercent: Number(row.interest_rate_annual ?? 0),
      termMonths: Number(row.loan_term_months),
      startDate: new Date(),
    });

    // Regenerate the schedule (same as source transaction).
    await supabase
      .from("item_amortization_schedules")
      .delete()
      .eq("item_financing_request_id", String(id));
    const { error: insErr } = await supabase
      .from("item_amortization_schedules")
      .insert(
        schedule.map((r) => ({
          item_financing_request_id: String(id),
          installment_number: r.installment_number,
          due_date: r.due_date.toISOString().slice(0, 10),
          principal_amount: r.principal_amount,
          interest_amount: r.interest_amount,
          amount_due: r.amount_due,
          running_balance: r.running_balance,
        })),
      );
    if (insErr) throw new Error(insErr.message);
  }

  const { data, error } = await supabase
    .from("item_financing_requests")
    .update({
      status,
      submitted_at: status === "submitted" ? new Date().toISOString() : undefined,
      approved_at: status === "approved" ? new Date().toISOString() : undefined,
      disapproval_reason:
        status === "disapproved" ? (extra?.disapproval_reason ?? null) : null,
    })
    .eq("id", String(id))
    .select(REQUEST_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return {
    data: mapRequest(data as unknown as RequestRow),
    installments_generated: status === "approved" ? Number(row.loan_term_months ?? 0) : undefined,
  };
}

/**
 * Admin override: move a final-state request back to approved so corrections
 * can be posted. Same rule as the source route (completed/cancelled only).
 */
export async function resetItemFinancingStatus(
  id: string | number,
): Promise<ItemFinancingRequest> {
  const { row } = await getRequestRow(id);
  if (!["completed", "cancelled"].includes(String(row.status))) {
    throw new Error("Only requests in a final state (completed/cancelled) can be reset");
  }
  const { data, error } = await supabase
    .from("item_financing_requests")
    .update({ status: "approved" })
    .eq("id", String(id))
    .select(REQUEST_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapRequest(data as unknown as RequestRow);
}

// ─── Schedule + payments ──────────────────────────────────────────────

export async function getItemAmortizationSchedule(
  id: string | number,
): Promise<ItemAmortizationInstallment[]> {
  const { error, data } = await supabase
    .from("item_amortization_schedules")
    .select("*")
    .eq("item_financing_request_id", String(id))
    .order("installment_number");
  if (error) throw new Error(error.message);
  return (data ?? []) as ItemAmortizationInstallment[];
}

export async function getItemFinancingPayments(
  id: string | number,
): Promise<ItemFinancingPayment[]> {
  const { data, error } = await supabase
    .from("item_financing_payments")
    .select("*")
    .eq("item_financing_request_id", String(id))
    .order("payment_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ItemFinancingPayment[];
}

export interface RecordItemPaymentInput {
  payment_type: ItemPaymentType;
  amount: number;
  payment_method: string;
  payment_date?: string;
  reference?: string;
  notes?: string;
  or_number?: string;
  amortization_schedule_id?: string;
}

/**
 * recordItemFinancingPayment — mirrors the source: request must be approved,
 * the full amount credits the linked installment (no allocation buckets), and
 * the request completes once every installment clears.
 */
export async function recordItemFinancingPayment(
  id: string | number,
  body: RecordItemPaymentInput,
): Promise<ItemFinancingPayment> {
  const { row } = await getRequestRow(id);
  if (row.status !== "approved") {
    throw new Error(
      `Cannot record a payment while status is "${row.status}" (must be "approved")`,
    );
  }
  if (!ITEM_PAYMENT_TYPES.includes(body.payment_type)) {
    throw new Error(`payment_type must be one of: ${ITEM_PAYMENT_TYPES.join(", ")}`);
  }
  if (!(Number(body.amount) > 0)) {
    throw new Error("amount must be greater than zero");
  }
  if (!body.payment_method) throw new Error("payment_method is required");

  const paymentDate = body.payment_date ? new Date(body.payment_date) : new Date();
  const linkedScheduleId = body.amortization_schedule_id
    ? String(body.amortization_schedule_id)
    : null;

  const { data: payment, error: payErr } = await supabase
    .from("item_financing_payments")
    .insert({
      item_financing_request_id: String(id),
      amortization_schedule_id: linkedScheduleId,
      payment_type: body.payment_type,
      amount: body.amount,
      payment_method: body.payment_method,
      payment_date: paymentDate.toISOString().slice(0, 10),
      reference: body.reference ?? null,
      notes: body.notes ?? null,
      or_number: body.or_number ?? null,
    })
    .select("*")
    .single();
  if (payErr) throw new Error(payErr.message);

  if (body.payment_type === "installment" && linkedScheduleId) {
    const { data: installment, error: instErr } = await supabase
      .from("item_amortization_schedules")
      .select("*")
      .eq("id", linkedScheduleId)
      .eq("item_financing_request_id", String(id))
      .maybeSingle();
    if (instErr) throw new Error(instErr.message);
    if (!installment) {
      throw new Error("Amortization installment not found for this request");
    }

    const paidSoFar =
      Math.round((Number(installment.paid_amount ?? 0) + Number(body.amount)) * 100) / 100;
    await supabase
      .from("item_amortization_schedules")
      .update({
        paid_amount: paidSoFar,
        paid_date: paymentDate.toISOString().slice(0, 10),
        status: paidSoFar >= Number(installment.amount_due) ? "paid" : "partial",
      })
      .eq("id", installment.id);

    const { count: remaining } = await supabase
      .from("item_amortization_schedules")
      .select("id", { count: "exact" })
      .eq("item_financing_request_id", String(id))
      .neq("status", "paid");
    if (remaining === 0) {
      await supabase
        .from("item_financing_requests")
        .update({ status: "completed" })
        .eq("id", String(id));
    }
  }

  return payment as ItemFinancingPayment;
}

export interface ItemFinancingPaymentRow extends ItemFinancingPayment {
  request?: {
    id: string;
    item_description: string;
    status: string;
    category?: { id: string; name: string } | null;
    requester?: { id: string; name: string } | null;
    unit?: { id: string; unit_number: string } | null;
  } | null;
}

/**
 * All item-financing payments across requests (staff ledger view), filterable
 * by type/request/date range.
 */
export async function getItemFinancingPaymentsList(params?: {
  payment_type?: string;
  request_id?: string;
  start_date?: string;
  end_date?: string;
}) {
  let base = supabase
    .from("item_financing_payments")
    .select(
      "*, request:item_financing_requests(id, item_description, status, " +
        "category:financing_categories(id, name), " +
        "requester:tenants!item_financing_requests_requester_id_fkey(id, full_name), " +
        "unit:units(id, unit_number))",
      { count: "exact" },
    )
    .order("payment_date", { ascending: false });

  if (params?.payment_type) base = base.eq("payment_type", params.payment_type);
  if (params?.request_id) {
    base = base.eq("item_financing_request_id", String(params.request_id));
  }
  if (params?.start_date) base = base.gte("payment_date", params.start_date);
  if (params?.end_date) base = base.lte("payment_date", params.end_date);

  const { data, error, count } = await base.range(0, 499);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as ItemFinancingPaymentRow[];
  return {
    data: rows,
    total: count ?? rows.length,
    total_amount: rows.reduce((s, r) => s + Number(r.amount ?? 0), 0),
  };
}

export async function deleteItemFinancingRequest(id: string | number): Promise<void> {
  const { error } = await supabase
    .from("item_financing_requests")
    .delete()
    .eq("id", String(id));
  if (error) throw new Error(error.message);
}
