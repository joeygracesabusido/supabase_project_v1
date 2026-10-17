import { X } from "lucide-react";
import { updateProperty, type Property } from "../../api/properties";
import { PropertyForm, type PropertyFormData } from "./PropertyForm";

interface Props {
  property: Property;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditPropertyModal({ property, onClose, onUpdated }: Props) {
  const defaultValues = {
    name: property.name ?? "",
    address: property.address ?? "",
    city: property.city ?? "",
    state: property.state ?? "",
    building_type: property.building_type ?? "",
    total_units: property.total_units != null ? String(property.total_units) : "0",
    year_built: property.year_built != null ? String(property.year_built) : "",
    asset_category: property.asset_category ?? "",
    description: property.description ?? "",
  };

  async function handleSubmit(data: PropertyFormData) {
    await updateProperty(property.id, {
      name: data.name.trim(),
      address: data.address.trim(),
      city: data.city.trim() || null,
      state: data.state.trim() || null,
      building_type: data.building_type || null,
      total_units: data.total_units ? Number(data.total_units) : 0,
      year_built: data.year_built ? Number(data.year_built) : null,
      asset_category: data.asset_category.trim() || null,
      description: data.description.trim() || null,
    });
    onUpdated();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Edit Property"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            Edit Property
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded p-1 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <PropertyForm
          defaultValues={defaultValues}
          submitLabel="Save Changes"
          onCancel={onClose}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
