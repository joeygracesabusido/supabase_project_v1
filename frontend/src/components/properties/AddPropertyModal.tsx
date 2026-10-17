import { X } from "lucide-react";
import { createProperty } from "../../api/properties";
import { PropertyForm, type PropertyFormData } from "./PropertyForm";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function AddPropertyModal({ onClose, onCreated }: Props) {
  async function handleSubmit(data: PropertyFormData) {
    await createProperty({
      name: data.name.trim(),
      address: data.address.trim(),
      city: data.city.trim() || undefined,
      state: data.state.trim() || undefined,
      building_type: data.building_type || undefined,
      total_units: data.total_units ? Number(data.total_units) : 0,
      year_built: data.year_built ? Number(data.year_built) : undefined,
      asset_category: data.asset_category.trim() || undefined,
      description: data.description.trim() || undefined,
    });
    onCreated();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add Property"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            Add Property
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded p-1 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <PropertyForm
          submitLabel="Add Property"
          onCancel={onClose}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
