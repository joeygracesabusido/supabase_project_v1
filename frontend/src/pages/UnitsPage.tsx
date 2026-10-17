import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Home, Search, AlertCircle, Building2, BedDouble, PhilippinePeso, MapPin, X, Plus, Pencil } from "lucide-react";
import { getUnits, type Unit } from "../api/units";
import { getProperty } from "../api/properties";
import { PageHeader } from "../components/ui/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Pagination } from "../components/ui/Pagination";
import { AddUnitModal } from "../components/units/AddUnitModal";
import { EditUnitModal } from "../components/units/EditUnitModal";

export function UnitsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const propertyId = searchParams.get("property");
  const limit = 20;

  // Reset to first page whenever the property filter changes (render-time
  // adjustment — the supported alternative to setState inside an effect)
  const [prevPropertyId, setPrevPropertyId] = useState(propertyId);
  if (prevPropertyId !== propertyId) {
    setPrevPropertyId(propertyId);
    setPage(1);
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["units", search, page, propertyId],
    queryFn: () =>
      getUnits({
        page: String(page),
        limit: String(limit),
        ...(search ? { search } : {}),
        ...(propertyId ? { property_id: propertyId } : {}),
      }),
    retry: 1,
  });

  const { data: property } = useQuery({
    queryKey: ["property", propertyId],
    queryFn: () => getProperty(propertyId ?? ""),
    enabled: !!propertyId,
    retry: 1,
  });

  const units = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, total_pages: 0 };
  const propertyName = property?.name ?? (propertyId ? `Property #${propertyId}` : "");

  function clearPropertyFilter() {
    setSearchParams({});
    setPage(1);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Units"
        subtitle={
          propertyId
            ? `${pagination.total || 0} units in ${propertyName}`
            : `${pagination.total || 0} total units`
        }
        action={
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#003580] hover:bg-[#002d6c] rounded-lg transition-colors shadow-sm"
          >
            <Plus size={16} strokeWidth={2.5} />
            Add Unit
          </button>
        }
      />

      {propertyId && (
        <div className="flex items-center justify-between gap-3 mb-6 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <span className="flex items-center gap-2 text-sm font-medium text-[#003580] dark:text-blue-300 min-w-0">
            <Building2 size={15} className="flex-shrink-0" />
            <span className="truncate">Showing units in {propertyName}</span>
          </span>
          <button
            onClick={clearPropertyFilter}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#003580] dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-md transition-colors flex-shrink-0"
          >
            <X size={13} strokeWidth={2.5} />
            Show all
          </button>
        </div>
      )}

      <div
        className="flex items-center gap-3 mb-6 p-4 rounded-xl"
        style={{
          background: "linear-gradient(135deg, #003580 0%, #00224f 100%)",
        }}
      >
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50"
          />
          <input
            data-search
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search units by number, property, or type…"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm bg-white/15 text-white placeholder:text-white/50 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/20 transition-colors"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border p-5 animate-pulse"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--border-color)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="h-5 w-20 rounded" style={{ backgroundColor: "var(--bg-muted)" }} />
                <div className="h-5 w-16 rounded-full" style={{ backgroundColor: "var(--bg-muted)" }} />
              </div>
              <div className="space-y-3">
                <div className="h-4 w-32 rounded" style={{ backgroundColor: "var(--bg-muted)" }} />
                <div className="h-4 w-24 rounded" style={{ backgroundColor: "var(--bg-muted)" }} />
                <div className="h-4 w-20 rounded" style={{ backgroundColor: "var(--bg-muted)" }} />
              </div>
              <div className="mt-4 pt-4 border-t flex justify-between" style={{ borderColor: "var(--border-color)" }}>
                <div className="h-4 w-16 rounded" style={{ backgroundColor: "var(--bg-muted)" }} />
                <div className="h-4 w-20 rounded" style={{ backgroundColor: "var(--bg-muted)" }} />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div
          className="text-center py-16 rounded-xl"
          style={{ backgroundColor: "var(--bg-card)" }}
        >
          <AlertCircle
            size={40}
            className="mx-auto mb-3"
            style={{ color: "var(--text-muted)" }}
          />
          <p className="font-medium" style={{ color: "var(--danger-500, #cc0000)" }}>
            Failed to load units
          </p>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            There was an error fetching your units.
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            style={{ backgroundColor: "#003580" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#00224f")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#003580")}
          >
            Retry
          </button>
        </div>
      ) : units.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl"
          style={{ backgroundColor: "var(--bg-card)" }}
        >
          <Home
            size={40}
            className="mx-auto mb-3"
            style={{ color: "var(--text-muted)" }}
          />
          <p className="font-medium" style={{ color: "var(--text-primary)" }}>
            No units found
          </p>
          <p className="text-sm mt-1 mb-5" style={{ color: "var(--text-secondary)" }}>
            Add a property with units to get started.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            style={{ backgroundColor: "#003580" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#00224f")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#003580")}
          >
            <Plus size={16} strokeWidth={2.5} />
            Add Unit
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {units.map((u: Unit) => (
              <div
                key={u.id}
                role="button"
                tabIndex={0}
                title={`Edit ${u.unit_number}`}
                onClick={() => setEditTarget(u.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setEditTarget(u.id);
                  }
                }}
                className="group rounded-xl border p-5 transition-all duration-200 hover:shadow-md cursor-pointer"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border-color)",
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-lg"
                      style={{ backgroundColor: "#003580", color: "#ffffff" }}
                    >
                      <Building2 size={14} />
                    </div>
                    <div>
                      <p
                        className="text-sm font-semibold leading-tight"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {u.unit_number}
                      </p>
                      {u.floor_number && (
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          Floor {u.floor_number}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge status={u.status || "vacant"} />
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <MapPin size={13} style={{ color: "var(--text-muted)" }} />
                    <span
                      className="text-sm truncate"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {u.property_name || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BedDouble size={13} style={{ color: "var(--text-muted)" }} />
                    <span
                      className="text-sm capitalize"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {u.unit_type || "—"}
                      {u.bedroom_count ? ` · ${u.bedroom_count}BR` : ""}
                    </span>
                  </div>
                </div>

                <div
                  className="pt-3 border-t flex items-center justify-between"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <div className="flex items-center gap-1">
                    <PhilippinePeso size={13} style={{ color: "var(--text-muted)" }} />
                    <span
                      className="text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {u.rental_price
                        ? Number(u.rental_price).toLocaleString()
                        : "—"}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      /mo
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditTarget(u.id);
                    }}
                    title={`Edit ${u.unit_number}`}
                    className="flex items-center gap-1 text-xs font-medium hover:bg-blue-50 px-2 py-1 rounded-md transition-colors"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <Pencil size={12} />
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Pagination
            page={pagination.page || page}
            totalPages={pagination.total_pages || 1}
            total={pagination.total}
            onPageChange={setPage}
          />
        </>
      )}

      {showAdd && (
        <AddUnitModal
          defaultPropertyId={propertyId}
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            toast.success("Unit created");
            qc.invalidateQueries({ queryKey: ["units"] });
          }}
        />
      )}

      {editTarget !== null && (
        <EditUnitModal
          unitId={editTarget}
          onClose={() => setEditTarget(null)}
          onUpdated={() => {
            toast.success("Unit updated");
            qc.invalidateQueries({ queryKey: ["units"] });
          }}
        />
      )}
    </div>
  );
}
