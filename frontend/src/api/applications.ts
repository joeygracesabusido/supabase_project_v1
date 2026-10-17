// Rental applications over Supabase table `rental_applications` (FK → listings).
import { supabase } from "./client";
import { ilikeTerm, paginate } from "./properties";

export interface RentalApplication {
  id: string;
  listing_id: string;
  applicant_name: string;
  email: string;
  phone?: string | null;
  current_address?: string | null;
  employment_status?: string | null;
  employer?: string | null;
  monthly_income?: number | null;
  occupants?: number | null;
  desired_move_in?: string | null;
  message?: string | null;
  status:
    | "pending"
    | "reviewing"
    | "approved"
    | "rejected"
    | "withdrawn"
    | "converted";
  rejection_reason?: string | null;
  reviewed_at?: string | null;
  tenant_id?: string | null;
  created_at: string;
  listing?: {
    id: string;
    title: string;
    rent_amount: number;
    unit?: {
      id: string;
      unit_number: string;
      properties?: { name: string };
    };
  };
}

type Row = Record<string, unknown>;

type AppRow = Row & {
  listings?: (Row & { units?: (Row & { properties?: Row | null }) | null }) | null;
};

const APP_SELECT =
  "*, listings(id, title, rent_amount, units(id, unit_number, properties(name)))";

function mapApplication(row: AppRow): RentalApplication {
  const listing = (row.listings ?? undefined) as (Row & {
    units?: Row & { properties?: { name?: string } | null };
  }) | undefined;
  return {
    id: String(row.id),
    listing_id: String(row.listing_id ?? ""),
    applicant_name: String(row.applicant_name ?? ""),
    email: String(row.email ?? ""),
    phone: (row.phone as string) ?? null,
    current_address: (row.current_address as string) ?? null,
    employment_status: (row.employment_status as string) ?? null,
    employer: (row.employer as string) ?? null,
    monthly_income: row.monthly_income != null ? Number(row.monthly_income) : null,
    occupants: row.occupants != null ? Number(row.occupants) : null,
    desired_move_in: (row.desired_move_in as string) ?? null,
    message: (row.message as string) ?? null,
    status: (row.status as RentalApplication["status"]) ?? "pending",
    rejection_reason: (row.rejection_reason as string) ?? null,
    reviewed_at: (row.reviewed_at as string) ?? null,
    tenant_id: (row.tenant_id as string) ?? null,
    created_at: String(row.created_at ?? ""),
    listing: listing
      ? {
          id: String(listing.id),
          title: String(listing.title ?? ""),
          rent_amount: Number(listing.rent_amount ?? 0),
          unit: listing.units
            ? {
                id: String(listing.units.id),
                unit_number: String(listing.units.unit_number ?? ""),
                properties: listing.units.properties
                  ? { name: String(listing.units.properties.name ?? "") }
                  : undefined,
              }
            : undefined,
        }
      : undefined,
  };
}

const APPLICATION_COLS = new Set([
  "listing_id",
  "applicant_name",
  "email",
  "phone",
  "current_address",
  "employment_status",
  "employer",
  "monthly_income",
  "occupants",
  "desired_move_in",
  "message",
  "status",
]);

function applicationBody(
  body: Partial<RentalApplication> & { listing_id: string },
): Row {
  const row: Row = {};
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && APPLICATION_COLS.has(k)) row[k] = v;
  }
  if (row.listing_id) row.listing_id = String(row.listing_id);
  return row;
}

export async function getApplications(params?: Record<string, string>) {
  const page = Math.max(1, Number(params?.page ?? 1));
  const limit = Math.max(1, Number(params?.limit ?? 20));
  const search = params?.search ? ilikeTerm(params.search) : "";

  let base = supabase
    .from("rental_applications")
    .select(APP_SELECT, { count: "exact" })
    .order("created_at", { ascending: false });

  if (params?.status) {
    base = base.eq("status", params.status);
  }
  if (params?.listing_id) {
    base = base.eq("listing_id", String(params.listing_id));
  }
  if (search) {
    base = base.or(
      `applicant_name.ilike.%${search}%,email.ilike.%${search}%`,
    );
  }

  const from = (page - 1) * limit;
  const { data, error, count } = await base.range(from, from + limit - 1);
  if (error) throw new Error(error.message);
  const apps = (data ?? []).map(mapApplication);
  const total = count ?? apps.length;
  return paginate(apps, page, limit, total);
}

export async function getApplication(id: string | number): Promise<RentalApplication> {
  const { data, error } = await supabase
    .from("rental_applications")
    .select(APP_SELECT)
    .eq("id", String(id))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Application not found");
  return mapApplication(data as AppRow);
}

export async function createApplication(
  body: Partial<RentalApplication> & { listing_id: string },
): Promise<RentalApplication> {
  const payload = applicationBody(body);
  payload.status = (payload.status as string) || "pending";
  const { data, error } = await supabase
    .from("rental_applications")
    .insert(payload)
    .select(APP_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapApplication(data as AppRow);
}

const APPLICATION_STATUSES = [
  "pending",
  "reviewing",
  "approved",
  "rejected",
  "withdrawn",
  "converted",
] as const;

export async function updateApplicationStatus(
  id: string | number,
  status: (typeof APPLICATION_STATUSES)[number],
  rejection_reason?: string,
): Promise<RentalApplication> {
  if (!APPLICATION_STATUSES.includes(status)) {
    throw new Error(`status must be one of: ${APPLICATION_STATUSES.join(", ")}`);
  }
  const payload: Row = {
    status,
    reviewed_at: new Date().toISOString(),
  };
  if (rejection_reason) payload.rejection_reason = rejection_reason;
  const { data, error } = await supabase
    .from("rental_applications")
    .update(payload)
    .eq("id", String(id))
    .select(APP_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapApplication(data as AppRow);
}

/**
 * convertApplication — promotes an approved applicant into a tenants row
 * (Supabase model: a lease IS the tenants row, so conversion creates the
 * tenant record and links it back), then marks the application converted.
 */
export async function convertApplication(id: string | number): Promise<{
  tenant: { id: string; name: string };
  application: RentalApplication;
}> {
  const app = await getApplication(id);
  const { data: tenantRow, error: tenantErr } = await supabase
    .from("tenants")
    .insert({
      full_name: app.applicant_name,
      email: app.email,
      phone: app.phone ?? null,
      employment_status: app.employment_status ?? null,
      employer: app.employer ?? null,
      monthly_income: app.monthly_income ?? null,
    })
    .select("id")
    .single();
  if (tenantErr) throw new Error(tenantErr.message);
  const tenantId = String(tenantRow.id);

  const application = await updateApplicationStatusRaw(app.id, "converted", tenantId);
  return { tenant: { id: tenantId, name: app.applicant_name }, application };
}

// Internal variant that links the created tenant without resetting reviewed_at.
async function updateApplicationStatusRaw(
  id: string,
  status: RentalApplication["status"],
  tenantId: string,
): Promise<RentalApplication> {
  const { data, error } = await supabase
    .from("rental_applications")
    .update({ status, tenant_id: tenantId, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .select(APP_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapApplication(data as AppRow);
}

export async function deleteApplication(id: string | number): Promise<void> {
  const { error } = await supabase
    .from("rental_applications")
    .delete()
    .eq("id", String(id));
  if (error) throw new Error(error.message);
}
