import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, MapPin, User, Calendar, Wrench, Banknote } from "lucide-react";
import {
  getTicket,
  getWorkers,
  updateTicket,
  updateTicketStatus,
  type MaintenanceTicket,
} from "../../api/maintenance";
import { Badge } from "../ui/Badge";
import { formatDate } from "../../lib/utils";

interface Props {
  ticketId: string;
  onClose: () => void;
  onUpdated: () => void;
}

const inputCls =
  "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

function apiError(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function TicketDetailForm({
  ticket,
  onClose,
  onUpdated,
  refetch,
}: Props & { ticket: MaintenanceTicket; refetch: () => void }) {
  const [workerId, setWorkerId] = useState(
    ticket.assigned_worker_id != null ? String(ticket.assigned_worker_id) : "",
  );
  const [priority, setPriority] = useState(ticket.priority ?? "medium");
  const [notes, setNotes] = useState(ticket.notes ?? "");
  const [resolution, setResolution] = useState(ticket.resolution_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [changingStatus, setChangingStatus] = useState<string | null>(null);

  const { data: workers = [] } = useQuery({
    queryKey: ["maintenance-workers"],
    queryFn: getWorkers,
    retry: 1,
  });

  async function handleSave() {
    setSaving(true);
    try {
      await updateTicket(ticket.id, {
        assigned_worker_id: workerId || null,
        priority,
        notes: notes.trim() || null,
        resolution_notes: resolution.trim() || null,
      });
      toast.success("Ticket updated");
      onUpdated();
      refetch();
    } catch (err: unknown) {
      toast.error(apiError(err, "Failed to update ticket."));
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(status: string) {
    if (status === "completed" && !resolution.trim()) {
      toast.error("Add resolution notes before completing.");
      return;
    }
    setChangingStatus(status);
    try {
      await updateTicketStatus(
        ticket.id,
        status,
        status === "completed" && resolution.trim()
          ? resolution.trim()
          : undefined,
      );
      toast.success(`Ticket ${status.replace(/_/g, " ")}`);
      onUpdated();
      refetch();
    } catch (err: unknown) {
      toast.error(apiError(err, "Failed to update status."));
    } finally {
      setChangingStatus(null);
    }
  }

  const canProgress = ticket.status === "open";
  const canComplete = ticket.status === "open" || ticket.status === "in_progress";
  const canCancel =
    ticket.status === "open" || ticket.status === "in_progress";
  const canReopen =
    ticket.status === "completed" || ticket.status === "cancelled";

  return (
    <div className="px-6 py-5 space-y-5">
      {/* Description */}
      <div>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--text-primary)" }}
        >
          {ticket.description}
        </p>
        <div className="flex items-center gap-4 flex-wrap mt-3">
          {ticket.property_name && (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              <MapPin size={12} />
              {ticket.property_name}
              {ticket.unit_number ? ` · Unit ${ticket.unit_number}` : ""}
            </span>
          )}
          {ticket.tenant_name && (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              <User size={12} />
              {ticket.tenant_name}
            </span>
          )}
          <span
            className="inline-flex items-center gap-1.5 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            <Calendar size={12} />
            {formatDate(ticket.created_at)}
          </span>
          <span
            className="inline-flex items-center gap-1.5 text-xs capitalize"
            style={{ color: "var(--text-muted)" }}
          >
            <Wrench size={12} />
            {ticket.ticket_type}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Badge status={ticket.priority} />
          <Badge status={ticket.status} />
        </div>
      </div>

      {/* Status actions */}
      <div className="rounded-xl border border-[var(--border-color)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide mb-3 text-[var(--text-muted)]">
          Update status
        </p>
        <div className="flex flex-wrap gap-2">
          {canProgress && (
            <button
              onClick={() => handleStatus("in_progress")}
              disabled={changingStatus !== null}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#0071C2] hover:bg-[#005a9e] disabled:opacity-50 rounded-lg transition-colors"
            >
              {changingStatus === "in_progress"
                ? "Updating…"
                : "Start Progress"}
            </button>
          )}
          {canComplete && (
            <button
              onClick={() => handleStatus("completed")}
              disabled={changingStatus !== null}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#008009] hover:bg-[#006607] disabled:opacity-50 rounded-lg transition-colors"
            >
              {changingStatus === "completed"
                ? "Updating…"
                : "Mark Completed"}
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => handleStatus("cancelled")}
              disabled={changingStatus !== null}
              className="px-4 py-2 text-sm font-medium text-[#CC0000] border border-[#FECACA] hover:bg-red-50 disabled:opacity-50 rounded-lg transition-colors"
            >
              {changingStatus === "cancelled" ? "Updating…" : "Cancel Ticket"}
            </button>
          )}
          {canReopen && (
            <button
              onClick={() => handleStatus("open")}
              disabled={changingStatus !== null}
              className="px-4 py-2 text-sm font-medium border border-[var(--border-color)] hover:bg-[var(--bg-muted)] disabled:opacity-50 rounded-lg transition-colors text-[var(--text-primary)]"
            >
              {changingStatus === "open" ? "Updating…" : "Reopen"}
            </button>
          )}
        </div>
      </div>

      {/* Assignment */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Assigned worker
          </label>
          <select
            value={workerId}
            onChange={(e) => setWorkerId(e.target.value)}
            className={inputCls}
          >
            <option value="">Unassigned</option>
            {workers.map((w) => (
              <option key={w.id} value={String(w.id)}>
                {w.worker_name}
                {w.specialty ? ` · ${w.specialty}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Priority
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className={`${inputCls} capitalize`}
          >
            {["low", "medium", "high", "urgent"].map((p) => (
              <option key={p} value={p} className="capitalize">
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Staff notes = the comment thread */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Staff notes <span className="text-slate-400">(internal comment)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={`${inputCls} resize-none`}
          placeholder="Progress updates, tenant coordination, parts ordered…"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Resolution notes{" "}
          <span className="text-slate-400">(required to complete)</span>
        </label>
        <textarea
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          rows={2}
          className={`${inputCls} resize-none`}
          placeholder="What was done to resolve the issue…"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Close
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

export function TicketDetailModal({ ticketId, onClose, onUpdated }: Props) {
  const {
    data: ticket,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => getTicket(ticketId),
    retry: 1,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Ticket Details"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto bg-[var(--bg-card)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)] font-mono tracking-wide">
            {ticket?.ticket_number ?? "Ticket"}
          </h2>
          <div className="flex items-center gap-3">
            {ticket && (
              <Link
                to={`/item-financing?new=1&ticket_id=${ticket.id}&unit_id=${ticket.unit_id}`}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#003580] hover:underline"
              >
                <Banknote size={14} />
                Request Financing
              </Link>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 rounded p-1 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            Loading ticket…
          </div>
        ) : isError || !ticket ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-red-600 mb-4">
              Failed to load ticket.
            </p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <TicketDetailForm
            key={ticket.id}
            ticketId={ticketId}
            ticket={ticket}
            onClose={onClose}
            onUpdated={onUpdated}
            refetch={refetch}
          />
        )}
      </div>
    </div>
  );
}
