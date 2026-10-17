// Dashboard API over the 4 backed tables. Domains without backing tables
// (maintenance, sales) report neutral zeros rather than failing.
import { supabase } from "./client";

export interface DashboardOverview {
  total_properties: number;
  total_units: number;
  occupancy_rate: number;
  active_tenants: number;
  open_tickets: number;
  monthly_revenue: number;
  outstanding_balance: number;
  maintenance_costs: number;
  sales_active_count: number;
  sales_pipeline_value: number;
  sales_pending_financing: number;
  sales_completed_value: number;
  overdue_leases: number;
}

export interface RevenuePoint {
  month: string;
  revenue: number;
}

function monthStart(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const [props, units, occupied, tenants, payments] = await Promise.all([
    supabase.from("properties").select("id", { count: "exact", head: true }),
    supabase.from("units").select("id", { count: "exact", head: true }),
    supabase
      .from("units")
      .select("id", { count: "exact", head: true })
      .eq("status", "occupied"),
    supabase
      .from("tenants")
      .select("id", { count: "exact", head: true })
      .not("unit_id", "is", null),
    supabase
      .from("payments")
      .select("amount")
      .gte("for_month", monthStart(new Date())),
  ]);

  if (props.error) throw new Error(props.error.message);
  if (units.error) throw new Error(units.error.message);
  if (occupied.error) throw new Error(occupied.error.message);
  if (tenants.error) throw new Error(tenants.error.message);
  if (payments.error) throw new Error(payments.error.message);

  const totalUnits = units.count ?? 0;
  const rate =
    totalUnits === 0 ? 0 : Math.round(((occupied.count ?? 0) / totalUnits) * 100);
  const monthly =
    (payments.data ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);

  return {
    total_properties: props.count ?? 0,
    total_units: totalUnits,
    occupancy_rate: rate,
    active_tenants: tenants.count ?? 0,
    open_tickets: 0,
    monthly_revenue: monthly,
    outstanding_balance: 0,
    maintenance_costs: 0,
    sales_active_count: 0,
    sales_pipeline_value: 0,
    sales_pending_financing: 0,
    sales_completed_value: 0,
    overdue_leases: 0,
  };
}

export async function getDashboardRevenue(_params?: {
  period?: string;
}): Promise<{ monthly: RevenuePoint[] }> {
  const now = new Date();
  const start = monthStart(new Date(now.getFullYear(), now.getMonth() - 11, 1));
  const { data, error } = await supabase
    .from("payments")
    .select("amount, for_month")
    .gte("for_month", start);
  if (error) throw new Error(error.message);

  const buckets = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.set(d.toISOString().slice(0, 7), 0);
  }
  for (const p of data ?? []) {
    const key = String(p.for_month ?? "").slice(0, 7);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + Number(p.amount ?? 0));
  }
  const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthly = [...buckets.entries()].map(([key, revenue]) => ({
    month: monthsShort[Number(key.slice(5, 7)) - 1],
    revenue,
  }));
  return { monthly };
}
