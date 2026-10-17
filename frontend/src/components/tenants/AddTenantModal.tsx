import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { createTenant } from "../../api/tenants";
import { getProperties } from "../../api/properties";
import { getUnits } from "../../api/units";
import { createLease } from "../../api/leases";

interface FormData {
  name: string;
  email: string;
  phone: string;
  company_name: string;
  employment_status: string;
  monthly_income: string;
}

interface PropertyOption {
  id: string;
  name: string;
}

interface UnitOption {
  id: string;
  unit_number: string;
  status?: string;
  rental_price?: number | string | null;
}

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

function apiError(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const response = (err as { response?: { data?: { error?: unknown } } })
      .response;
    if (typeof response?.data?.error === "string") return response.data.error;
  }
  return fallback;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusOneYearISO(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function formatRent(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isNaN(n) ? "—" : `₱${n.toLocaleString()}`;
}

export function AddTenantModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    company_name: "",
    employment_status: "",
    monthly_income: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendInvite, setSendInvite] = useState(false);

  // Optional unit assignment (creates a lease: tenant → unit → property)
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(plusOneYearISO());
  const [deposit, setDeposit] = useState("");

  const { data: propsData } = useQuery({
    queryKey: ["properties-all"],
    queryFn: () => getProperties({ page: "1", limit: "100" }),
    retry: 1,
  });
  const properties: PropertyOption[] = propsData?.data || [];

  const { data: unitsData } = useQuery({
    queryKey: ["units-for-property", propertyId],
    queryFn: () => getUnits({ property_id: propertyId, limit: "100" }),
    enabled: !!propertyId,
    retry: 1,
  });
  const units: UnitOption[] = unitsData?.data || [];
  const vacantCount = units.filter(
    (u) => (u.status || "vacant") === "vacant",
  ).length;

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handlePropertyChange(value: string) {
    setPropertyId(value);
    setUnitId("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (propertyId && !unitId) {
      setError("Select a unit for the chosen property, or clear the property.");
      return;
    }
    if (unitId && startDate && endDate && endDate <= startDate) {
      setError("Lease end date must be after the start date.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const tenant = await createTenant({
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        company_name: form.company_name || undefined,
        employment_status: form.employment_status || undefined,
        monthly_income: form.monthly_income
          ? Number(form.monthly_income)
          : undefined,
        sendInvite,
      });

      if (unitId) {
        const unit = units.find((u) => String(u.id) === unitId);
        try {
          await createLease({
            tenant_id: tenant.id,
            unit_id: unitId,
            start_date: startDate || undefined,
            end_date: endDate || undefined,
            deposit_amount: deposit ? Number(deposit) : undefined,
            status: "active",
          });
          toast.success(
            `Tenant created and assigned to ${unit?.unit_number ?? "unit"}`,
          );
        } catch (leaseErr: unknown) {
          toast.warning(
            `Tenant created, but unit assignment failed: ${apiError(leaseErr, "could not create lease")}`,
          );
        }
      } else {
        toast.success("Tenant created");
      }
      onCreated();
      onClose();
    } catch (err: unknown) {
      const message = apiError(err, "Failed to create tenant.");
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-slate-800">Add Tenant</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded p-1 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Full Name *
            </label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Juan Dela Cruz"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                type="email"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="juan@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Phone
              </label>
              <input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0917 123 4567"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Company
              </label>
              <input
                value={form.company_name}
                onChange={(e) => set("company_name", e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Company name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Employment
              </label>
              <select
                value={form.employment_status}
                onChange={(e) => set("employment_status", e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select status</option>
                <option value="employed">Employed</option>
                <option value="self-employed">Self-Employed</option>
                <option value="unemployed">Unemployed</option>
                <option value="retired">Retired</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Monthly Income (₱)
            </label>
            <input
              value={form.monthly_income}
              onChange={(e) => set("monthly_income", e.target.value)}
              type="number"
              min="0"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 25000"
            />
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-semibold text-slate-800 mb-1">
              Unit Assignment{" "}
              <span className="font-normal text-slate-500">
                (optional — creates an active lease)
              </span>
            </p>
            <p className="text-xs text-slate-500 mb-3">
              Only vacant units can be assigned. The unit will be marked
              occupied.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Property
                </label>
                <select
                  value={propertyId}
                  onChange={(e) => handlePropertyChange(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No assignment</option>
                  {properties.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Unit
                </label>
                <select
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  disabled={!propertyId}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">
                    {propertyId ? "Select unit" : "Pick a property first"}
                  </option>
                  {units.map((u) => {
                    const vacant = (u.status || "vacant") === "vacant";
                    return (
                      <option key={u.id} value={String(u.id)} disabled={!vacant}>
                        {u.unit_number} · {u.status || "vacant"} ·{" "}
                        {formatRent(u.rental_price)}/mo
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {propertyId !== "" && units.length > 0 && vacantCount === 0 && (
              <p className="text-xs text-amber-600 mt-2">
                No vacant units in this property — all units are shown disabled.
              </p>
            )}

            {unitId && (
              <>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Lease Start
                    </label>
                    <input
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      type="date"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Lease End
                    </label>
                    <input
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      type="date"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Deposit (₱)
                  </label>
                  <input
                    value={deposit}
                    onChange={(e) => setDeposit(e.target.value)}
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="sendInvite"
              checked={sendInvite}
              onChange={(e) => setSendInvite(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="sendInvite" className="text-sm text-slate-700">
              Send invite email to tenant
            </label>
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
              disabled={saving || !form.name.trim()}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
            >
              {saving ? "Saving…" : "Add Tenant"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
