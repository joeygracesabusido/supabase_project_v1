import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Megaphone,
  Plus,
  Eye,
  AlertCircle,
  X,
  Home,
  BedDouble,
  Bath,
  MapPin,
  Calendar,
  Trash2,
  Play,
  Pause,
  RotateCcw,
  LayoutGrid,
  List,
} from "lucide-react";
import { toast } from "sonner";
import {
  getListings,
  createListing,
  setListingStatus,
  deleteListing,
  type Listing,
} from "../api/listings";
import { getUnits } from "../api/units";
import { Badge } from "../components/ui/Badge";
import { Pagination } from "../components/ui/Pagination";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { formatDate } from "../lib/utils";

const STATUS_TABS = [
  { value: "", label: "All Listings", icon: LayoutGrid },
  { value: "draft", label: "Drafts", icon: List },
  { value: "published", label: "Published", icon: Play },
  { value: "closed", label: "Closed", icon: Pause },
];

export function ListingsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null);
  const queryClient = useQueryClient();
  const limit = 20;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["listings", statusFilter, page],
    queryFn: () =>
      getListings({
        page: String(page),
        limit: String(limit),
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
    retry: 1,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Listing["status"] }) =>
      setListingStatus(id, status),
    onSuccess: (listing) => {
      toast.success(`Listing ${listing.status}`);
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update status"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteListing(id),
    onSuccess: () => {
      toast.success("Listing deleted");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
    onError: (err: Error) => {
      setDeleteTarget(null);
      toast.error(err.message || "Failed to delete listing");
    },
  });

  const listings: Listing[] = data?.data || [];
  const pagination =
    data?.pagination || { page: 0, limit: 0, total: 0, total_pages: 0 };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div
          className="rounded-xl p-6 mb-6"
          style={{
            background: "linear-gradient(135deg, #003580 0%, #00224f 100%)",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <Megaphone size={28} className="opacity-90" />
                Listings Management
              </h1>
              <p className="text-blue-100 mt-1 text-sm">
                {pagination.total || 0} total listings · Manage your property
                listings and track performance
              </p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 bg-white hover:bg-blue-50 text-[#003580] text-sm font-semibold px-5 py-2.5 rounded-lg transition-all shadow-sm hover:shadow-md"
            >
              <Plus size={18} strokeWidth={2.5} />
              New Listing
            </button>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div
          className="flex items-center gap-1 p-1 rounded-xl mb-6 overflow-x-auto"
          style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-sm)" }}
        >
          {STATUS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = statusFilter === tab.value;
            const count =
              tab.value === ""
                ? pagination.total
                : listings.filter((l) => l.status === tab.value).length;
            return (
              <button
                key={tab.value}
                onClick={() => {
                  setStatusFilter(tab.value);
                  setPage(1);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
                style={{
                  background: isActive ? "#003580" : "transparent",
                  color: isActive ? "#ffffff" : "var(--text-secondary)",
                }}
              >
                <Icon size={15} />
                {tab.label}
                {isActive && count > 0 && (
                  <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl overflow-hidden animate-pulse"
                style={{
                  background: "var(--bg-card)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div className="h-44" style={{ background: "var(--bg-muted)" }} />
                <div className="p-4 space-y-3">
                  <div
                    className="h-5 w-3/4 rounded"
                    style={{ background: "var(--bg-muted)" }}
                  />
                  <div
                    className="h-4 w-1/2 rounded"
                    style={{ background: "var(--bg-muted)" }}
                  />
                  <div className="flex gap-4 pt-2">
                    <div
                      className="h-4 w-16 rounded"
                      style={{ background: "var(--bg-muted)" }}
                    />
                    <div
                      className="h-4 w-20 rounded"
                      style={{ background: "var(--bg-muted)" }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div
            className="text-center py-20 rounded-xl"
            style={{
              background: "var(--bg-card)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "var(--bg-muted)" }}
            >
              <AlertCircle size={28} style={{ color: "var(--text-muted)" }} />
            </div>
            <p
              className="font-semibold text-lg"
              style={{ color: "var(--text-primary)" }}
            >
              Failed to load listings
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Something went wrong while fetching your listings.
            </p>
            <button
              onClick={() => refetch()}
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-lg transition-all"
              style={{
                background: "#003580",
                color: "#ffffff",
              }}
            >
              Try Again
            </button>
          </div>
        ) : listings.length === 0 ? (
          <div
            className="text-center py-20 rounded-xl"
            style={{
              background: "var(--bg-card)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "var(--bg-muted)" }}
            >
              <Megaphone size={28} style={{ color: "var(--text-muted)" }} />
            </div>
            <p
              className="font-semibold text-lg"
              style={{ color: "var(--text-primary)" }}
            >
              No listings found
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              {statusFilter
                ? `No ${statusFilter} listings at the moment.`
                : "Create your first listing to start attracting tenants."}
            </p>
            {!statusFilter && (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-lg transition-all"
                style={{
                  background: "#003580",
                  color: "#ffffff",
                }}
              >
                <Plus size={16} />
                Create Listing
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Listings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {listings.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  onPublish={() =>
                    statusMutation.mutate({ id: l.id, status: "published" })
                  }
                  onClose={() =>
                    statusMutation.mutate({ id: l.id, status: "closed" })
                  }
                  onRepublish={() =>
                    statusMutation.mutate({ id: l.id, status: "published" })
                  }
                  onDelete={() => setDeleteTarget(l)}
                  isMutating={statusMutation.isPending}
                />
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-6">
              <Pagination
                page={pagination.page || page}
                totalPages={pagination.total_pages || 1}
                total={pagination.total}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateListingModal onClose={() => setShowCreate(false)} />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete listing?"
        message={`"${deleteTarget?.title}" will be permanently removed.`}
        confirmLabel="Delete"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Listing Card                                                        */
/* ──────────────────────────────────────────────────────────────────── */

function ListingCard({
  listing,
  onPublish,
  onClose,
  onRepublish,
  onDelete,
  isMutating,
}: {
  listing: Listing;
  onPublish: () => void;
  onClose: () => void;
  onRepublish: () => void;
  onDelete: () => void;
  isMutating: boolean;
}) {
  const l = listing;
  const hasPhoto = l.photos && l.photos.length > 0;

  return (
    <div
      className="rounded-xl overflow-hidden transition-all hover:-translate-y-0.5"
      style={{
        background: "var(--bg-card)",
        boxShadow: "var(--shadow-sm)",
        border: "1px solid var(--border-color)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)";
      }}
    >
      {/* Photo / Placeholder */}
      <div className="relative h-44 overflow-hidden">
        {hasPhoto ? (
          <img
            src={l.photos[0]}
            alt={l.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, var(--bg-muted) 0%, var(--border-light) 100%)",
            }}
          >
            <Home size={32} style={{ color: "var(--text-muted)" }} />
            <span
              className="text-xs mt-2 font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              No photo
            </span>
          </div>
        )}

        {/* Status Badge Overlay */}
        <div className="absolute top-3 left-3">
          <Badge status={l.status} />
        </div>

        {/* Views Badge */}
        <div
          className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold"
          style={{
            background: "rgba(0, 0, 0, 0.6)",
            color: "#ffffff",
            backdropFilter: "blur(4px)",
          }}
        >
          <Eye size={12} />
          {l.views_count}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4">
        {/* Title */}
        <h3
          className="font-semibold text-sm leading-tight line-clamp-2"
          style={{ color: "var(--text-primary)" }}
        >
          {l.title}
        </h3>

        {/* Property Location */}
        {l.unit?.properties && (
          <p
            className="flex items-center gap-1 text-xs mt-1.5"
            style={{ color: "var(--text-secondary)" }}
          >
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">
              {l.unit.properties.name}
              {l.unit.properties.city && ` · ${l.unit.properties.city}`}
            </span>
          </p>
        )}

        {/* Unit Info */}
        <div
          className="flex items-center gap-3 mt-3 text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          <span className="flex items-center gap-1">
            <Home size={12} />
            Unit {l.unit?.unit_number || "—"}
          </span>
          {l.unit?.bedroom_count != null && (
            <span className="flex items-center gap-1">
              <BedDouble size={12} />
              {l.unit.bedroom_count} BR
            </span>
          )}
          {l.unit?.bathroom_count != null && (
            <span className="flex items-center gap-1">
              <Bath size={12} />
              {l.unit.bathroom_count} BA
            </span>
          )}
        </div>

        {/* Divider */}
        <div
          className="my-3"
          style={{ borderTop: "1px solid var(--border-color)" }}
        />

        {/* Price */}
        <div>
          <span className="text-lg font-bold" style={{ color: "#003580" }}>
            ₱{Number(l.rent_amount).toLocaleString()}
          </span>
          <span className="text-xs ml-1" style={{ color: "var(--text-muted)" }}>
            /month
          </span>
        </div>

        {/* Date */}
        <p
          className="flex items-center gap-1 text-xs mt-2"
          style={{ color: "var(--text-muted)" }}
        >
          <Calendar size={11} />
          {l.published_at
            ? `Published ${formatDate(l.published_at)}`
            : `Created ${formatDate(l.created_at)}`}
        </p>

        {/* Actions */}
        <div
          className="flex items-center gap-2 mt-4 pt-3"
          style={{ borderTop: "1px solid var(--border-color)" }}
        >
          {l.status === "draft" && (
            <button
              onClick={onPublish}
              disabled={isMutating}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
              style={{
                background: "rgba(0, 128, 9, 0.1)",
                color: "#008009",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(0, 128, 9, 0.18)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(0, 128, 9, 0.1)";
              }}
            >
              <Play size={12} />
              Publish
            </button>
          )}
          {l.status === "published" && (
            <button
              onClick={onClose}
              disabled={isMutating}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
              style={{
                background: "rgba(254, 186, 2, 0.15)",
                color: "#b37d0d",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(254, 186, 2, 0.25)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(254, 186, 2, 0.15)";
              }}
            >
              <Pause size={12} />
              Close
            </button>
          )}
          {l.status === "closed" && (
            <button
              onClick={onRepublish}
              disabled={isMutating}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
              style={{
                background: "rgba(0, 128, 9, 0.1)",
                color: "#008009",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(0, 128, 9, 0.18)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(0, 128, 9, 0.1)";
              }}
            >
              <RotateCcw size={12} />
              Republish
            </button>
          )}
          <button
            onClick={onDelete}
            className="inline-flex items-center justify-center p-2 rounded-lg transition-colors"
            style={{
              background: "rgba(204, 0, 0, 0.08)",
              color: "#CC0000",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(204, 0, 0, 0.15)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(204, 0, 0, 0.08)";
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Create Listing Modal                                                 */
/* ──────────────────────────────────────────────────────────────────── */

function CreateListingModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    unit_id: "",
    title: "",
    description: "",
    rent_amount: "",
    deposit_amount: "",
    available_from: "",
    amenities: "",
  });

  const { data: unitsData } = useQuery({
    queryKey: ["units", "vacant-for-listing"],
    queryFn: () => getUnits({ status: "vacant", limit: "100" }),
  });
  const units = unitsData?.data || [];

  const createMutation = useMutation({
    mutationFn: () =>
      createListing({
        unit_id: form.unit_id,
        title: form.title,
        description: form.description || undefined,
        rent_amount: Number(form.rent_amount),
        deposit_amount: form.deposit_amount
          ? Number(form.deposit_amount)
          : undefined,
        available_from: form.available_from || undefined,
        amenities: form.amenities
          ? form.amenities
              .split(",")
              .map((a) => a.trim())
              .filter(Boolean)
          : undefined,
      }),
    onSuccess: () => {
      toast.success("Draft listing created");
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      onClose();
    },
    onError: (err: Error) =>
      toast.error(err.message || "Failed to create listing"),
  });

  const labelClass = "block text-xs font-semibold mb-1.5";
  const inputClass =
    "w-full px-3 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#003580]/30 focus:border-[#003580]";
  const inputStyle = {
    background: "var(--bg-input)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-color)",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        className="rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{
          background: "var(--bg-card)",
          boxShadow: "var(--shadow-lg)",
          border: "1px solid var(--border-color)",
        }}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--border-color)" }}
        >
          <div>
            <h2
              className="text-base font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Create New Listing
            </h2>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--text-secondary)" }}
            >
              List a vacant unit for prospective tenants
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "var(--bg-muted)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.unit_id || !form.title || !form.rent_amount) {
              toast.error("Unit, title and rent amount are required");
              return;
            }
            createMutation.mutate();
          }}
          className="px-6 py-5 space-y-4"
        >
          {/* Unit Select */}
          <div>
            <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
              Unit *
            </label>
            <select
              value={form.unit_id}
              onChange={(e) => setForm({ ...form, unit_id: e.target.value })}
              className={inputClass}
              style={inputStyle}
            >
              <option value="">Select a vacant unit…</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.property_name ? `${u.property_name} · ` : ""}
                  {u.unit_number}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
              Title *
            </label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Cozy 1BR near Ayala Ave"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={3}
              className={inputClass}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {/* Rent & Deposit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className={labelClass}
                style={{ color: "var(--text-secondary)" }}
              >
                Monthly Rent (₱) *
              </label>
              <input
                type="number"
                min="0"
                value={form.rent_amount}
                onChange={(e) =>
                  setForm({ ...form, rent_amount: e.target.value })
                }
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div>
              <label
                className={labelClass}
                style={{ color: "var(--text-secondary)" }}
              >
                Deposit (₱)
              </label>
              <input
                type="number"
                min="0"
                value={form.deposit_amount}
                onChange={(e) =>
                  setForm({ ...form, deposit_amount: e.target.value })
                }
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Date & Amenities */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className={labelClass}
                style={{ color: "var(--text-secondary)" }}
              >
                Available From
              </label>
              <input
                type="date"
                value={form.available_from}
                onChange={(e) =>
                  setForm({ ...form, available_from: e.target.value })
                }
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div>
              <label
                className={labelClass}
                style={{ color: "var(--text-secondary)" }}
              >
                Amenities
              </label>
              <input
                value={form.amenities}
                onChange={(e) =>
                  setForm({ ...form, amenities: e.target.value })
                }
                placeholder="Aircon, Parking, WiFi"
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Actions */}
          <div
            className="flex justify-end gap-3 pt-3"
            style={{ borderTop: "1px solid var(--border-color)" }}
          >
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
              style={{
                color: "var(--text-secondary)",
                background: "var(--bg-muted)",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-5 py-2.5 text-sm font-semibold rounded-lg transition-all disabled:opacity-50"
              style={{
                background: "#003580",
                color: "#ffffff",
              }}
              onMouseEnter={(e) => {
                if (!createMutation.isPending)
                  (e.currentTarget as HTMLElement).style.background =
                    "#00224f";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#003580";
              }}
            >
              {createMutation.isPending ? "Creating…" : "Create Draft"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
