// Tenant API over Supabase table `tenants` (full_name ⇒ name, unit → lease info).
import { supabase } from "./client";
import { ilikeTerm, paginate } from "./properties";

export interface Tenant {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  employment_status?: string | null;
  employer?: string | null;
  monthly_income?: number | null;
  note?: string | null;
  notes?: string | null;
  active: boolean;
  created_at: string;
  // Derived from the unit assignment (Supabase model has no leases table)
  current_properties?: string | null;
  active_Leases?: number;
}

export interface TenantLease {
  id: string;
  tenant_id: string;
  unit_id: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  unit_number?: string;
  property_name?: string;
  property_address?: string;
}

export interface TenantFull extends Tenant {
  leases?: TenantLease[];
}

type Row = Record<string, unknown>;

type TenantRow = Row & {
  unit?: (Row & { unit_number?: string; properties?: { name?: string } | null }) | null;
};

function mapTenant(row: TenantRow): Tenant {
  const unit = row.unit;
  const pname = unit?.properties?.name;
  const current = pname && unit?.unit_number ? `${pname} · ${unit.unit_number}` : null;
  return {
    id: String(row.id),
    name: String(row.full_name ?? ""),
    email: (row.email as string) ?? null,
    phone: (row.phone as string) ?? null,
    company_name: (row.company_name as string) ?? null,
    employment_status: (row.employment_status as string) ?? null,
    employer: (row.employer as string) ?? null,
    monthly_income: row.monthly_income != null ? Number(row.monthly_income) : null,
    note: (row.notes as string) ?? null,
    notes: (row.notes as string) ?? null,
    active: row.active == null ? true : !!row.active,
    created_at: String(row.created_at ?? ""),
    current_properties: current,
    active_Leases: unit ? 1 : 0,
  };
}

// Write only columns that exist. `note`/`notes` both map to the `notes` column.
function tenantBody(body: Partial<Tenant>): Row {
  const row: Row = {};
  const src: Row = body as Row;
  const cols = new Set([
    "email",
    "phone",
    "company_name",
    "employment_status",
    "employer",
    "monthly_income",
    "unit_id",
  ]);
  for (const [k, v] of Object.entries(src)) {
    if (v !== undefined && cols.has(k)) row[k] = v;
  }
  if (src.name !== undefined) row.full_name = src.name;
  if (src.note !== undefined || src.notes !== undefined) {
    row.notes = src.note ?? src.notes;
  }
  if (src.active !== undefined) row.active = src.active;
  return row;
}

function withLease(row: TenantRow): TenantFull {
  const tenant = mapTenant(row);
  const unit = row.unit;
  if (!unit) return { ...tenant, leases: [] };
  return {
    ...tenant,
    leases: [
      {
        id: tenant.id,
        tenant_id: tenant.id,
        unit_id: String(unit.id ?? ""),
        start_date: (row.lease_start as string) ?? null,
        end_date: (row.lease_end as string) ?? null,
        status: "active",
        unit_number: (unit.unit_number as string) ?? undefined,
        property_name: unit.properties?.name,
      },
    ],
  };
}

const TENANT_SELECT =
  "*, unit:units(id, unit_number, properties(name))";

export async function getTenants(params?: Record<string, string>) {
  const page = Math.max(1, Number(params?.page ?? 1));
  const limit = Math.max(1, Number(params?.limit ?? 20));
  const search = params?.search ? ilikeTerm(params.search) : "";

  let base = supabase
    .from("tenants")
    .select(TENANT_SELECT, { count: "exact" })
    .order("created_at", { ascending: false });

  if (search) {
    base = base.or(
      `full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`,
    );
  }

  const from = (page - 1) * limit;
  const { data, error, count } = await base.range(from, from + limit - 1);
  if (error) throw new Error(error.message);
  const tenants = (data ?? []).map(mapTenant);
  const total = count ?? tenants.length;
  return paginate(tenants, page, limit, total);
}

export async function getTenant(id: string | number) {
  const tenant = await getTenantFull(id);
  return tenant;
}

export async function getTenantFull(id: string | number): Promise<TenantFull> {
  const { data, error } = await supabase
    .from("tenants")
    .select(TENANT_SELECT)
    .eq("id", String(id))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Tenant not found");
  return withLease(data as TenantRow);
}

export async function createTenant(
  body: Partial<Tenant & { sendInvite?: boolean }>,
) {
  const { data, error } = await supabase
    .from("tenants")
    .insert(tenantBody(body))
    .select(TENANT_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapTenant(data as TenantRow);
}

export async function updateTenant(id: string | number, body: Partial<Tenant>) {
  const { data, error } = await supabase
    .from("tenants")
    .update(tenantBody(body))
    .eq("id", String(id))
    .select(TENANT_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapTenant(data as TenantRow);
}
