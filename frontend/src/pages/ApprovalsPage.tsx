// Tenant signup approvals over the users table (el ApprovalsPage port).
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  UserCheck,
  AlertCircle,
  Mail,
  Search,
  CalendarDays,
  Check,
  X,
} from "lucide-react";
import {
  getPendingTenants,
  approveTenant,
  rejectTenant,
  type PendingTenant,
} from "../api/auth";
import { PageHeader } from "../components/ui/PageHeader";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Badge } from "../components/ui/Badge";
import { Pagination } from "../components/ui/Pagination";
import { formatDate } from "../lib/utils";

function apiError(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<PendingTenant | null>(null);
  const [detailTarget, setDetailTarget] = useState<PendingTenant | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["pending-tenants"],
    queryFn: getPendingTenants,
    retry: 1,
  });

  const pending: PendingTenant[] = data || [];
  const q = search.trim().toLowerCase();
  const filtered = q
    ? pending.filter((t) =>
        [t.name, t.email, t.company_name ?? "", t.phone ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
    : pending;
  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * limit, safePage * limit);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["pending-tenants"] });
    queryClient.invalidateQueries({ queryKey: ["users"] });
  }

  async function handleApprove(t: PendingTenant) {
    setBusyId(t.id);
    try {
      const res = await approveTenant(t.id);
      toast.success(res.message || `${t.name} approved`);
      refresh();
      setPage(1);
    } catch (err: unknown) {
      toast.error(apiError(err, "Failed to approve."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject() {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    try {
      const res = await rejectTenant(rejectTarget.id);
      toast.success(res.message || "Signup rejected");
      refresh();
      setPage(1);
    } catch (err: unknown) {
      toast.error(apiError(err, "Failed to reject."));
    } finally {
      setBusyId(null);
      setRejectTarget(null);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Tenant Approvals"
        subtitle={`${filtered.length} signup${filtered.length !== 1 ? "s" : ""} awaiting review`}
      />
      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          data-search
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search name, email, company… (press /)"
          className="w-full pl-9 pr-3 py-2.5 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#0071C2] focus:border-transparent transition-shadow"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-5 animate-pulse h-44"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <AlertCircle size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium text-red-500">Failed to load approvals</p>
          <p className="text-sm mb-4">
            You may not have permission to review signups.
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 bg-[#003580] hover:bg-[#00224f] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <UserCheck size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No pending signups</p>
          <p className="text-sm mt-1">
            New tenant registrations will appear here for review.
          </p>
        </div>
      ) : (
        <>
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden">
          <div className="overflow-x-auto">
            <table data-testid="approvals-table" className="w-full text-sm min-w-[880px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-color)] bg-[var(--bg-muted)]">
                  <th className="px-4 py-3 font-semibold">Tenant</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">Company</th>
                  <th className="px-4 py-3 font-semibold">Employment</th>
                  <th className="px-4 py-3 font-semibold">Requested</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {paginated.map((t) => (
                  <tr key={t.id} className="hover:bg-[var(--bg-muted)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#FEBA02] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {t.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <button onClick={() => setDetailTarget(t)} title={`View ${t.name}`} className="font-semibold text-[var(--text-primary)] truncate hover:text-[#003580] hover:underline">
                            {t.name}
                          </button>
                          <p className="text-[11px] text-[var(--text-muted)] truncate flex items-center gap-1">
                            <Mail size={11} />{t.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{t.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] truncate max-w-[160px]">{t.company_name ?? "—"}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] capitalize">
                      {t.employment_status ?? "—"}
                      {t.monthly_income ? ` · P${Number(t.monthly_income).toLocaleString()}/mo` : ""}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">
                      <span className="inline-flex items-center gap-1"><CalendarDays size={12} />
                      {t.created_at ? formatDate(t.created_at) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3"><Badge status="pending" /></td>
                    <td className="px-4 py-3 sticky right-0 bg-[var(--bg-card)]">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setRejectTarget(t)}
                          disabled={busyId === t.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#CC0000] border border-[#FECACA] hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <X size={13} />Reject
                        </button>
                        <button
                          onClick={() => handleApprove(t)}
                          disabled={busyId === t.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#008009] hover:bg-[#006607] rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Check size={13} />{busyId === t.id ? "Working…" : "Approve"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Pagination page={safePage} totalPages={totalPages} total={filtered.length} onPageChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={rejectTarget !== null}
        title="Reject Signup"
        message={`Reject ${rejectTarget?.name}'s registration? Their pending account will be removed.`}
        confirmLabel="Reject"
        danger
        onConfirm={handleReject}
        onCancel={() => setRejectTarget(null)}
      />
      {detailTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Details for ${detailTarget.name}`}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDetailTarget(null)} />
          <div className="relative z-10 w-full max-w-md bg-[var(--bg-card)] rounded-2xl shadow-[var(--shadow-lg)] border border-[var(--border-color)] p-6">
            <h3 className="font-semibold text-[var(--text-primary)] mb-1">{detailTarget.name}</h3>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Requested {detailTarget.created_at ? formatDate(detailTarget.created_at) : "—"}
            </p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-[var(--text-muted)]">Email</dt><dd className="text-[var(--text-primary)] truncate">{detailTarget.email}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-[var(--text-muted)]">Phone</dt><dd className="text-[var(--text-primary)]">{detailTarget.phone ?? "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-[var(--text-muted)]">Company</dt><dd className="text-[var(--text-primary)] truncate">{detailTarget.company_name ?? "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-[var(--text-muted)]">Employment</dt><dd className="text-[var(--text-primary)] capitalize">{detailTarget.employment_status ?? "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-[var(--text-muted)]">Income</dt><dd className="text-[var(--text-primary)]">{detailTarget.monthly_income ? `P${Number(detailTarget.monthly_income).toLocaleString()}/mo` : "—"}</dd></div>
            </dl>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setDetailTarget(null)} className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-muted)] transition-colors">Close</button>
              <button
                onClick={() => { const t = detailTarget; setDetailTarget(null); void handleApprove(t); }}
                disabled={busyId === detailTarget.id}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#008009] hover:bg-[#006607] rounded-lg transition-colors disabled:opacity-50"
              >
                <Check size={13} />Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
