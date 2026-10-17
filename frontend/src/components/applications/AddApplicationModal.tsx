import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { createApplication } from "../../api/applications";
import { getListings, type Listing } from "../../api/listings";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

interface ApplicationFormData {
  listing_id: string;
  applicant_name: string;
  email: string;
  phone: string;
  current_address: string;
  employment_status: string;
  employer: string;
  monthly_income: string;
  occupants: string;
  desired_move_in: string;
  message: string;
}

const inputCls =
  "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelCls = "block text-sm font-medium text-slate-700 mb-1";

function listingLabel(l: Listing): string {
  const parts = [l.title];
  if (l.unit?.unit_number) parts.push(`Unit ${l.unit.unit_number}`);
  if (l.unit?.properties?.name) parts.push(l.unit.properties.name);
  return `${parts.join(" · ")} (${l.status})`;
}

export function AddApplicationModal({ onClose, onCreated }: Props) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: listingsData } = useQuery({
    queryKey: ["listings-all"],
    queryFn: () => getListings({ page: "1", limit: "100" }),
    retry: 1,
  });
  const listings: Listing[] = listingsData?.data || [];

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ApplicationFormData>({
    defaultValues: {
      listing_id: "",
      applicant_name: "",
      email: "",
      phone: "",
      current_address: "",
      employment_status: "",
      employer: "",
      monthly_income: "",
      occupants: "1",
      desired_move_in: "",
      message: "",
    },
  });

  async function onSubmit(data: ApplicationFormData) {
    if (!data.listing_id) return;
    if (!data.applicant_name.trim() || !data.email.trim()) return;
    setError("");
    setSaving(true);
    try {
      await createApplication({
        listing_id: data.listing_id,
        applicant_name: data.applicant_name.trim(),
        email: data.email.trim(),
        phone: data.phone.trim() || undefined,
        current_address: data.current_address.trim() || undefined,
        employment_status: data.employment_status || undefined,
        employer: data.employer.trim() || undefined,
        monthly_income: data.monthly_income
          ? Number(data.monthly_income)
          : undefined,
        occupants: data.occupants ? Number(data.occupants) : undefined,
        desired_move_in: data.desired_move_in || undefined,
        message: data.message.trim() || undefined,
      });
      onCreated();
      onClose();
    } catch (err: unknown) {
      let message = "Failed to record application.";
      if (err instanceof Error) message = err.message;
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
      aria-label="Add Application"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            Add Application
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
            <label className={labelCls}>Listing *</label>
            <select
              {...register("listing_id", { required: true })}
              className={inputCls}
            >
              <option value="">Select listing</option>
              {listings.map((l) => (
                <option key={l.id} value={String(l.id)}>
                  {listingLabel(l)}
                </option>
              ))}
            </select>
            {errors.listing_id && (
              <p className="text-red-500 text-xs mt-1">Listing is required</p>
            )}
          </div>

          <div>
            <label className={labelCls}>Applicant Name *</label>
            <input
              {...register("applicant_name", { required: true })}
              className={inputCls}
              placeholder="e.g. Maria Santos"
            />
            {errors.applicant_name && (
              <p className="text-red-500 text-xs mt-1">Name is required</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Email *</label>
              <input
                {...register("email", { required: true })}
                type="email"
                className={inputCls}
                placeholder="maria@example.com"
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">Email is required</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input
                {...register("phone")}
                className={inputCls}
                placeholder="0917 123 4567"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Current Address</label>
            <input
              {...register("current_address")}
              className={inputCls}
              placeholder="Where the applicant lives now"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Employment</label>
              <select {...register("employment_status")} className={inputCls}>
                <option value="">Select status</option>
                <option value="employed">Employed</option>
                <option value="self-employed">Self-Employed</option>
                <option value="unemployed">Unemployed</option>
                <option value="retired">Retired</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Employer</label>
              <input
                {...register("employer")}
                className={inputCls}
                placeholder="Company name"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Income (₱)</label>
              <input
                {...register("monthly_income")}
                type="number"
                min="0"
                className={inputCls}
                placeholder="25000"
              />
            </div>
            <div>
              <label className={labelCls}>Occupants</label>
              <input
                {...register("occupants")}
                type="number"
                min="1"
                className={inputCls}
                placeholder="1"
              />
            </div>
            <div>
              <label className={labelCls}>Move-in</label>
              <input
                {...register("desired_move_in")}
                type="date"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Message</label>
            <textarea
              {...register("message")}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="Anything the applicant wants you to know…"
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
              {saving ? "Saving…" : "Add Application"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
