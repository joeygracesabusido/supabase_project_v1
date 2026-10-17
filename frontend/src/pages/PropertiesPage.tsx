import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Building2,
  Search,
  Trash2,
  AlertCircle,
  Download,
  MapPin,
  Layers,
  MoreVertical,
  Pencil,
  Check,
} from "lucide-react";
import { getProperties, deleteProperty, type Property } from "../api/properties";
import { PageHeader } from "../components/ui/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Pagination } from "../components/ui/Pagination";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { AddPropertyModal } from "../components/properties/AddPropertyModal";
import { EditPropertyModal } from "../components/properties/EditPropertyModal";
import { useGlobalShortcuts } from "../lib/useShortcuts";
import { downloadCsv } from "../lib/csv";

export function PropertiesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Property | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchDelete, setBatchDelete] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const limit = 20;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["properties", search, page],
    queryFn: () =>
      getProperties({
        page: String(page),
        limit: String(limit),
        ...(search ? { search } : {}),
      }),
    retry: 1,
  });

  const properties = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, total_pages: 0 };

  useGlobalShortcuts(
    useMemo(
      () => ({
        Escape: () => {
          setShowAdd(false);
          setEditTarget(null);
          setDeleteTarget(null);
          setActiveMenu(null);
        },
        n: () => setShowAdd(true),
      }),
      [],
    ),
  );

  async function handleDelete(id: string) {
    try {
      await deleteProperty(id);
      toast.success("Property deleted");
      qc.invalidateQueries({ queryKey: ["properties"] });
    } catch {
      toast.error("Failed to delete property");
    }
    setDeleteTarget(null);
  }

  async function handleBatchDelete() {
    try {
      await Promise.all(Array.from(selected).map((id) => deleteProperty(id)));
      toast.success(`${selected.size} properties deleted`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["properties"] });
    } catch {
      toast.error("Failed to delete some properties");
    }
    setBatchDelete(false);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleExport() {
    downloadCsv(
      properties,
      [
        { key: "id", label: "ID" },
        { key: "name", label: "Name" },
        { key: "address", label: "Address" },
        { key: "city", label: "City" },
        { key: "building_type", label: "Type" },
        { key: "total_units", label: "Total Units" },
      ],
      "properties.csv",
    );
  }

  const total = typeof data?.total === "number" ? data.total : pagination.total;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Properties"
        subtitle={`${total || 0} properties in your portfolio`}
        action={
          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-muted)] transition-colors"
              title="Export CSV"
            >
              <Download size={16} />
              Export
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#003580] hover:bg-[#002d6c] rounded-lg transition-colors shadow-sm"
            >
              <Plus size={16} strokeWidth={2.5} />
              Add Property
            </button>
          </div>
        }
      />

      {/* Search & Batch Actions */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            data-search
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search properties..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071C2] focus:border-transparent transition-all placeholder:text-[var(--text-muted)]"
          />
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <span className="text-sm font-medium text-[#003580] dark:text-blue-300">
              {selected.size} selected
            </span>
            <button
              onClick={() => setBatchDelete(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#CC0000] hover:bg-[#b30000] rounded-md transition-colors"
            >
              <Trash2 size={13} />
              Delete
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-0 animate-pulse"
            >
              <div className="h-3 bg-[var(--bg-muted)] rounded-t-xl" />
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--bg-muted)]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[var(--bg-muted)] rounded w-3/4" />
                    <div className="h-3 bg-[var(--bg-muted)] rounded w-1/2" />
                  </div>
                </div>
                <div className="h-3 bg-[var(--bg-muted)] rounded w-full" />
                <div className="flex justify-between pt-3 border-t border-[var(--border-color)]">
                  <div className="h-3 bg-[var(--bg-muted)] rounded w-16" />
                  <div className="h-3 bg-[var(--bg-muted)] rounded w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-20 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)]">
          <div className="inline-flex p-3 rounded-full bg-red-50 dark:bg-red-950/30 mb-4">
            <AlertCircle size={28} className="text-[#CC0000]" />
          </div>
          <p className="font-semibold text-[var(--text-primary)] mb-1">
            Failed to load properties
          </p>
          <p className="text-sm text-[var(--text-secondary)] mb-5">
            There was an error fetching your properties.
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#003580] hover:bg-[#002d6c] rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      ) : properties.length === 0 ? (
        <div className="text-center py-20 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)]">
          <div className="inline-flex p-4 rounded-full bg-blue-50 dark:bg-blue-950/30 mb-4">
            <Building2 size={32} className="text-[#0071C2]" />
          </div>
          <p className="font-semibold text-[var(--text-primary)] mb-1">
            No properties yet
          </p>
          <p className="text-sm text-[var(--text-secondary)] mb-5">
            Add your first property to get started
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#003580] hover:bg-[#002d6c] rounded-lg transition-colors"
          >
            <Plus size={16} strokeWidth={2.5} />
            Add Property
          </button>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {properties.map((p: any) => {
              const isSelected = selected.has(p.id);
              return (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  title={`View units in ${p.name}`}
                  onClick={() => navigate(`/units?property=${p.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/units?property=${p.id}`);
                    }
                  }}
                  className={`group relative bg-[var(--bg-card)] rounded-xl border transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? "border-[#0071C2] ring-2 ring-[#0071C2]/20 shadow-md"
                      : "border-[var(--border-color)] hover:border-[#0071C2]/40 hover:shadow-md"
                  }`}
                >
                  {/* Top accent bar */}
                  <div
                    className={`h-1 rounded-t-xl ${
                      p.active ? "bg-[#008009]" : "bg-[var(--bg-muted)]"
                    }`}
                  />

                  <div className="p-5">
                    {/* Header: icon + title + actions */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2.5 rounded-lg ${
                            isSelected
                              ? "bg-[#0071C2]/10"
                              : "bg-[var(--bg-muted)]"
                          }`}
                        >
                          <Building2
                            size={20}
                            className={
                              isSelected
                                ? "text-[#0071C2]"
                                : "text-[var(--text-secondary)]"
                            }
                          />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-[var(--text-primary)] truncate leading-tight">
                            {p.name}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <MapPin
                              size={12}
                              className="text-[var(--text-muted)] flex-shrink-0"
                            />
                            <p className="text-xs text-[var(--text-secondary)] truncate">
                              {p.address}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenu(
                              activeMenu === p.id ? null : p.id,
                            );
                          }}
                          className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)] transition-colors"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>

                      {/* Dropdown menu */}
                      {activeMenu === p.id && (
                        <div className="absolute right-4 mt-8 z-20 w-44 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg shadow-[var(--shadow-lg)] py-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditTarget(p);
                              setActiveMenu(null);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-muted)] transition-colors"
                          >
                            <Pencil size={15} className="text-[#0071C2]" />
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(p.id);
                              setActiveMenu(null);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#CC0000] hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          >
                            <Trash2 size={15} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-2 mb-4">
                      <Badge status={p.active ? "active" : "inactive"} />
                      {p.asset_category || p.building_type ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-muted)]">
                          <Layers size={10} />
                          {p.asset_category || p.building_type}
                        </span>
                      ) : null}
                    </div>

                    {/* Footer stats */}
                    <div className="flex items-center justify-between pt-4 border-t border-[var(--border-color)]">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-lg font-bold text-[var(--text-primary)] leading-none">
                            {p.total_units ?? 0}
                          </p>
                          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                            units
                          </p>
                        </div>
                      </div>

                      {/* Selection checkbox */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(p.id);
                        }}
                        className={`flex items-center justify-center w-6 h-6 rounded-md border-2 transition-all ${
                          isSelected
                            ? "bg-[#0071C2] border-[#0071C2] text-white"
                            : "border-[var(--border-color)] hover:border-[#0071C2] text-transparent"
                        }`}
                        title={isSelected ? "Deselect" : "Select"}
                      >
                        <Check size={14} strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6">
            <Pagination
              page={pagination.page || page}
              totalPages={pagination.total_pages || 1}
              total={total}
              onPageChange={setPage}
            />
          </div>
        </>
      )}

      {/* Modals */}
      {showAdd && (
        <AddPropertyModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            toast.success("Property created");
            qc.invalidateQueries({ queryKey: ["properties"] });
          }}
        />
      )}

      {editTarget && (
        <EditPropertyModal
          property={editTarget}
          onClose={() => setEditTarget(null)}
          onUpdated={() => {
            toast.success("Property updated");
            qc.invalidateQueries({ queryKey: ["properties"] });
          }}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Property"
        message="Delete this property? This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={() => handleDelete(deleteTarget!)}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={batchDelete}
        title="Delete Selected Properties"
        message={`Delete ${selected.size} properties? This cannot be undone.`}
        confirmLabel="Delete All"
        danger
        onConfirm={handleBatchDelete}
        onCancel={() => setBatchDelete(false)}
      />
    </div>
  );
}
