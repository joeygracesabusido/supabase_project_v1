// Lease API: el-property keeps a leases table; this project models assignment
// on tenants.unit_id + lease_start/lease_end/deposit. Adapter keeps the modals
// working verbatim. One active lease per tenant (id = tenant id).
import { supabase } from "./client";
import { ilikeTerm, paginate } from "./properties";
import type { TenantLease } from "./tenants";

export interface Lease {
  id: string;
  tenant_id: string;
  unit_id: string;
  start_date: string | null;
  end_date: string | null;
  deposit_amount?: number | null;
  status: string;
  rent_amount?: number | null;
  total_rent_amount?: number | null;
  tenant_name?: string;
  tenant_email?: string;
  unit_number?: string;
  property_name?: string;
}

type Row = Record<string, unknown>;

type LeaseRow = Row & {
  unit?: (Row & { unit_number?: string; properties?: { name?: string } | null }) | null;
};

const LEASE_SELECT =
  "*, unit:units(id, unit_number, rent, properties(name))";

function mapLease(row: LeaseRow): Lease {
  const unit = row.unit;
  return {
    id: String(row.id),
    tenant_id: String(row.id),
    unit_id: String(unit?.id ?? ""),
    start_date: (row.lease_start as string) ?? null,
    end_date: (row.lease_end as string) ?? null,
    deposit_amount: row.deposit != null ? Number(row.deposit) : null,
    status: unit ? "active" : "terminated",
    rent_amount: unit?.rent != null ? Number(unit.rent) : null,
    total_rent_amount: unit?.rent != null ? Number(unit.rent) : null,
    tenant_name: (row.full_name as string) ?? undefined,
    tenant_email: (row.email as string) ?? undefined,
    unit_number: (unit?.unit_number as string) ?? undefined,
    property_name: unit?.properties?.name,
  };
}

export async function getLeases(params?: Record<string, string>) {
  const page = Math.max(1, Number(params?.page ?? 1));
  const limit = Math.max(1, Number(params?.limit ?? 20));
  const search = params?.search ? ilikeTerm(params.search) : "";

  let base = supabase
    .from("tenants")
    .select(LEASE_SELECT, { count: "exact" })
    .order("created_at", { ascending: false });
  if (params?.tenant_id) base = base.eq("id", String(params.tenant_id));
  if (params?.status === "active") base = base.not("unit_id", "is", null);
  if (search) base = base.or(`full_name.ilike.%${search}%`);

  const from = (page - 1) * limit;
  const { data, error, count } = await base.range(from, from + limit - 1);
  if (error) throw new Error(error.message);
  const leases = (data ?? []).map((r) => mapLease(r as LeaseRow));
  return paginate(leases, page, limit, count ?? leases.length);
}

export async function getLease(id: string | number) {
  const { data, error } = await supabase
    .from("tenants")
    .select(LEASE_SELECT)
    .eq("id", String(id))
    .not("unit_id", "is", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lease not found");
  return mapLease(data as LeaseRow);
}

async function freeUnit(unitId: string) {
  await supabase.from("units").update({ status: "vacant" }).eq("id", unitId);
}

async function occupyUnit(unitId: string) {
  await supabase.from("units").update({ status: "occupied" }).eq("id", unitId);
}

// "Create lease" = assign the tenant to a unit and stamp the dates.
export async function createLease(
  body: Partial<Lease> & { tenant_id?: string | number },
) {
  const tenantId = body.tenant_id != null ? String(body.tenant_id) : "";
  if (!tenantId) throw new Error("tenant_id required");
  const unitId = body.unit_id != null ? String(body.unit_id) : "";
  if (!unitId) throw new Error("unit_id required");

  const deposit =
    body.deposit_amount != null && body.deposit_amount !== (undefined as never)
      ? Number(body.deposit_amount)
      : null;

  const { error } = await supabase
    .from("tenants")
    .update({
      unit_id: unitId,
      lease_start: body.start_date ?? null,
      lease_end: body.end_date ?? null,
      deposit,
    })
    .eq("id", tenantId);
  if (error) throw new Error(error.message);
  await occupyUnit(unitId);

  const { data } = await supabase
    .from("tenants")
    .select(LEASE_SELECT)
    .eq("id", tenantId)
    .maybeSingle();
  return mapLease((data as LeaseRow) ?? {});
}

// "Update lease" only supports ending it (assignment lives on the tenant row).
export async function updateLease(id: string | number, body: Partial<Lease>) {
  const tenantId = String(id);
  if (body.status && body.status !== "active") {
    const { data } = await supabase
      .from("tenants")
      .select("unit_id")
      .eq("id", tenantId)
      .maybeSingle();
    const unitId = (data as Row | null)?.unit_id as string | null;
    const { error } = await supabase
      .from("tenants")
      .update({ unit_id: null })
      .eq("id", tenantId);
    if (error) throw new Error(error.message);
    if (unitId) await freeUnit(unitId);
  }
  return { id: tenantId, ...body } as Lease;
}

export type { TenantLease };
