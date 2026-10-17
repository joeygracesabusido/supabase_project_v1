// Property API over Supabase table `properties`. HTTP responses of the source
// REST API are rebuilt by hand: { data, pagination, total }.
import { supabase } from "./client";

export interface Property {
  id: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
  total_units?: number;
  asset_category?: string;
  building_type?: string;
  year_built?: number;
  active: boolean;
  description?: string;
  zip?: string;
  created_at: string;
}

export interface PropertyUpdateBody {
  name?: string;
  address?: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  total_units?: number;
  asset_category?: string | null;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  building_type?: string | null;
  year_built?: number | null;
  active?: boolean;
}

// Columns that exist on the Supabase table (lat/lng have no backing column).
const PROPERTY_COLS = new Set([
  "name",
  "address",
  "city",
  "state",
  "zip",
  "total_units",
  "asset_category",
  "description",
  "building_type",
  "year_built",
  "active",
]);

type Row = Record<string, unknown>;

export function mapProperty(row: Row): Property {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    address: String(row.address ?? ""),
    city: (row.city as string) ?? undefined,
    state: (row.state as string) ?? undefined,
    zip: (row.zip as string) ?? undefined,
    total_units: row.total_units != null ? Number(row.total_units) : undefined,
    asset_category: (row.asset_category as string) ?? undefined,
    building_type: (row.building_type as string) ?? undefined,
    year_built: row.year_built != null ? Number(row.year_built) : undefined,
    active: row.active == null ? true : !!row.active,
    description: (row.description as string) ?? undefined,
    created_at: String(row.created_at ?? ""),
  };
}

export function ilikeTerm(term: string): string {
  // Strip PostgREST filter operators from user input before building .or().
  return term.replace(/[%(),"'\\]/g, " ").trim();
}

export function mapBody<T extends object>(body: T): Row {
  const row: Row = {};
  for (const [k, v] of Object.entries(body as Row)) {
    if (v !== undefined && PROPERTY_COLS.has(k)) row[k] = v;
  }
  return row;
}

export interface Paginated<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
  total: number;
}

export function paginate<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
): Paginated<T> {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      total_pages: limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1,
    },
    total,
  };
}

export async function getProperties(params?: Record<string, string>) {
  const page = Math.max(1, Number(params?.page ?? 1));
  const limit = Math.max(1, Number(params?.limit ?? 20));
  const search = params?.search ? ilikeTerm(params.search) : "";

  let base = supabase
    .from("properties")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search) {
    base = base.or(
      `name.ilike.%${search}%,address.ilike.%${search}%,city.ilike.%${search}%`,
    );
  }

  const from = (page - 1) * limit;
  const { data, error, count } = await base.range(from, from + limit - 1);
  if (error) throw new Error(error.message);
  const properties = (data ?? []).map(mapProperty);
  const total = count ?? properties.length;
  return paginate(properties, page, limit, total);
}

export async function getProperty(id: string | number): Promise<Property> {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", String(id))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Property not found");
  return mapProperty(data);
}

export async function createProperty(body: Partial<Property>) {
  const { data, error } = await supabase
    .from("properties")
    .insert(mapBody(body))
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapProperty(data);
}

export async function updateProperty(id: string | number, body: PropertyUpdateBody) {
  const { data, error } = await supabase
    .from("properties")
    .update(mapBody(body))
    .eq("id", String(id))
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapProperty(data);
}

export async function deleteProperty(id: string | number): Promise<void> {
  const { error } = await supabase.from("properties").delete().eq("id", String(id));
  if (error) throw new Error(error.message);
}
