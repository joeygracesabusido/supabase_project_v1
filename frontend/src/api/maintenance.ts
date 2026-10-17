// Maintenance tickets + workers over Supabase tables. Ticket numbers use the
// same `MT-<timestamp>-<rand4>` shape as the source Express route.
import { supabase } from "./client";
import { ilikeTerm, paginate } from "./properties";

export interface MaintenanceTicket {
  id: string;
  ticket_number: string;
  property_id: string;
  unit_id: string;
  tenant_id?: string | null;
  description: string;
  ticket_type: string;
  priority: string;
  status: string;
  estimated_cost?: number | null;
  actual_cost?: number | null;
  scheduled_date?: string | null;
  assigned_worker_id?: string | null;
  notes?: string | null;
  resolution_notes?: string | null;
  completion_date?: string | null;
  property_name?: string;
  property_address?: string | null;
  unit_number?: string;
  tenant_name?: string | null;
  tenant_email?: string | null;
  tenant_phone?: string | null;
  assigned_worker_name?: string;
  assigned_worker_phone?: string | null;
  created_at: string;
}

export interface MaintenanceWorker {
  id: string;
  worker_name: string;
  specialty?: string | null;
  phone?: string | null;
  active?: boolean | null;
}

type Row = Record<string, unknown>;

type TicketRow = Row & {
  properties?: Row | null;
  units?: Row | null;
  tenants?: Row | null;
  maintenance_workers?: Row | null;
};

const TICKET_SELECT =
  "*, properties(name, address), units(unit_number), tenants(full_name, email, phone), maintenance_workers(worker_name, phone)";

function mapTicket(row: TicketRow): MaintenanceTicket {
  const prop = row.properties ?? undefined;
  const unit = row.units ?? undefined;
  const tin = row.tenants ?? undefined;
  const wrk = row.maintenance_workers ?? undefined;
  return {
    id: String(row.id),
    ticket_number: String(row.ticket_number ?? ""),
    property_id: String(row.property_id ?? ""),
    unit_id: String(row.unit_id ?? ""),
    tenant_id: (row.tenant_id as string) ?? null,
    description: String(row.description ?? ""),
    ticket_type: String(row.ticket_type ?? "general"),
    priority: String(row.priority ?? "medium"),
    status: String(row.status ?? "open"),
    estimated_cost: row.estimated_cost != null ? Number(row.estimated_cost) : null,
    actual_cost: row.actual_cost != null ? Number(row.actual_cost) : null,
    scheduled_date: (row.scheduled_date as string) ?? null,
    assigned_worker_id: (row.assigned_worker_id as string) ?? null,
    notes: (row.notes as string) ?? null,
    resolution_notes: (row.resolution_notes as string) ?? null,
    completion_date: (row.completion_date as string) ?? null,
    property_name: prop ? String((prop.name as string) ?? "") : undefined,
    property_address: prop ? ((prop.address as string) ?? null) : undefined,
    unit_number: unit ? String((unit.unit_number as string) ?? "") : undefined,
    tenant_name: tin ? String((tin.full_name as string) ?? "") : null,
    tenant_email: tin ? ((tin.email as string) ?? null) : null,
    tenant_phone: tin ? ((tin.phone as string) ?? null) : null,
    assigned_worker_name: wrk ? String((wrk.worker_name as string) ?? "") : undefined,
    assigned_worker_phone: wrk ? ((wrk.phone as string) ?? null) : undefined,
    created_at: String(row.created_at ?? ""),
  };
}

const TICKET_COLS = new Set([
  "property_id",
  "unit_id",
  "tenant_id",
  "description",
  "ticket_type",
  "priority",
  "status",
  "assigned_worker_id",
  "estimated_cost",
  "actual_cost",
  "scheduled_date",
  "completion_date",
  "notes",
  "resolution_notes",
]);

function ticketBody(body: Partial<MaintenanceTicket>): Row {
  const row: Row = {};
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && TICKET_COLS.has(k)) row[k] = v;
  }
  if (row.property_id) row.property_id = String(row.property_id);
  if (row.unit_id) row.unit_id = String(row.unit_id);
  if (row.tenant_id) row.tenant_id = String(row.tenant_id);
  if (row.assigned_worker_id) row.assigned_worker_id = String(row.assigned_worker_id);
  return row;
}

export function generateTicketNumber(): string {
  return `MT-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

export async function getTickets(params?: Record<string, string>) {
  const page = Math.max(1, Number(params?.page ?? 1));
  const limit = Math.max(1, Number(params?.limit ?? 20));
  const search = params?.search ? ilikeTerm(params.search) : "";

  let base = supabase
    .from("maintenance_tickets")
    .select(TICKET_SELECT, { count: "exact" })
    .order("created_at", { ascending: false });

  if (params?.status) base = base.eq("status", params.status);
  if (params?.priority) base = base.eq("priority", params.priority);
  if (params?.property_id) base = base.eq("property_id", String(params.property_id));
  if (search) {
    base = base.or(
      `ticket_number.ilike.%${search}%,description.ilike.%${search}%`,
    );
  }

  const from = (page - 1) * limit;
  const { data, error, count } = await base.range(from, from + limit - 1);
  if (error) throw new Error(error.message);
  const tickets = (data ?? []).map((t) => mapTicket(t as TicketRow));
  return paginate(tickets, page, limit, count ?? tickets.length);
}

export async function getTicket(id: string | number): Promise<MaintenanceTicket> {
  const { data, error } = await supabase
    .from("maintenance_tickets")
    .select(TICKET_SELECT)
    .eq("id", String(id))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Ticket not found");
  return mapTicket(data as TicketRow);
}

export async function createTicket(
  body: Partial<MaintenanceTicket>,
): Promise<MaintenanceTicket> {
  const payload = ticketBody(body);
  delete payload.status; // default 'open' with explicit fallback below
  const { data, error } = await supabase
    .from("maintenance_tickets")
    .insert({
      ticket_number: generateTicketNumber(),
      ...payload,
      status: (body.status as string) || "open",
      priority: (body.priority as string) || "medium",
      ticket_type: (body.ticket_type as string) || "general",
    })
    .select(TICKET_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapTicket(data as TicketRow);
}

export async function updateTicket(
  id: string | number,
  body: Partial<MaintenanceTicket>,
): Promise<MaintenanceTicket> {
  const { data, error } = await supabase
    .from("maintenance_tickets")
    .update(ticketBody(body))
    .eq("id", String(id))
    .select(TICKET_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapTicket(data as TicketRow);
}

export async function updateTicketStatus(
  id: string | number,
  status: string,
  resolution_notes?: string,
): Promise<MaintenanceTicket> {
  const payload: Row = { status };
  if (resolution_notes) payload.resolution_notes = resolution_notes;
  if (status === "completed") {
    payload.completion_date = new Date().toISOString().slice(0, 10);
  }
  const { data, error } = await supabase
    .from("maintenance_tickets")
    .update(payload)
    .eq("id", String(id))
    .select(TICKET_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapTicket(data as TicketRow);
}

export async function deleteTicket(id: string | number): Promise<void> {
  const { error } = await supabase
    .from("maintenance_tickets")
    .delete()
    .eq("id", String(id));
  if (error) throw new Error(error.message);
}

// ─── Workers ──────────────────────────────────────────────────────────

const WORKER_SELECT = "id, worker_name, specialty, phone, active";

function mapWorker(row: Row): MaintenanceWorker {
  return {
    id: String(row.id),
    worker_name: String(row.worker_name ?? ""),
    specialty: (row.specialty as string) ?? null,
    phone: (row.phone as string) ?? null,
    active: row.active == null ? true : !!row.active,
  };
}

export async function getWorkers(): Promise<MaintenanceWorker[]> {
  const { data, error } = await supabase
    .from("maintenance_workers")
    .select(WORKER_SELECT)
    .neq("active", false)
    .order("worker_name");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapWorker);
}

export async function createWorker(body: {
  worker_name: string;
  specialty?: string;
  phone?: string;
}): Promise<MaintenanceWorker> {
  const { data, error } = await supabase
    .from("maintenance_workers")
    .insert({
      worker_name: body.worker_name,
      specialty: body.specialty ?? null,
      phone: body.phone ?? null,
      active: true,
    })
    .select(WORKER_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapWorker(data);
}

export async function updateWorker(
  id: string | number,
  body: { worker_name?: string; specialty?: string; phone?: string; active?: boolean },
): Promise<MaintenanceWorker> {
  const payload: Row = {};
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) payload[k] = v;
  }
  const { data, error } = await supabase
    .from("maintenance_workers")
    .update(payload)
    .eq("id", String(id))
    .select(WORKER_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapWorker(data);
}

export async function deleteWorker(id: string | number): Promise<void> {
  const { error } = await supabase
    .from("maintenance_workers")
    .delete()
    .eq("id", String(id));
  if (error) throw new Error(error.message);
}
