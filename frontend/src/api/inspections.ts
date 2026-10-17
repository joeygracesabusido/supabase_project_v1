// Inspections over Supabase tables `inspections` + `inspection_items`.
// The lease adapter maps a lease to the tenants row, so inspection.lease_id
// references tenants(id) directly. Comparison (move-in vs move-out) runs
// client-side with the same merge rules as the source Express route.
import { supabase } from "./client";

export interface InspectionItem {
  id: string;
  inspection_id: string;
  area: string;
  item: string;
  condition: "good" | "fair" | "poor" | "damaged" | null;
  notes: string | null;
  photo_path: string | null;
}

export interface Inspection {
  id: string;
  lease_id: string;
  type: "move_in" | "move_out";
  status: "draft" | "in_progress" | "completed";
  scheduled_date: string | null;
  completed_at: string | null;
  overall_notes: string | null;
  created_at: string;
  inspection_items: InspectionItem[];
  // Lease adapter shape — mirrors the source embed `leases.tenants.units`.
  leases?: {
    id: string;
    start_date?: string | null;
    end_date?: string | null;
    tenants: { id: string; name: string; email?: string | null };
    units: {
      id: string;
      unit_number: string;
      properties: { id?: string; name: string; address?: string | null };
    };
  } | null;
}

export interface ComparisonItemSide {
  condition: string | null;
  notes: string | null;
  photo_path: string | null;
}

export interface ComparisonRow {
  area: string;
  item: string;
  move_in: ComparisonItemSide | null;
  move_out: ComparisonItemSide | null;
  changed: boolean;
}

export interface InspectionComparison {
  lease_id: string;
  move_in: { id: string; completed_at: string | null };
  move_out: { id: string; completed_at: string | null };
  items: ComparisonRow[];
  changed_count: number;
}

type Row = Record<string, unknown>;

type InspectionRow = Row & {
  tenants?: {
    id: string;
    full_name?: string;
    email?: string | null;
    lease_start?: string | null;
    lease_end?: string | null;
    unit?: {
      id: string;
      unit_number: string;
      properties?: { id?: string; name: string; address?: string | null } | null;
    } | null;
  } | null;
};

const INSPECTION_SELECT = `*, inspection_items(*),
  tenants!inspections_lease_id_fkey(id, full_name, email, lease_start, lease_end,
    unit:units(id, unit_number, properties(id, name, address)))`;

function mapItem(row: Row): InspectionItem {
  return {
    id: String(row.id),
    inspection_id: String(row.inspection_id ?? ""),
    area: String(row.area ?? ""),
    item: String(row.item ?? ""),
    condition: (row.condition as InspectionItem["condition"]) ?? null,
    notes: (row.notes as string) ?? null,
    photo_path: (row.photo_path as string) ?? null,
  };
}

export function mapInspection(row: InspectionRow): Inspection {
  const tenant = row.tenants ?? null;
  const unit = tenant?.unit ?? null;
  return {
    id: String(row.id),
    lease_id: String(row.lease_id ?? ""),
    type: (row.type as Inspection["type"]) ?? "move_in",
    status: (row.status as Inspection["status"]) ?? "draft",
    scheduled_date: (row.scheduled_date as string) ?? null,
    completed_at: (row.completed_at as string) ?? null,
    overall_notes: (row.overall_notes as string) ?? null,
    created_at: String(row.created_at ?? ""),
    inspection_items: Array.isArray(row.inspection_items)
      ? (row.inspection_items as Row[]).map(mapItem)
      : [],
    leases: tenant
      ? {
          id: String(tenant.id),
          start_date: tenant.lease_start ?? null,
          end_date: tenant.lease_end ?? null,
          tenants: {
            id: String(tenant.id),
            name: String(tenant.full_name ?? ""),
            email: tenant.email ?? null,
          },
          units: {
            id: String(unit?.id ?? ""),
            unit_number: String(unit?.unit_number ?? ""),
            properties: {
              id: unit?.properties?.id ? String(unit.properties.id) : undefined,
              name: String(unit?.properties?.name ?? ""),
              address: unit?.properties?.address ?? null,
            },
          },
        }
      : null,
  };
}

// Same default checklist the source route inserts on inspection creation.
const DEFAULT_CHECKLIST: { area: string; item: string }[] = [
  { area: "Living Room", item: "Walls" },
  { area: "Living Room", item: "Flooring" },
  { area: "Living Room", item: "Windows & Screens" },
  { area: "Living Room", item: "Lights & Switches" },
  { area: "Kitchen", item: "Walls" },
  { area: "Kitchen", item: "Countertops" },
  { area: "Kitchen", item: "Sink & Faucet" },
  { area: "Kitchen", item: "Cabinets" },
  { area: "Bathroom", item: "Toilet" },
  { area: "Bathroom", item: "Shower & Tiles" },
  { area: "Bathroom", item: "Sink & Faucet" },
  { area: "Bedroom", item: "Walls" },
  { area: "Bedroom", item: "Flooring" },
  { area: "Bedroom", item: "Closet" },
  { area: "General", item: "Doors & Locks" },
  { area: "General", item: "Electrical Outlets" },
  { area: "General", item: "Aircon Units" },
];

export async function getInspections(leaseId?: string): Promise<Inspection[]> {
  let base = supabase
    .from("inspections")
    .select(INSPECTION_SELECT, { count: "exact" })
    .order("type")
    .order("created_at", { ascending: false });

  if (leaseId) {
    base = base.eq("lease_id", String(leaseId));
  }

  const { data, error } = await base;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapInspection(row as InspectionRow));
}

export async function getInspection(id: string | number): Promise<Inspection> {
  const { data, error } = await supabase
    .from("inspections")
    .select(INSPECTION_SELECT)
    .eq("id", String(id))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Inspection not found");
  return mapInspection(data as InspectionRow);
}

export async function createInspection(body: {
  lease_id: string;
  type: "move_in" | "move_out";
  scheduled_date?: string;
}): Promise<Inspection> {
  const { data, error } = await supabase
    .from("inspections")
    .insert({
      lease_id: String(body.lease_id),
      type: body.type,
      scheduled_date: body.scheduled_date ?? null,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: itemsErr } = await supabase
    .from("inspection_items")
    .insert(
      DEFAULT_CHECKLIST.map((c) => ({
        inspection_id: data.id,
        area: c.area,
        item: c.item,
      })),
    );
  if (itemsErr) throw new Error(itemsErr.message);

  return getInspection(data.id);
}

export async function updateInspection(
  id: string | number,
  body: {
    status?: "draft" | "in_progress" | "completed";
    overall_notes?: string;
    scheduled_date?: string | null;
  },
): Promise<Inspection> {
  const payload: Row = {};
  if (body.status !== undefined) {
    // Completing requires every checklist item to carry a recorded condition
    // (source rule); completed inspections become immutable down the call sites.
    if (body.status === "completed") {
      const { count, error: countErr } = await supabase
        .from("inspection_items")
        .select("id", { count: "exact" })
        .eq("inspection_id", String(id))
        .is("condition", null);
      if (countErr) throw new Error(countErr.message);
      const nilCount = count ?? 0;
      if (nilCount > 0) {
        throw new Error(
          `Cannot complete — ${nilCount} checklist item(s) have no recorded condition yet`,
        );
      }
    }
    payload.status = body.status;
    if (body.status === "completed") {
      payload.completed_at = new Date().toISOString();
    }
  }
  if (body.overall_notes !== undefined) payload.overall_notes = body.overall_notes;
  if (body.scheduled_date !== undefined) payload.scheduled_date = body.scheduled_date;

  const { data, error } = await supabase
    .from("inspections")
    .update(payload)
    .eq("id", String(id))
    .select(INSPECTION_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapInspection(data as InspectionRow);
}

// ─── Checklist items ──────────────────────────────────────────────────

const INSPECTION_ITEM_COLS = new Set(["area", "item", "condition", "notes"]);

function itemBody(body: Record<string, unknown>): Row {
  const row: Row = {};
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && INSPECTION_ITEM_COLS.has(k)) row[k] = v;
  }
  return row;
}

export async function addInspectionItem(
  inspectionId: string | number,
  body: { area: string; item: string; condition?: string; notes?: string },
): Promise<InspectionItem> {
  const { data, error } = await supabase
    .from("inspection_items")
    .insert({
      inspection_id: String(inspectionId),
      ...itemBody(body),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapItem(data);
}

export async function updateInspectionItem(
  inspectionId: string | number,
  itemId: string | number,
  body: { condition?: string; notes?: string },
): Promise<InspectionItem> {
  const { data, error } = await supabase
    .from("inspection_items")
    .update(itemBody(body))
    .eq("id", String(itemId))
    .eq("inspection_id", String(inspectionId))
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapItem(data);
}

export async function deleteInspectionItem(
  inspectionId: string | number,
  itemId: string | number,
): Promise<void> {
  const { error } = await supabase
    .from("inspection_items")
    .delete()
    .eq("id", String(itemId))
    .eq("inspection_id", String(inspectionId));
  if (error) throw new Error(error.message);
}

// ─── Comparison ───────────────────────────────────────────────────────

export async function compareInspections(leaseId: string): Promise<InspectionComparison> {
  const inspections = await getInspections(leaseId);
  const moveIn = inspections.find((i) => i.type === "move_in");
  const moveOut = inspections.find((i) => i.type === "move_out");

  if (!moveIn || !moveOut) {
    throw new Error("Comparison needs both a move-in and a move-out inspection");
  }

  // Same merge rules as the source route: items matched by area+item; only a
  // recorded condition on BOTH sides counts as a change — an item missing
  // from one checklist is not evidence of damage.
  const key = (area: string, item: string) => `${area}::${item}`;
  const moveInMap = new Map<string, InspectionItem>();
  const moveOutMap = new Map<string, InspectionItem>();
  for (const it of moveIn.inspection_items) moveInMap.set(key(it.area, it.item), it);
  for (const it of moveOut.inspection_items) moveOutMap.set(key(it.area, it.item), it);

  const allKeys = [...new Set([...moveInMap.keys(), ...moveOutMap.keys()])];

  const items: ComparisonRow[] = allKeys.map((k) => {
    const [area, item] = k.split("::");

    const beforeSide = moveInMap.get(k);
    const afterSide = moveOutMap.get(k);
    const before: ComparisonItemSide | null = beforeSide
      ? { condition: beforeSide.condition, notes: beforeSide.notes, photo_path: beforeSide.photo_path }
      : null;
    const after: ComparisonItemSide | null = afterSide
      ? { condition: afterSide.condition, notes: afterSide.notes, photo_path: afterSide.photo_path }
      : null;

    const changed = Boolean(
      before?.condition &&
        after?.condition &&
        before.condition !== after.condition,
    );
    return { area, item, move_in: before, move_out: after, changed };
  });

  return {
    lease_id: String(leaseId),
    move_in: { id: moveIn.id, completed_at: moveIn.completed_at },
    move_out: { id: moveOut.id, completed_at: moveOut.completed_at },
    items,
    changed_count: items.filter((i) => i.changed).length,
  };
}
