// Billing/payments API over `payments` + tenants/units. Source REST endpoints
// (/billing/*) replaced; same shapes BillingPage consumes.
import { supabase } from "./client";
import { ilikeTerm, paginate } from "./properties";

export interface BillingStats {
  revenue: { total_revenue: number; payment_count: number };
  outstanding: { total_outstanding: number; invoice_count: number };
  late_payments: { late_payment_count: number; late_payment_total: number };
}

export interface CollectionItem {
  lease_id: string;
  tenant_id: string;
  unit_id: string;
  tenant_name: string;
  total_amount: number;
  due_date: string;
  for_month: string;
  source: string;
  type: string;
  schedule_id: string | undefined;
}

export async function getBillingStats(): Promise<BillingStats> {
  const { data, error, count } = await supabase
    .from("payments")
    .select("amount", { count: "exact" });
  if (error) throw new Error(error.message);
  const total = (data ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
  // No invoices table in this model — outstanding and late are neutral zeros.
  return {
    revenue: { total_revenue: total, payment_count: count ?? 0 },
    outstanding: { total_outstanding: 0, invoice_count: 0 },
    late_payments: { late_payment_count: 0, late_payment_total: 0 },
  };
}

const PAY_SELECT =
  "*, tenant:tenants(id, full_name), unit:units(id, unit_number)";

function mapPayment(row: Record<string, unknown>) {
  const tenant = row.tenant as { full_name?: string } | null;
  const name = tenant?.full_name ?? "";
  return {
    ...row,
    id: String(row.id),
    payment_date: (row.paid_on as string) ?? (row.for_month as string),
    tenant_id: String(((tenant as unknown as Row)?.id ?? "")),
    tenant_name: name,
    tenant_first_name: name.split(" ")[0] || null,
    tenant_last_name: name.split(" ").slice(1).join(" ") || null,
    tenant_unit_number: ((row.unit as { unit_number?: string } | null)?.unit_number) ?? null,
    amount: Number(row.amount ?? 0),
    payment_method: (row.method as string) ?? null,
    payment_type: "rent",
    status: "completed",
  };
}

type Row = Record<string, unknown>;

export async function getPayments(params?: Record<string, string>) {
  const page = Math.max(1, Number(params?.page ?? 1));
  const limit = Math.max(1, Number(params?.limit ?? 20));
  const search = params?.search ? ilikeTerm(params.search) : "";
  const ascending = (params?.sort_order ?? "DESC").toUpperCase() !== "DESC";

  let base = supabase
    .from("payments")
    .select(PAY_SELECT, { count: "exact" })
    .order("paid_on", { ascending, nullsFirst: false })
    .order("created_at", { ascending });

  if (search) {
    base = base.or(
      `note.ilike.%${search}%,method.ilike.%${search}%`,
    );
  }

  const from = (page - 1) * limit;
  const { data, error, count } = await base.range(from, from + limit - 1);
  if (error) throw new Error(error.message);
  const payments = (data ?? []).map(mapPayment);
  const total = count ?? payments.length;
  return paginate(payments, page, limit, total);
}

// Collection list = assigned tenants × unit rent for the chosen month,
// minus rows already collected for that month.
export async function getMonthlyCollectionList(params: {
  month: number;
  year: number;
}): Promise<CollectionItem[]> {
  const mm = String(params.month).padStart(2, "0");
  const forMonth = `${params.year}-${mm}-01`;

  const { data: rows, error } = await supabase
    .from("tenants")
    .select(
      "id, full_name, unit_id, unit:units!inner(id, rent, unit_number, properties(name))",
    )
    .not("unit_id", "is", null);
  if (error) throw new Error(error.message);

  const { data: paid, error: paidErr } = await supabase
    .from("payments")
    .select("tenant_id")
    .eq("for_month", forMonth);
  if (paidErr) throw new Error(paidErr.message);
  const paidSet = new Set((paid ?? []).map((p) => String(p.tenant_id)));

  return (rows ?? [])
    .filter((r: Row) => !paidSet.has(String(r.id)))
    .map((r: Row) => {
      const unit = r.unit as { rent?: number; unit_number?: string } | null;
      const pname = unit?.unit_number
        ? (unit as unknown as { properties?: { name?: string } }).properties?.name
        : "";
      return {
        lease_id: String(r.id),
        tenant_id: String(r.id),
        unit_id: String(r.unit_id ?? ""),
        tenant_name: String(r.full_name ?? ""),
        total_amount: Number(unit?.rent ?? 0),
        due_date: forMonth,
        for_month: forMonth,
        source: pname
          ? `Rent · ${pname} · Unit ${unit?.unit_number ?? ""}`
          : "Rent",
        type: "lease",
        schedule_id: undefined,
      } satisfies CollectionItem;
    });
}

type RecordPaymentBody = Record<string, unknown> & {
  tenant_id?: string | number;
  amount: number;
  payment_date?: string;
  payment_method?: string;
  for_month?: string;
  notes?: string | null;
};

const METHODS = new Set(["cash", "gcash", "bank", "other"]);

export async function recordPayment(body: RecordPaymentBody) {
  const tenantId = body.tenant_id != null ? String(body.tenant_id) : null;
  if (!tenantId) throw new Error("tenant_id required");
  const { data: tenant } = await supabase
    .from("tenants")
    .select("unit_id")
    .eq("id", tenantId)
    .maybeSingle();
  const method =
    body.payment_method && METHODS.has(body.payment_method)
      ? body.payment_method
      : "other";
  const { data, error } = await supabase
    .from("payments")
    .insert({
      tenant_id: tenantId,
      unit_id: ((tenant as Row | null)?.unit_id as string | undefined) ?? null,
      amount: body.amount,
      method,
      for_month: body.for_month ?? body.payment_date ?? todayISO(),
      paid_on: body.payment_date ?? todayISO(),
      note: body.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapPayment(data);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
