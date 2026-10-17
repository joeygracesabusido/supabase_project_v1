import { useState } from "react";
import { useForm } from "react-hook-form";

export interface PropertyFormData {
  name: string;
  address: string;
  city: string;
  state: string;
  building_type: string;
  total_units: string;
  year_built: string;
  asset_category: string;
  description: string;
}

interface Props {
  defaultValues?: Partial<PropertyFormData>;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (data: PropertyFormData) => Promise<void>;
}

export function PropertyForm({
  defaultValues,
  submitLabel,
  onCancel,
  onSubmit,
}: Props) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PropertyFormData>({
    defaultValues: { total_units: "0", ...defaultValues },
  });

  async function handleFormSubmit(data: PropertyFormData) {
    if (!data.name.trim()) return;
    if (!data.address.trim()) return;
    setError("");
    setSaving(true);
    try {
      await onSubmit(data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save property.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="px-6 py-5 space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Property Name *
        </label>
        <input
          {...register("name", { required: true })}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. Sunrise Residences"
        />
        {errors.name && (
          <p className="text-red-500 text-xs mt-1">Name is required</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Address *
        </label>
        <input
          {...register("address", { required: true })}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="123 Rizal Street"
        />
        {errors.address && (
          <p className="text-red-500 text-xs mt-1">Address is required</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            City
          </label>
          <input
            {...register("city")}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Makati"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Province / State
          </label>
          <input
            {...register("state")}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Metro Manila"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Building Type
          </label>
          <select
            {...register("building_type")}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select type</option>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="mixed">Mixed Use</option>
            <option value="industrial">Industrial</option>
            <option value="condominium">Condominium</option>
            <option value="townhouse">Townhouse</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Total Units
          </label>
          <input
            {...register("total_units")}
            type="number"
            min="0"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Year Built
        </label>
        <input
          {...register("year_built")}
          type="number"
          min="1800"
          max={new Date().getFullYear()}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. 2015"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Asset Category
        </label>
        <input
          {...register("asset_category")}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. commercial"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Description
        </label>
        <textarea
          {...register("description")}
          rows={3}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Brief description of the property…"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
        >
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
