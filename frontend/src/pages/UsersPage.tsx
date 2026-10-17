// Staff & admins directory over the users table (el UsersPage port).
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserCheck, UserX, AlertCircle, Mail, Search, CalendarDays, ShieldCheck } from "lucide-react";
import { getUsers, updateUserRole, approveTenant, rejectTenant, type StaffUser } from "../api/auth";
import { getCurrentUser } from "../lib/auth";
import { PageHeader } from "../components/ui/PageHeader";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Badge } from "../components/ui/Badge";
import { Pagination } from "../components/ui/Pagination";
import { formatDate } from "../lib/utils";

const ROLE_FILTERS = ["all", "admin", "manager", "staff", "contractor", "tenant", "pending"] as const;
const ASSIGNABLE_ROLES = ["staff", "manager", "admin", "contractor"] as const;

export function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_FILTERS)[number]>("all");
  const [page, setPage] = useState(1);
  const [draftRoles, setDraftRoles] = useState<Record<string, string>>({});
  const [confirmTarget, setConfirmTarget] = useState<StaffUser | null>(null);
  const [approveTarget, setApproveTarget] = useState<StaffUser | null>(null);
  const [rejectTarget, setRejectTarget] = useState<StaffUser | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selfId, setSelfId] = useState<string>("");

  const limit = 15;
  useEffect(() => {
    getCurrentUser()
      .then((u) => setSelfId(u.id))
      .catch(() => setSelfId(""));
  }, []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["users", page, search, roleFilter],
    queryFn: () =>
      getUsers({
        search: search.trim() || undefined,
        role: roleFilter === "all" ? undefined : roleFilter,
        page,
        limit,
      }),
  });

  const users: StaffUser[] = data?.data ?? [];
  const total: number = data?.pagination.total ?? 0;
  const totalPages: number = data?.pagination.total_pages ?? 1;

  async function handleSave(u: StaffUser) {
    const next = draftRoles[u.id];
    if (!next || next === u.role) return;
    setBusyId(u.id);
    try {
      await updateUserRole(u.id, next);
      toast.success(`Role updated to ${next}`);
      setDraftRoles((d) => {
        const copy = { ...d };
        delete copy[u.id];
        return copy;
      });
      setConfirmTarget(null);
      setPage(1);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update role.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function refreshUsers() {
    setPage(1);
    await queryClient.invalidateQueries({ queryKey: ["users"] });
    await queryClient.invalidateQueries({ queryKey: ["pending-tenants"] });
  }

  async function handleApprove(u: StaffUser) {
    setBusyId(u.id);
    try {
      const res = await approveTenant(u.id);
      toast.success(res.message ?? `${u.name} approved — tenant access enabled`);
      setApproveTarget(null);
      await refreshUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to approve.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(u: StaffUser) {
    setBusyId(u.id);
    try {
      const res = await rejectTenant(u.id);
      toast.success(res.message ?? "Signup rejected");
      setRejectTarget(null);
      await refreshUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to reject.");
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PageHeader title="Staff & Admins" subtitle="Loading users…" />
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-8 animate-pulse">
            <div className="h-4 bg-[var(--bg-muted)] rounded w-1/3 mb-4" />
            <div className="h-4 bg-[var(--bg-muted)] rounded w-full mb-2" />
            <div className="h-4 bg-[var(--bg-muted)] rounded w-full mb-2" />
            <div className="h-4 bg-[var(--bg-muted)] rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PageHeader title="Staff & Admins" subtitle="Manage staff and admin access" />
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-12 text-center">
            <AlertCircle size={40} className="mx-auto text-[#CC0000] mb-4" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Failed to load users</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              You may not have permission — this page requires an admin account.
            </p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 text-sm font-medium text-white bg-[#003580] hover:bg-[#003070] rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Staff & Admins"
          subtitle={`${total} user${total !== 1 ? "s" : ""} with login access`}
        />

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative max-w-sm flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              data-search
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search name or email… (press /)"
              className="w-full pl-9 pr-3 py-2.5 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#0071C2] focus:border-transparent transition-shadow"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as (typeof ROLE_FILTERS)[number]);
              setPage(1);
            }}
            className="px-3 py-2.5 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#0071C2] focus:border-transparent"
          >
            {ROLE_FILTERS.map((r) => (
              <option key={r} value={r}>
                {r === "all" ? "All roles" : r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {users.length === 0 ? (
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-12 text-center">
            <UserCheck size={40} className="mx-auto text-[var(--text-muted)] mb-4" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No users found</h3>
            <p className="text-sm text-[var(--text-secondary)]">Try a different search or role filter.</p>
          </div>
        ) : (
          <>
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden">
              <div className="overflow-x-auto">
                <table data-testid="users-table" className="w-full text-sm min-w-[820px]">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-color)] bg-[var(--bg-muted)]">
                      <th className="px-4 py-3 font-semibold">User</th>
                      <th className="px-4 py-3 font-semibold">Role</th>
                      <th className="px-4 py-3 font-semibold">Verified</th>
                      <th className="px-4 py-3 font-semibold">Created</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {users.map((u) => {
                      const draft = draftRoles[u.id];
                      const dirty = !!draft && draft !== u.role;
                      const isSelf = u.id === selfId;
                      const isPending = u.role === "pending";
                      const busy = busyId === u.id;
                      return (
                        <tr key={u.id} className="hover:bg-[var(--bg-muted)] transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-[#003580] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {u.name?.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-[var(--text-primary)] truncate">
                                  {u.name}
                                  {isSelf && (
                                    <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#003580]/10 text-[#003580]">
                                      you
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] text-[var(--text-muted)] truncate flex items-center gap-1">
                                  <Mail size={11} />
                                  {u.email}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Badge status={u.role} />
                              {!isPending && (
                                <select
                                  value={draft ?? u.role}
                                  disabled={isSelf || busy}
                                  title={isSelf ? "You cannot change your own role here" : `Change role for ${u.name}`}
                                  onChange={(e) => setDraftRoles((d) => ({ ...d, [u.id]: e.target.value }))}
                                  className="px-2 py-1.5 border border-[var(--border-color)] rounded-lg text-xs bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#0071C2] disabled:opacity-40"
                                >
                                  {ASSIGNABLE_ROLES.map((r) => (
                                    <option key={r} value={r}>
                                      {r}
                                    </option>
                                  ))}
                                  {!ASSIGNABLE_ROLES.includes((draft ?? u.role) as (typeof ASSIGNABLE_ROLES)[number]) && (
                                    <option value={draft ?? u.role}>{draft ?? u.role} (current)</option>
                                  )}
                                </select>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]">{u.verified ? "Yes" : "No"}</td>
                          <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays size={12} />
                              {u.created_at ? formatDate(u.created_at) : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 sticky right-0 bg-[var(--bg-card)]">
                            <div className="flex items-center justify-end gap-2">
                              {isPending ? (
                                <>
                                  <button
                                    onClick={() => setApproveTarget(u)}
                                    disabled={busy}
                                    title={`Approve ${u.name} — enable tenant access`}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#008009] hover:bg-[#006607] rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  >
                                    <UserCheck size={13} />
                                    {busy ? "Working…" : "Approve"}
                                  </button>
                                  <button
                                    onClick={() => setRejectTarget(u)}
                                    disabled={busy}
                                    title={`Reject ${u.name}'s signup`}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#CC0000] border border-[#CC0000]/40 hover:bg-[#CC0000]/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  >
                                    <UserX size={13} />
                                    {busy ? "Working…" : "Reject"}
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => setConfirmTarget(u)}
                                  disabled={!dirty || busy}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#008009] hover:bg-[#006607] rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <ShieldCheck size={13} />
                                  {busy ? "Saving…" : "Save"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
          </>
        )}

        <ConfirmDialog
          open={confirmTarget !== null}
          title="Change role"
          message={
            confirmTarget
              ? `Change ${confirmTarget.name} from ${confirmTarget.role} to ${draftRoles[confirmTarget.id]}?`
              : ""
          }
          confirmLabel="Change role"
          onConfirm={() => confirmTarget && void handleSave(confirmTarget)}
          onCancel={() => setConfirmTarget(null)}
        />
        <ConfirmDialog
          open={approveTarget !== null}
          title="Approve signup"
          message={
            approveTarget
              ? `Approve ${approveTarget.name} (${approveTarget.email})? Tenant access will be enabled.`
              : ""
          }
          confirmLabel="Approve"
          onConfirm={() => approveTarget && void handleApprove(approveTarget)}
          onCancel={() => setApproveTarget(null)}
        />
        <ConfirmDialog
          open={rejectTarget !== null}
          title="Reject signup"
          message={
            rejectTarget
              ? `Reject ${rejectTarget.name} (${rejectTarget.email})? The signup will be removed.`
              : ""
          }
          confirmLabel="Reject"
          danger
          onConfirm={() => rejectTarget && void handleReject(rejectTarget)}
          onCancel={() => setRejectTarget(null)}
        />
      </div>
    </div>
  );
}
