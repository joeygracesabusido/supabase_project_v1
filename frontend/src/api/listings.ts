import { supabase } from "./client";
import { ilikeTerm, paginate } from "./properties";

export interface Listing {
  id: string;
  unit_id: string;
  title: string;
  description?: string | null;
  rent_amount: number;
  deposit_amount?: number | null;
  available_from?: string | null;
  status: "draft" | "published" | "closed";
  photos: string[];
  amenities: string[];
  views_count: number;
  published_at?: string | null;
  created_at: string;
  unit?: {
    id: string;
    unit_number: string;
    bedroom_count?: number | null;
    bathroom_count?: number | null;
    properties?: {
      name: string;
      city?: string | null;
    };
  };
}

export interface ListingInput {
  unit_id: string;
  title: string;
  description?: string;
  rent_amount: number;
  deposit_amount?: number;
  available_from?: string;
  photos?: string[];
  amenities?: string[];
}

type Row = Record<string, unknown>;

// Supabase columns allowed for insert/update; everything else is trimmed.
const LISTING_COLS = new Set([
  "unit_id",
  "title",
  "description",
  "rent_amount",
  "deposit_amount",
  "available_from",
  "photos",
  "amenities",
]);

const LISTING_SELECT =
  "*, units(id, unit_number, bedroom_count, bathroom_count, properties(name, city))";

export function mapListing(row: Row): Listing {
  const unit = row.units as Listing["unit"] | null;
  return {
    id: String(row.id),
    unit_id: String(row.unit_id ?? ""),
    title: String(row.title ?? ""),
    description: (row.description as string) ?? null,
    rent_amount: row.rent_amount != null ? Number(row.rent_amount) : 0,
    deposit_amount: row.deposit_amount != null ? Number(row.deposit_amount) : null,
    available_from: (row.available_from as string) ?? null,
    status: (row.status as Listing["status"]) ?? "draft",
    photos: Array.isArray(row.photos) ? (row.photos as string[]) : [],
    amenities: Array.isArray(row.amenities) ? (row.amenities as string[]) : [],
    views_count: row.views_count != null ? Number(row.views_count) : 0,
    published_at: (row.published_at as string) ?? null,
    created_at: String(row.created_at ?? ""),
    unit: unit ?? undefined,
  };
}

export function listingBody(body: Partial<ListingInput>): Row {
  const row: Row = {};
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && LISTING_COLS.has(k)) row[k] = v;
  }
  if (body.unit_id !== undefined) row.unit_id = String(body.unit_id);
  return row;
}

// published_at is stamped client-side: no DB trigger here for it (kept lazy).
export function patchForStatus(status: Listing["status"]): Row {
  return status === "published"
    ? { status, published_at: new Date().toISOString() }
    : { status };
}

export async function getListings(params?: Record<string, string>) {
  const page = Math.max(1, Number(params?.page ?? 1));
  const limit = Math.max(1, Number(params?.limit ?? 20));
  const search = params?.search ? ilikeTerm(params.search) : "";

  let base = supabase
    .from("listings")
    .select(LISTING_SELECT, { count: "exact" })
    .order("created_at", { ascending: false });

  if (params?.status) {
    base = base.eq("status", params.status);
  }
  if (search) {
    base = base.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const from = (page - 1) * limit;
  const { data, error, count } = await base.range(from, from + limit - 1);
  if (error) throw new Error(error.message);
  const listings = (data ?? []).map(mapListing);
  const total = count ?? listings.length;
  return paginate(listings, page, limit, total);
}

export async function getListing(id: string | number): Promise<Listing> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("id", String(id))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Listing not found");
  return mapListing(data);
}

export async function createListing(body: ListingInput): Promise<Listing> {
  const { data, error } = await supabase
    .from("listings")
    .insert(listingBody(body))
    .select(LISTING_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapListing(data);
}

export async function setListingStatus(
  id: string | number,
  status: Listing["status"],
): Promise<Listing> {
  const { data, error } = await supabase
    .from("listings")
    .update(patchForStatus(status))
    .eq("id", String(id))
    .select(LISTING_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapListing(data);
}

export async function updateListing(
  id: string | number,
  body: Partial<ListingInput>,
): Promise<Listing> {
  const { data, error } = await supabase
    .from("listings")
    .update(listingBody(body))
    .eq("id", String(id))
    .select(LISTING_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapListing(data);
}

export async function deleteListing(id: string | number): Promise<void> {
  const { error } = await supabase.from("listings").delete().eq("id", String(id));
  if (error) throw new Error(error.message);
}
