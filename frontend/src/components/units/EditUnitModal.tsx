import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { getUnit, updateUnit, type Unit } from "../../api/units";

interface Props {
  unitId: string;
  onClose: () => void;
  onUpdated: () => void;
}

interface EditForm {
  unit_number: string;
  status: string;
  unit_type: string;
  rental_price: string;
  floor_number: string;
  floor_area: string;
  description: string;
}

const inputCls =
  "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelCls = "block text-sm font-medium text-slate-700 mb-1";

function apiError(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const response = (err as { response?: { data?: { error?: unknown } } })
      .response;
    if (typeof response?.data?.error === "string") return response.data.error;
  }
  return fallback;
}

function EditUnitForm({
  unit,
  onClose,
  onUpdated,
}: {
  unit: Unit;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [form, setForm] = useState<EditForm>({
    unit_number: unit.unit_number ?? "",
    status: unit.status ?? "vacant",
    unit_type: unit.unit_type ?? "",
    rental_price:
      unit.rental_price != null ? String(unit.rental_price) : "",
    floor_number:
      unit.floor_number != null ? String(unit.floor_number) : "",
    floor_area: unit.floor_area != null ? String(unit.floor_area) : "",
    description: unit.description ?? "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.unit_number.trim()) return;
    setError("");
    setSaving(true);
    try {
      await updateUnit(unit.id, {
        unit_number: form.unit_number.trim(),
        status: form.status as Unit["status"],
        unit_type: form.unit_type.trim() || null,
        rental_price: form.rental_price ? Number(form.rental_price) : null,
        floor_number: form.floor_number ? Number(form.floor_number) : null,
        floor_area: form.floor_area ? Number(form.floor_area) : null,
        description: form.description.trim() || null,
      });
      onUpdated();
      onClose();
    } catch (err: unknown) {
      setError(apiError(err, "Failed to update unit."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="px-6 py-5 space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Unit Number *</label>
          <input
            value={form.unit_number}
            onChange={(e) => set("unit_number", e.target.value)}
            className={inputCls}
            placeholder="e.g. A-101"
          />
        </div>
        <div>
          <label className={labelCls}>Status *</label>
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
            className={inputCls}
          >
            <option value="vacant">Vacant</option>
            <option value="occupied">Occupied</option>
            <option value="reserved">Reserved</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
      </div>

      {form.status === "occupied" && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Marking a unit occupied without a lease leaves no tenant linked to
          it. Prefer assigning via Tenants (creates a lease) instead.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Unit Type</label>
          <input
            value={form.unit_type}
            onChange={(e) => set("unit_type", e.target.value)}
            className={inputCls}
            placeholder="e.g. Studio, 1BR"
          />
        </div>
        <div>
          <label className={labelCls}>Rent / mo (₱)</label>
          <input
            value={form.rental_price}
            onChange={(e) => set("rental_price", e.target.value)}
            type="number"
            min="0"
            step="0.01"
            className={inputCls}
            placeholder="e.g. 15000"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Floor</label>
          <input
            value={form.floor_number}
            onChange={(e) => set("floor_number", e.target.value)}
            type="number"
            className={inputCls}
            placeholder="e.g. 2"
          />
        </div>
        <div>
          <label className={labelCls}>Floor Area (sqm)</label>
          <input
            value={form.floor_area}
            onChange={(e) => set("floor_area", e.target.value)}
            type="number"
            min="0"
            step="0.01"
            className={inputCls}
            placeholder="e.g. 32.5"
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Description</label>
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          className={`${inputCls} resize-none`}
          placeholder="Optional notes about this unit…"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !form.unit_number.trim()}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

export function EditUnitModal({ unitId, onClose, onUpdated }: Props) {
  const {
    data: unit,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["unit", unitId],
    queryFn: () => getUnit(unitId),
    retry: 1,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Edit Unit"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            Edit Unit
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded p-1 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            Loading unit…
          </div>
        ) : isError || !unit ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-red-600 mb-4">
              Failed to load unit.
            </p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <EditUnitForm
            key={unit.id}
            unit={unit}
            onClose={onClose}
            onUpdated={onUpdated}
          />
        )}
      </div>
    </div>
  );
}
