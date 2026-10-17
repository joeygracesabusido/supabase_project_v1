import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";
import { createTicket } from "../../api/maintenance";
import { getProperties } from "../../api/properties";
import { getUnits, type Unit } from "../../api/units";
interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const TICKET_TYPES = [
  "general",
  "plumbing",
  "electrical",
  "hvac",
  "cleaning",
  "structural",
  "appliance",
  "landscaping",
];

const PRIORITIES = ["low", "medium", "high", "urgent"];

export function NewTicketModal({ onClose, onSuccess }: Props) {
  const [description, setDescription] = useState("");
  const [ticketType, setTicketType] = useState("general");
  const [priority, setPriority] = useState("medium");
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { data: propertiesData } = useQuery({
    queryKey: ["properties", "for-ticket"],
    queryFn: () => getProperties({ limit: "200" }),
  });
  const properties = propertiesData?.data || [];
  const { data: unitsData } = useQuery({
    queryKey: ["units", "for-ticket", propertyId],
    queryFn: () =>
      getUnits({ limit: "500", ...(propertyId ? { property_id: propertyId } : {}) }),
    enabled: Boolean(propertyId),
  });
  const units = (unitsData?.data || []) as Unit[];
  useEffect(() => {
    if (!units.some((u) => u.id === unitId)) setUnitId("");
  }, [propertyId, unitId, units]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await createTicket({
        description: description.trim(),
        ticket_type: ticketType,
        priority,
        ...(propertyId ? { property_id: propertyId } : {}),
        ...(unitId ? { unit_id: unitId } : {}),
      });
      toast.success("Maintenance ticket created");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to create ticket. Please try again.",
      );
      toast.error("Failed to create ticket");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col"
        style={{ maxHeight: "90vh" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Plus size={16} className="text-blue-500" />
            New Maintenance Ticket
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="px-6 py-4 space-y-4 overflow-y-auto"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue in detail…"
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Type
              </label>
              <select
                value={ticketType}
                onChange={(e) => setTicketType(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 capitalize"
              >
                {TICKET_TYPES.map((t) => (
                  <option key={t} value={t} className="capitalize">
                    {t}
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
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 capitalize"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p} className="capitalize">
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Property{" "}
                <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select…</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Unit{" "}
                <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                disabled={!propertyId}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
              >
                <option value="">
                  {propertyId ? "Select…" : "Pick a property first"}
                </option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unit_number}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1 pb-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !description.trim()}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={15} />
              {submitting ? "Creating…" : "Create Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
