import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { createUnit } from "../../api/units";
import { getProperties } from "../../api/properties";

interface Props {
  defaultPropertyId?: string | null;
  onClose: () => void;
  onCreated: () => void;
}

interface UnitFormData {
  property_id: string;
  unit_number: string;
  status: string;
  unit_type: string;
  rental_price: string;
  floor_number: string;
  bedroom_count: string;
  bathroom_count: string;
  floor_area: string;
  description: string;
}

const inputCls =
  "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelCls = "block text-sm font-medium text-slate-700 mb-1";

export function AddUnitModal({ defaultPropertyId, onClose, onCreated }: Props) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: propsData } = useQuery({
    queryKey: ["properties-all"],
    queryFn: () => getProperties({ page: "1", limit: "100" }),
    retry: 1,
  });
  const properties = propsData?.data || [];

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UnitFormData>({
    defaultValues: {
      property_id: defaultPropertyId ?? "",
      unit_number: "",
      status: "vacant",
      unit_type: "",
      rental_price: "",
      floor_number: "",
      bedroom_count: "",
      bathroom_count: "",
      floor_area: "",
      description: "",
    },
  });

  async function onSubmit(data: UnitFormData) {
    if (!data.property_id) return;
    if (!data.unit_number.trim()) return;
    setError("");
    setSaving(true);
    try {
      await createUnit({
        property_id: data.property_id,
        unit_number: data.unit_number.trim(),
        status: (data.status || "vacant") as "vacant" | "occupied" | "maintenance" | "reserved",
        unit_type: data.unit_type.trim() || undefined,
        rental_price: data.rental_price ? Number(data.rental_price) : undefined,
        floor_number: data.floor_number ? Number(data.floor_number) : undefined,
        bedroom_count: data.bedroom_count ? Number(data.bedroom_count) : undefined,
        bathroom_count: data.bathroom_count ? Number(data.bathroom_count) : undefined,
        floor_area: data.floor_area ? Number(data.floor_area) : undefined,
        description: data.description.trim() || undefined,
      });
      onCreated();
      onClose();
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { error?: string } } }).response?.data?.error === "string"
          ? (err as { response: { data: { error: string } } }).response.data.error
          : "Failed to create unit.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add Unit"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            Add Unit
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded p-1 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className={labelCls}>Property *</label>
            <select {...register("property_id", { required: true })} className={inputCls}>
              <option value="">Select property</option>
              {properties.map((p: { id: string; name: string }) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name} (#{p.id})
                </option>
              ))}
            </select>
            {errors.property_id && (
              <p className="text-red-500 text-xs mt-1">Property is required</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Unit Number *</label>
              <input
                {...register("unit_number", { required: true })}
                className={inputCls}
                placeholder="e.g. A-101"
              />
              {errors.unit_number && (
                <p className="text-red-500 text-xs mt-1">Unit number is required</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select {...register("status")} className={inputCls}>
                <option value="vacant">Vacant</option>
                <option value="occupied">Occupied</option>
                <option value="reserved">Reserved</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Unit Type</label>
              <input
                {...register("unit_type")}
                className={inputCls}
                placeholder="e.g. Studio, 1BR"
              />
            </div>
            <div>
              <label className={labelCls}>Rent / mo (₱)</label>
              <input
                {...register("rental_price")}
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
                {...register("floor_number")}
                type="number"
                className={inputCls}
                placeholder="e.g. 2"
              />
            </div>
            <div>
              <label className={labelCls}>Floor Area (sqm)</label>
              <input
                {...register("floor_area")}
                type="number"
                min="0"
                step="0.01"
                className={inputCls}
                placeholder="e.g. 32.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Bedrooms</label>
              <input
                {...register("bedroom_count")}
                type="number"
                min="0"
                className={inputCls}
                placeholder="e.g. 1"
              />
            </div>
            <div>
              <label className={labelCls}>Bathrooms</label>
              <input
                {...register("bathroom_count")}
                type="number"
                min="0"
                className={inputCls}
                placeholder="e.g. 1"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea
              {...register("description")}
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
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
            >
              {saving ? "Saving…" : "Add Unit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
