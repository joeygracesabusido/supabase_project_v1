// Auth over Supabase Auth (source: el-property REST /auth/* session model).
// getSessions are cached in-memory; supabase-js owns token persistence.
// Roles live in the users table (migration 20261017180000): staff have an
// entry with auth_user_id set and a verified admin/manager role; everyone
// else is 'pending' until they get approved or seeded.
import { supabase } from "./supabase";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

let cachedUser: AppUser | null = null;

export async function fetchAppUser(id: string): Promise<AppUser> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.id !== id) throw new Error("Unauthorized");
  const meta = (data.user.user_metadata ?? {}) as Record<string, string>;
  let name = meta.full_name || meta.name || (data.user.email ?? "").split("@")[0];
  let role = "pending";
  // Role + display name come from the users row linked to this auth user.
  // RLS "self select" (users table) lets any signed-in user read their own.
  const row = await supabase
    .from("users")
    .select("name, role")
    .eq("auth_user_id", id)
    .maybeSingle();
  if (row.data) {
    if (row.data.name) name = row.data.name;
    role = row.data.role ?? "pending";
  }
  return { id, email: data.user.email ?? "", name, role };
}

export async function setSession(_token?: string, _refreshToken?: string): Promise<void> {
  cachedUser = null;
}

export async function clearSession(): Promise<void> {
  cachedUser = null;
  await supabase.auth.signOut();
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    const cached = await getCurrentUser();
    return !!cached;
  } catch {
    cachedUser = null;
    return false;
  }
}

export async function getCurrentUser(): Promise<AppUser> {
  if (cachedUser) return cachedUser;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    cachedUser = null;
    throw new Error("Unauthorized");
  }
  cachedUser = await fetchAppUser(data.user.id);
  return cachedUser;
}
