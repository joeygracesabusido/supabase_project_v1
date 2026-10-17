// Auth API over Supabase Auth + the users table (el /auth/* port: login,
// register, get-me, staff directory, tenant signup approvals).
import { supabase } from "./client";
import { fetchAppUser } from "../lib/auth";
import type { AppUser } from "../lib/auth";

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: { id: string; email: string; name: string; role: string };
}

function resFrom(data: {
  session: { access_token: string; refresh_token: string } | null;
  user: AppUser;
}): AuthResponse {
  return {
    token: data.session?.access_token ?? "",
    refreshToken: data.session?.refresh_token ?? "",
    user: data.user,
  };
}

async function login(email: string, password: string): Promise<AuthResponse> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Login failed. Check credentials.");
  const user = await fetchAppUser(data.user.id);
  return resFrom({ session: data.session as never, user });
}

async function register(
  name: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });
  if (error) throw new Error(error.message);
  if (!data.session)
    throw new Error("Check your inbox to confirm your email, then sign in.");
  // The on_auth_user_created trigger auto-inserts a users row with
  // role='pending'; approveTenant() promotes it.
  const user = await fetchAppUser(data.user!.id);
  return resFrom({ session: data.session as never, user });
}

async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

async function getMe(): Promise<AppUser> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Unauthorized");
  return fetchAppUser(data.user.id);
}

// ---------------------------------------------------------------------------
// Staff directory (el GET /auth/users + PATCH /auth/users/:id/role)
// ---------------------------------------------------------------------------

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
  verified: boolean;
  created_at: string;
}

export interface UsersResponse {
  data: StaffUser[];
  pagination: { total: number; page: number; limit: number; total_pages: number };
}

export interface GetUsersParams {
  search?: string;
  role?: string;
  page?: number;
  limit?: number;
}

function toStaffUser(row: Record<string, unknown>): StaffUser {
  return {
    id: String(row.id),
    name: (row.name as string) ?? "",
    email: (row.email as string) ?? "",
    role: (row.role as string) ?? "pending",
    verified: row.verified === true,
    created_at: String(row.created_at ?? ""),
  };
}

export async function getUsers(params: GetUsersParams = {}): Promise<UsersResponse> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 15;
  let query = supabase
    .from("users")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  if (params.role) query = query.eq("role", params.role);
  if (params.search) {
    query = query.or(
      `name.ilike.*${params.search}*,email.ilike.*${params.search}*`,
    );
  }
  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  return {
    data: ((data || []) as unknown as Record<string, unknown>[]).map(toStaffUser),
    pagination: {
      total,
      page,
      limit,
      total_pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function updateUserRole(id: string, role: string): Promise<void> {
  const { error } = await supabase.from("users").update({ role }).eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Tenant signup approvals (el POST /auth/{approve,reject}-tenant/:id,
// GET /auth/pending-tenants). A pending row is the signup request; approval
// promotes it to role 'tenant' + verified so RLS treats it as a tenant.
// ---------------------------------------------------------------------------

export interface PendingTenant {
  id: string;
  name: string;
  email: string;
  created_at: string;
  phone: string | null;
  company_name: string | null;
  employment_status: string | null;
  monthly_income: number | string | null;
}

export async function getPendingTenants(): Promise<PendingTenant[]> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("role", "pending")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data || []) as unknown as Record<string, unknown>[]).map(toPending);
}

function toPending(row: Record<string, unknown>): PendingTenant {
  return {
    id: String(row.id),
    name: (row.name as string) ?? "",
    email: (row.email as string) ?? "",
    created_at: String(row.created_at ?? ""),
    phone: (row.phone as string | null) ?? null,
    company_name: (row.company_name as string | null) ?? null,
    employment_status: (row.employment_status as string | null) ?? null,
    monthly_income: (row.monthly_income as string | null) ?? null,
  };
}

export async function approveTenant(id: string): Promise<{ message: string }> {
  const { error } = await supabase
    .from("users")
    .update({ role: "tenant", verified: true })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { message: "Signup approved — tenant access enabled" };
}

export async function rejectTenant(id: string): Promise<{ message: string }> {
  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { message: "Signup rejected" };
}

export { login, register, logout, getMe };
