// Unit API over Supabase table `units` (postgREST embed for property name).
// Supabase column for price is `rent` — mapped to the source's `rental_price`.
import { supabase } from "./client";
import { ilikeTerm, paginate, type Paginated } from "./properties";

export interface Unit {
  id: string;
  property_id: string;
  unit_number: string;
  floor_area?: number | null;
  rental_price?: number | null;
  status: "vacant" | "occupied" | "maintenance" | "reserved";
  floor_number?: number | null;
  bedroom_count?: number | null;
  bathroom_count?: number | null;
  unit_type?: string | null;
  description?: string | null;
  active: boolean;
  property_name?: string;
  created_at: string;
}

type Row = Record<string, unknown>;

function mapUnit(row: Row & { properties?: { name?: string } | null }): Unit {
  return {
    id: String(row.id),
    property_id: String(row.property_id ?? ""),
    unit_number: String(row.unit_number ?? ""),
    floor_area: row.floor_area != null ? Number(row.floor_area) : null,
    rental_price: row.rent != null ? Number(row.rent) : null,
    status: (row.status as Unit["status"]) ?? "vacant",
    floor_number: row.floor_number != null ? Number(row.floor_number) : null,
    bedroom_count: row.bedroom_count != null ? Number(row.bedroom_count) : null,
    bathroom_count: row.bathroom_count != null ? Number(row.bathroom_count) : null,
    unit_type: (row.unit_type as string) ?? null,
    description: (row.description as string) ?? null,
    active: row.properties != null ? true : true,
    property_name: row.properties?.name ?? undefined,
    created_at: String(row.created_at ?? ""),
  };
}

// Only write columns that exist on the table; rental_price → rent.
function unitBody(body: Partial<Unit>): Row {
  const row: Row = {};
  const src: Row = body as Row;
  const unitCols = new Set([
    "property_id",
    "unit_number",
    "status",
    "floor_number",
    "bedroom_count",
    "bathroom_count",
    "floor_area",
    "unit_type",
    "phase",
    "block",
    "lot",
    "description",
  ]);
  for (const [k, v] of Object.entries(src)) {
    if (v !== undefined && unitCols.has(k)) row[k] = v;
  }
  if (src.rental_price !== undefined) row.rent = src.rental_price;
  return row;
}

const UNIT_SELECT = "*, properties(name)";

export async function getUnits(params?: Record<string, string>) {
  const page = Math.max(1, Number(params?.page ?? 1));
  const limit = Math.max(1, Number(params?.limit ?? 20));
  const search = params?.search ? ilikeTerm(params.search) : "";

  let base = supabase
    .from("units")
    .select(UNIT_SELECT, { count: "exact" })
    .order("unit_number");

  if (params?.property_id) {
    base = base.eq("property_id", String(params.property_id));
  }
  if (params?.status) {
    base = base.eq("status", String(params.status));
  }
  if (search) {
    base = base.or(
      `unit_number.ilike.%${search}%,unit_type.ilike.%${search}%`,
    );
  }

  const from = (page - 1) * limit;
  const { data, error, count } = await base.range(from, from + limit - 1);
  if (error) throw new Error(error.message);
  const units = (data ?? []).map(mapUnit);
  const total = count ?? units.length;
  return paginate<Unit>(units, page, limit, total);
}

export async function getUnit(id: string | number): Promise<Unit> {
  const { data, error } = await supabase
    .from("units")
    .select(UNIT_SELECT)
    .eq("id", String(id))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Unit not found");
  return mapUnit(data);
}

export async function createUnit(body: Partial<Unit>) {
  const { data, error } = await supabase
    .from("units")
    .insert(unitBody(body))
    .select(UNIT_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapUnit(data);
}

export async function updateUnit(id: string | number, body: Partial<Unit>) {
  const { data, error } = await supabase
    .from("units")
    .update(unitBody(body))
    .eq("id", String(id))
    .select(UNIT_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapUnit(data);
}

export async function deleteUnit(id: string | number): Promise<void> {
  const { error } = await supabase.from("units").delete().eq("id", String(id));
  if (error) throw new Error(error.message);
}

// Re-export keeps Paginated surface single-sourced.
export type { Paginated };
