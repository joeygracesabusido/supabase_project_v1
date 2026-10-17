import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Users,
  Search,
  Mail,
  Phone,
  AlertCircle,
  Building2,
  Briefcase,
  Home,
  Pencil,
} from "lucide-react";
import { getTenants, type Tenant } from "../api/tenants";
import { PageHeader } from "../components/ui/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Pagination } from "../components/ui/Pagination";
import { AddTenantModal } from "../components/tenants/AddTenantModal";
import { EditTenantModal } from "../components/tenants/EditTenantModal";

export function TenantsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const limit = 20;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["tenants", search, page],
    queryFn: () =>
      getTenants({
        page: String(page),
        limit: String(limit),
        ...(search ? { search } : {}),
      }),
    retry: 1,
  });

  const tenants = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, total_pages: 0 };
  const total = typeof data?.total === "number" ? data.total : pagination.total;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Tenants"
        subtitle={`${total || 0} registered tenants`}
        action={
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-[#003580] hover:bg-[#00224f] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors shadow-sm"
          >
            <Plus size={16} />
            Add Tenant
          </button>
        }
      />

      <div className="relative mb-6 max-w-sm">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
        />
        <input
          data-search
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search tenants… (press /)"
          className="w-full pl-9 pr-3 py-2.5 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#0071C2] focus:border-transparent transition-shadow"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-5 animate-pulse h-36"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <AlertCircle size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium text-red-500">Failed to load tenants</p>
          <p className="text-sm mb-4">
            There was an error fetching your tenants.
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 bg-[#003580] hover:bg-[#00224f] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      ) : tenants.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No tenants found</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tenants.map((t: Tenant) => (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                title={`Edit ${t.name}`}
                onClick={() => setEditTarget(t.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setEditTarget(t.id);
                  }
                }}
                className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-5 hover:shadow-[var(--shadow-md)] transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#003580] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {t.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {t.name}
                      </p>
                      {t.company_name && (
                        <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] mt-0.5">
                          <Building2 size={11} />
                          <span className="truncate">{t.company_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge status={t.active ? "active" : "inactive"} />
                </div>

                <div className="space-y-1.5 mb-4">
                  {t.email && (
                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <Mail size={12} className="text-[var(--text-muted)] flex-shrink-0" />
                      <span className="truncate">{t.email}</span>
                    </div>
                  )}
                  {t.phone && (
                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <Phone size={12} className="text-[var(--text-muted)] flex-shrink-0" />
                      <span>{t.phone}</span>
                    </div>
                  )}
                  {t.employment_status && (
                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <Briefcase size={12} className="text-[var(--text-muted)] flex-shrink-0" />
                      <span className="capitalize">{t.employment_status}</span>
                    </div>
                  )}
                  {t.current_properties && (
                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <Home size={12} className="text-[var(--text-muted)] flex-shrink-0" />
                      <span className="truncate">{t.current_properties}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-1 border-t border-[var(--border-color)] pt-3 -mb-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditTarget(t.id);
                    }}
                    title="Edit tenant"
                    className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[#003580] hover:bg-blue-50 px-3 py-1.5 rounded-md transition-colors"
                  >
                    <Pencil size={13} />
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Pagination
            page={pagination.page || page}
            totalPages={pagination.total_pages || 1}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}

      {showAdd && (
        <AddTenantModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["tenants"] });
            queryClient.invalidateQueries({ queryKey: ["units"] });
            queryClient.invalidateQueries({ queryKey: ["leases"] });
          }}
        />
      )}

      {editTarget !== null && (
        <EditTenantModal
          tenantId={editTarget}
          onClose={() => setEditTarget(null)}
          onUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ["tenants"] });
            queryClient.invalidateQueries({ queryKey: ["units"] });
            queryClient.invalidateQueries({ queryKey: ["leases"] });
          }}
        />
      )}
    </div>
  );
}
