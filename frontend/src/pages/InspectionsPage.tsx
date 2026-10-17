import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Plus, AlertCircle, Search, Building2, User, Calendar, ChevronRight, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { toast } from "sonner";

import { getInspections, createInspection } from "../api/inspections";
import { getLeases } from "../api/leases";
import { formatDate } from "../lib/utils";
import { PageHeader } from "../components/ui/PageHeader";
import { Badge } from "../components/ui/Badge";

const inputClass =
  "w-full px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#0071C2] focus:border-transparent transition-colors";

function apiError(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

const typeConfig: Record<string, { label: string; icon: typeof ArrowUpCircle; color: string }> = {
  move_in: { label: "Move-in", icon: ArrowUpCircle, color: "#0071C2" },
  move_out: { label: "Move-out", icon: ArrowDownCircle, color: "#FEBA02" },
};

export function InspectionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [leaseId, setLeaseId] = useState("");
  const [type, setType] = useState<"move_in" | "move_out">("move_in");
  const [scheduledDate, setScheduledDate] = useState("");

  const {
    data: inspections,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["inspections"],
    queryFn: () => getInspections(),
    retry: 1,
  });

  const { data: leasesData } = useQuery({
    queryKey: ["leases", "all-for-inspections"],
    queryFn: () => getLeases({ page: "1", limit: "100" }),
    enabled: showForm,
  });
  const leases = leasesData?.data || [];

  const createMutation = useMutation({
    mutationFn: createInspection,
    onSuccess: (inspection) => {
      toast.success("Inspection created with the default checklist");
      queryClient.invalidateQueries({ queryKey: ["inspections"] });
      navigate(`/inspections/${inspection.id}`);
    },
    onError: (err) => toast.error(apiError(err, "Failed to create inspection")),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaseId) {
      toast.error("Select a lease first");
      return;
    }
    createMutation.mutate({
      lease_id: leaseId,
      type,
      ...(scheduledDate ? { scheduled_date: scheduledDate } : {}),
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Inspections"
        subtitle="Move-in and move-out unit condition reports"
        action={
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 bg-[#003580] hover:bg-[#00224F] text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors shadow-sm"
          >
            <Plus size={16} /> New Inspection
          </button>
        }
      />

      {showForm && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-[var(--shadow-sm)] mb-6 overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border-color)] bg-[var(--bg-muted)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Create New Inspection</h3>
          </div>
          <form onSubmit={handleCreate} className="p-5 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Lease
              </label>
              <select
                value={leaseId}
                onChange={(e) => setLeaseId(e.target.value)}
                className={inputClass}
              >
                <option value="">Select a lease…</option>
                {leases.map((l: any) => (
                  <option key={l.id} value={l.id}>
                    {l.tenant_name} — {l.property_name} · {l.unit_number}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Type
              </label>
              <select
                value={type}
                onChange={(e) =>
                  setType(e.target.value as "move_in" | "move_out")
                }
                className={inputClass}
              >
                <option value="move_in">Move-in</option>
                <option value="move_out">Move-out</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Scheduled date (optional)
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-[#003580] hover:bg-[#00224F] disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors shadow-sm"
              >
                {createMutation.isPending ? "Creating…" : "Create inspection"}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-5 animate-pulse h-20"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-16 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)]">
          <AlertCircle size={40} className="mx-auto mb-3 text-[#CC0000] opacity-60" />
          <p className="font-medium text-[#CC0000]">Failed to load inspections</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">Please check your connection and try again.</p>
          <button
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center gap-2 bg-[#003580] hover:bg-[#00224F] text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors shadow-sm"
          >
            Retry
          </button>
        </div>
      ) : !inspections || inspections.length === 0 ? (
        <div className="text-center py-16 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)]">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--bg-muted)] flex items-center justify-center">
            <ClipboardCheck size={28} className="text-[var(--text-muted)]" />
          </div>
          <p className="font-medium text-[var(--text-primary)]">No inspections yet</p>
          <p className="text-sm text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
            Create a move-in inspection when a tenant takes possession of a unit, or a move-out inspection when they leave.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-5 inline-flex items-center gap-2 bg-[#003580] hover:bg-[#00224F] text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors shadow-sm"
          >
            <Plus size={16} /> Create First Inspection
          </button>
        </div>
      ) : (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {inspections.length} Inspection{inspections.length !== 1 ? "s" : ""}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <Search size={14} />
              <span>Showing all</span>
            </div>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-muted)]">
                <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3">
                  Property / Unit
                </th>
                <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3">
                  Tenant
                </th>
                <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3">
                  Type
                </th>
                <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3">
                  Items
                </th>
                <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3">
                  Created
                </th>
                <th className="w-10 px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {inspections.map((ins) => {
                const tc = typeConfig[ins.type] || typeConfig.move_in;
                const TypeIcon = tc.icon;
                return (
                  <tr
                    key={ins.id}
                    className="hover:bg-[var(--bg-muted)] transition-colors cursor-pointer group"
                    onClick={() => navigate(`/inspections/${ins.id}`)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#003580]/10 flex items-center justify-center flex-shrink-0">
                          <Building2 size={16} className="text-[#003580]" />
                        </div>
                        <div>
                          <Link
                            to={`/inspections/${ins.id}`}
                            className="text-sm font-semibold text-[#003580] hover:text-[#00224F] group-hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {ins.leases?.units.properties.name}
                          </Link>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            Unit {ins.leases?.units.unit_number}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[var(--bg-muted)] flex items-center justify-center flex-shrink-0">
                          <User size={14} className="text-[var(--text-muted)]" />
                        </div>
                        <span className="text-sm text-[var(--text-primary)]">
                          {ins.leases?.tenants.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: `${tc.color}15`, color: tc.color }}>
                        <TypeIcon size={12} />
                        {tc.label}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge status={ins.status} />
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-[var(--text-secondary)] font-medium">
                        {ins.inspection_items.length}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                        <Calendar size={12} />
                        {formatDate(ins.created_at)}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-[#003580] transition-colors" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
