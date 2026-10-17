// Item-financing category taxonomy over Supabase table `financing_categories`.
import { supabase } from "./client";

export interface FinancingCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_system: boolean;
  active: boolean;
  created_at: string;
}

type Row = Record<string, unknown>;

function mapCategory(row: Row): FinancingCategory {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    description: (row.description as string) ?? null,
    is_system: !!row.is_system,
    active: row.active == null ? true : !!row.active,
    created_at: String(row.created_at ?? ""),
  };
}

const CATEGORY_SELECT = "*";

export async function getFinancingCategories(): Promise<FinancingCategory[]> {
  const { data, error } = await supabase
    .from("financing_categories")
    .select(CATEGORY_SELECT)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapCategory);
}

export async function createFinancingCategory(body: {
  name: string;
  description?: string;
}): Promise<FinancingCategory> {
  const slug = body.name.toLowerCase().replace(/\s+/g, "_");
  const { data, error } = await supabase
    .from("financing_categories")
    .insert({
      name: body.name,
      slug,
      description: body.description ?? null,
      is_system: false,
    })
    .select(CATEGORY_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapCategory(data);
}

export async function updateFinancingCategory(
  id: string | number,
  body: { name?: string; description?: string; active?: boolean },
): Promise<FinancingCategory> {
  const row: Row = {};
  if (body.name !== undefined) {
    row.name = body.name;
    row.slug = body.name.toLowerCase().replace(/\s+/g, "_");
  }
  if (body.description !== undefined) row.description = body.description;
  if (body.active !== undefined) row.active = body.active;
  const { data, error } = await supabase
    .from("financing_categories")
    .update(row)
    .eq("id", String(id))
    .select(CATEGORY_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapCategory(data);
}

export async function deleteFinancingCategory(id: string | number): Promise<void> {
  const { error } = await supabase
    .from("financing_categories")
    .delete()
    .eq("id", String(id));
  if (error) throw new Error(error.message);
}
