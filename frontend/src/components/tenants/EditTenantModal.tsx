import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import {
  getTenantFull,
  updateTenant,
  type TenantFull,
  type TenantLease,
} from "../../api/tenants";
import { getProperties } from "../../api/properties";
import { getUnit, getUnits, updateUnit } from "../../api/units";
import { createLease, updateLease } from "../../api/leases";

interface Props {
  tenantId: string;
  onClose: () => void;
  onUpdated: () => void;
}

interface EditForm {
  name: string;
  email: string;
  phone: string;
  company_name: string;
  employment_status: string;
  monthly_income: string;
  note: string;
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

const inputCls =
  "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

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

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return String(value).slice(0, 10);
}

function EditTenantForm({
  tenantId,
  tenant,
  onClose,
  onUpdated,
}: Props & { tenant: TenantFull }) {
  const activeLease: TenantLease | undefined = tenant.leases?.find(
    (l) => l.status === "active",
  );

  const [form, setForm] = useState<EditForm>({
    name: tenant.name ?? "",
    email: tenant.email ?? "",
    phone: tenant.phone ?? "",
    company_name: tenant.company_name ?? "",
    employment_status: tenant.employment_status ?? "",
    monthly_income:
      tenant.monthly_income != null ? String(tenant.monthly_income) : "",
    note: tenant.note ?? tenant.notes ?? "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Assignment state
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(plusOneYearISO());
  const [deposit, setDeposit] = useState("");
  const [moveChecked, setMoveChecked] = useState(false);
  const [endChecked, setEndChecked] = useState(false);

  const { data: propsData } = useQuery({
    queryKey: ["properties-all"],
    queryFn: () => getProperties({ page: "1", limit: "100" }),
    retry: 1,
  });
  const properties: PropertyOption[] = propsData?.data || [];

  // Current unit → owning property (to preselect when moving within same building)
  const { data: currentUnit } = useQuery({
    queryKey: ["unit", activeLease?.unit_id],
    queryFn: () => getUnit(activeLease?.unit_id ?? ""),
    enabled: !!activeLease,
    retry: 1,
  });
  const currentPropertyId = currentUnit
    ? String(currentUnit.property_id)
    : "";

  const effectivePropertyId = propertyId || (moveChecked ? currentPropertyId : "");

  const { data: unitsData } = useQuery({
    queryKey: ["units-for-property", effectivePropertyId],
    queryFn: () =>
      getUnits({ property_id: effectivePropertyId, limit: "100" }),
    enabled: !!effectivePropertyId,
    retry: 1,
  });
  const units: UnitOption[] = unitsData?.data || [];
  const vacantCount = units.filter(
    (u) => (u.status || "vacant") === "vacant",
  ).length;

  function set<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handlePropertyChange(value: string) {
    setPropertyId(value);
    setUnitId("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const wantsMove = !!activeLease && moveChecked && !endChecked;
    const wantsEnd = !!activeLease && endChecked && !moveChecked;
    const wantsAssign = !activeLease && !!unitId;
    if ((wantsMove || wantsAssign) && !unitId) {
      setError("Select a unit, or clear the assignment.");
      return;
    }
    if (
      (wantsMove || wantsAssign) &&
      startDate &&
      endDate &&
      endDate <= startDate
    ) {
      setError("Lease end date must be after the start date.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await updateTenant(tenantId, {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        company_name: form.company_name.trim() || null,
        employment_status: form.employment_status || null,
        monthly_income: form.monthly_income ? Number(form.monthly_income) : null,
        note: form.note.trim() || null,
      });

      if (wantsMove || wantsEnd) {
        // Close out the current lease and free the unit (preserves history)
        try {
          await updateLease(activeLease?.id ?? tenantId, { status: "terminated" });
          await updateUnit(activeLease?.unit_id ?? "", { status: "vacant" });
        } catch (leaseErr: unknown) {
          toast.warning(
            `Tenant saved, but ending the current lease failed: ${apiError(leaseErr, "could not end lease")}`,
          );
          onUpdated();
          onClose();
          return;
        }
      }

      if (wantsMove || wantsAssign) {
        const unit = units.find((u) => String(u.id) === unitId);
        try {
          await createLease({
            tenant_id: tenantId,
            unit_id: unitId,
            start_date: startDate || undefined,
            end_date: endDate || undefined,
            deposit_amount: deposit ? Number(deposit) : undefined,
            status: "active",
          });
          toast.success(
            `Tenant updated and assigned to ${unit?.unit_number ?? "unit"}`,
          );
        } catch (leaseErr: unknown) {
          toast.warning(
            `Tenant saved, but unit assignment failed: ${apiError(leaseErr, "could not create lease")}`,
          );
        }
      } else if (wantsEnd) {
        toast.success("Tenant updated and lease ended — unit is vacant again");
      } else {
        toast.success("Tenant updated");
      }
      onUpdated();
      onClose();
    } catch (err: unknown) {
      setError(apiError(err, "Failed to update tenant."));
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

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Full Name *
        </label>
        <input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          className={inputCls}
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
            className={inputCls}
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
            className={inputCls}
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
            className={inputCls}
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
            className={inputCls}
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
          className={inputCls}
          placeholder="e.g. 25000"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Notes
        </label>
        <textarea
          value={form.note}
          onChange={(e) => set("note", e.target.value)}
          rows={3}
          className={`${inputCls} resize-none`}
          placeholder="Internal notes about this tenant…"
        />
      </div>

      <div className="border-t pt-4">
        <p className="text-sm font-semibold text-slate-800 mb-1">
          Unit Assignment
        </p>
        {activeLease ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-slate-700 mb-3">
            Currently in{" "}
            <span className="font-semibold">
              {activeLease.property_name ?? "—"} · Unit{" "}
              {activeLease.unit_number ?? "—"}
            </span>{" "}
            ({formatDate(activeLease.start_date)} →{" "}
            {formatDate(activeLease.end_date)})
          </div>
        ) : (
          <p className="text-xs text-slate-500 mb-3">
            No active lease — assigning a unit below creates one.
          </p>
        )}

        {activeLease && (
          <div className="space-y-2 mb-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={moveChecked}
                onChange={(e) => {
                  setMoveChecked(e.target.checked);
                  if (e.target.checked) setEndChecked(false);
                }}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Move to a different unit
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={endChecked}
                onChange={(e) => {
                  setEndChecked(e.target.checked);
                  if (e.target.checked) setMoveChecked(false);
                }}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              End current lease (move out — unit becomes vacant)
            </label>
          </div>
        )}

        {(!activeLease || moveChecked) && !endChecked && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Property
                </label>
                <select
                  value={propertyId || currentPropertyId}
                  onChange={(e) => handlePropertyChange(e.target.value)}
                  className={inputCls}
                >
                  <option value="">
                    {activeLease ? "Keep current property" : "No assignment"}
                  </option>
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
                  disabled={!effectivePropertyId}
                  className={`${inputCls} disabled:bg-slate-100 disabled:text-slate-400`}
                >
                  <option value="">
                    {effectivePropertyId
                      ? "Select unit"
                      : "Pick a property first"}
                  </option>
                  {units.map((u) => {
                    const vacant = (u.status || "vacant") === "vacant";
                    return (
                      <option
                        key={u.id}
                        value={String(u.id)}
                        disabled={!vacant}
                      >
                        {u.unit_number} · {u.status || "vacant"}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {effectivePropertyId !== "" &&
              units.length > 0 &&
              vacantCount === 0 && (
                <p className="text-xs text-amber-600 mt-2">
                  No vacant units in this property — all units are shown
                  disabled.
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
                      className={inputCls}
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
                      className={inputCls}
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
                    className={inputCls}
                    placeholder="Optional"
                  />
                </div>
              </>
            )}
          </>
        )}
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
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

export function EditTenantModal({ tenantId, onClose, onUpdated }: Props) {
  const {
    data: tenant,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: () => getTenantFull(tenantId),
    retry: 1,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Edit Tenant"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-slate-800">
            Edit Tenant
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
            Loading tenant…
          </div>
        ) : isError || !tenant ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-red-600 mb-4">
              Failed to load tenant.
            </p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <EditTenantForm
            key={tenant.id}
            tenantId={tenant.id}
            tenant={tenant}
            onClose={onClose}
            onUpdated={onUpdated}
          />
        )}
      </div>
    </div>
  );
}
