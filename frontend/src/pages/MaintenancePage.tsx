import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Search,
  AlertCircle,
  Wrench,
  Calendar,
  MapPin,
  User,
  DollarSign,
  ArrowUpCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
  Ticket,
} from "lucide-react";
import { getTickets, type MaintenanceTicket } from "../api/maintenance";
import { Badge } from "../components/ui/Badge";
import { Pagination } from "../components/ui/Pagination";
import { formatDate, formatCurrency } from "../lib/utils";
import { NewTicketModal } from "../components/maintenance/NewTicketModal";
import { TicketDetailModal } from "../components/maintenance/TicketDetailModal";

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const STATUS_META: Record<
  string,
  { icon: typeof Clock; color: string; bg: string }
> = {
  open: {
    icon: Clock,
    color: "#003580",
    bg: "rgba(0,53,128,0.08)",
  },
  in_progress: {
    icon: ArrowUpCircle,
    color: "#E8A317",
    bg: "rgba(232,163,23,0.08)",
  },
  completed: {
    icon: CheckCircle2,
    color: "#008009",
    bg: "rgba(0,128,9,0.08)",
  },
  cancelled: {
    icon: XCircle,
    color: "#CC0000",
    bg: "rgba(204,0,0,0.08)",
  },
};

export function MaintenancePage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const limit = 20;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["tickets", statusFilter, page],
    queryFn: () =>
      getTickets({
        page: String(page),
        limit: String(limit),
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
    retry: 1,
  });

  const tickets = (data?.data || []).filter(
    (t: MaintenanceTicket) =>
      !search ||
      t.description?.toLowerCase().includes(search.toLowerCase()) ||
      t.ticket_number?.includes(search),
  );
  const pagination = data?.pagination || { page, total: 0, total_pages: 0 };
  const total = typeof data?.total === "number" ? data.total : pagination.total;

  const statusCounts = (data?.data || []).reduce(
    (acc: Record<string, number>, t: MaintenanceTicket) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page)" }}>
      {/* Header Banner */}
      <div
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #003580 0%, #00224f 60%, #001a3d 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.12)" }}
                >
                  <Wrench size={20} color="#FEBA02" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    Maintenance
                  </h1>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                    {total || 0} total ticket{(total || 0) !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowNewTicket(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "#FEBA02",
                color: "#003580",
                boxShadow: "0 2px 8px rgba(254,186,2,0.3)",
              }}
            >
              <Plus size={16} strokeWidth={2.5} />
              New Ticket
            </button>
          </div>

          {/* Quick Status Cards */}
          {data?.data && data.data.length > 0 && (
            <div className="grid grid-cols-4 gap-3 mt-6">
              {(["open", "in_progress", "completed", "cancelled"] as const).map(
                (s) => {
                  const meta = STATUS_META[s];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={s}
                      onClick={() => {
                        setStatusFilter(statusFilter === s ? "" : s);
                        setPage(1);
                      }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left"
                      style={{
                        background:
                          statusFilter === s
                            ? "rgba(255,255,255,0.18)"
                            : "rgba(255,255,255,0.07)",
                        border: `1px solid ${
                          statusFilter === s
                            ? "rgba(255,255,255,0.25)"
                            : "rgba(255,255,255,0.08)"
                        }`,
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: meta.bg }}
                      >
                        <Icon size={16} color={meta.color} />
                      </div>
                      <div>
                        <div
                          className="text-lg font-bold"
                          style={{ color: "white" }}
                        >
                          {statusCounts[s] || 0}
                        </div>
                        <div
                          className="text-xs capitalize font-medium"
                          style={{ color: "rgba(255,255,255,0.55)" }}
                        >
                          {s.replace(/_/g, " ")}
                        </div>
                      </div>
                    </button>
                  );
                },
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 -mt-4 pb-8">
        {/* Search & Filter Bar */}
        <div
          className="rounded-xl p-4 mb-6 flex items-center gap-3"
          style={{
            background: "var(--bg-card)",
            boxShadow: "var(--shadow-md)",
            border: "1px solid var(--border-color)",
          }}
        >
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              data-search
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ticket number or description..."
              className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none transition-all"
              style={{
                background: "var(--bg-muted)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#003580";
                e.currentTarget.style.boxShadow =
                  "0 0 0 3px rgba(0,53,128,0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border-color)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter
              size={14}
              style={{ color: "var(--text-muted)" }}
            />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2.5 rounded-lg text-sm font-medium outline-none cursor-pointer transition-all"
              style={{
                background: "var(--bg-muted)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Loading */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl p-5 animate-pulse"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  height: "100px",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg"
                    style={{ background: "var(--bg-muted)" }}
                  />
                  <div className="flex-1 space-y-2">
                    <div
                      className="h-3 rounded-full w-1/4"
                      style={{ background: "var(--bg-muted)" }}
                    />
                    <div
                      className="h-3 rounded-full w-3/4"
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
              border: "1px solid var(--border-color)",
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(204,0,0,0.06)" }}
            >
              <AlertCircle size={28} color="#CC0000" />
            </div>
            <p
              className="font-semibold text-base mb-1"
              style={{ color: "#CC0000" }}
            >
              Failed to load tickets
            </p>
            <p
              className="text-sm mb-5"
              style={{ color: "var(--text-secondary)" }}
            >
              There was an error fetching maintenance tickets.
            </p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "#003580",
                color: "white",
              }}
            >
              Retry
            </button>
          </div>
        ) : tickets.length === 0 ? (
          <div
            className="text-center py-20 rounded-xl"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "var(--bg-muted)" }}
            >
              <Ticket size={28} style={{ color: "var(--text-muted)" }} />
            </div>
            <p
              className="font-semibold text-base mb-1"
              style={{ color: "var(--text-primary)" }}
            >
              No maintenance tickets
            </p>
            <p
              className="text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              {search
                ? "No tickets match your search."
                : "No tickets found. Create one to get started."}
            </p>
          </div>
        ) : (
          <>
            {/* Results Header */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                Showing {tickets.length} of {total} ticket
                {total !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Ticket List */}
            <div className="space-y-3">
              {tickets
                .sort(
                  (a: MaintenanceTicket, b: MaintenanceTicket) =>
                    (PRIORITY_ORDER[a.priority] ?? 99) -
                    (PRIORITY_ORDER[b.priority] ?? 99),
                )
                .map((t: MaintenanceTicket) => {
                  const statusMeta = STATUS_META[t.status] || STATUS_META.open;
                  const StatusIcon = statusMeta.icon;

                  return (
                    <div
                      key={t.id}
                      role="button"
                      tabIndex={0}
                      title={`Open ${t.ticket_number}`}
                      onClick={() => setDetailId(t.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setDetailId(t.id);
                        }
                      }}
                      className="rounded-xl p-5 transition-all hover:scale-[1.005] cursor-pointer group"
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-color)",
                        boxShadow: "var(--shadow-sm)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = "var(--shadow-md)";
                        e.currentTarget.style.borderColor = "#003580";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                        e.currentTarget.style.borderColor = "var(--border-color)";
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Left: Ticket Info */}
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          {/* Status Icon */}
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                            style={{ background: statusMeta.bg }}
                          >
                            <StatusIcon size={18} color={statusMeta.color} />
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            {/* Top row: ticket number + badges */}
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span
                                className="text-xs font-mono font-semibold tracking-wide"
                                style={{ color: "#003580" }}
                              >
                                {t.ticket_number}
                              </span>
                              <Badge status={t.priority} />
                              <Badge status={t.status} />
                            </div>

                            {/* Description */}
                            <p
                              className="text-sm leading-relaxed line-clamp-2 mb-3"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {t.description}
                            </p>

                            {/* Meta row */}
                            <div className="flex items-center gap-4 flex-wrap">
                              {t.property_name && (
                                <span
                                  className="inline-flex items-center gap-1.5 text-xs font-medium"
                                  style={{ color: "var(--text-secondary)" }}
                                >
                                  <MapPin size={12} />
                                  {t.property_name}
                                </span>
                              )}
                              {t.unit_number && (
                                <span
                                  className="inline-flex items-center gap-1.5 text-xs font-medium"
                                  style={{ color: "var(--text-secondary)" }}
                                >
                                  Unit {t.unit_number}
                                </span>
                              )}
                              {t.assigned_worker_name && (
                                <span
                                  className="inline-flex items-center gap-1.5 text-xs font-medium"
                                  style={{ color: "var(--text-secondary)" }}
                                >
                                  <User size={12} />
                                  {t.assigned_worker_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Date + Cost */}
                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-1.5 justify-end mb-1">
                            <Calendar
                              size={12}
                              style={{ color: "var(--text-muted)" }}
                            />
                            <span
                              className="text-xs font-medium"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {formatDate(t.created_at)}
                            </span>
                          </div>
                          {t.estimated_cost && (
                            <div
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold"
                              style={{
                                background: "rgba(0,128,9,0.06)",
                                color: "#008009",
                              }}
                            >
                              <DollarSign size={11} />
                              {formatCurrency(t.estimated_cost)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Pagination */}
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
      </div>

      {showNewTicket && (
        <NewTicketModal
          onClose={() => setShowNewTicket(false)}
          onSuccess={() => {
            toast.success("Maintenance ticket created");
            queryClient.invalidateQueries({ queryKey: ["tickets"] });
          }}
        />
      )}

      {detailId !== null && (
        <TicketDetailModal
          ticketId={detailId}
          onClose={() => setDetailId(null)}
          onUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ["tickets"] });
          }}
        />
      )}
    </div>
  );
}
