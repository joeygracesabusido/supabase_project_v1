import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote, Plus, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  getItemFinancingRequests,
  createItemFinancingRequest,
  ITEM_FINANCING_TYPES,
  ITEM_FINANCING_TYPE_LABELS,
  type ItemFinancingRequest,
  type ItemFinancingType,
} from "../api/itemFinancing";
import { getFinancingCategories } from "../api/financingCategories";
import { getTenants } from "../api/tenants";
import { getUnits } from "../api/units";
import { PageHeader } from "../components/ui/PageHeader";
import { Badge } from "../components/ui/Badge";
import { formatCurrency, formatDate } from "../lib/utils";

function apiError(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

const STATUS_TABS = [
  { value: "", label: "All Requests" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "completed", label: "Completed" },
  { value: "disapproved", label: "Disapproved" },
  { value: "cancelled", label: "Cancelled" },
];

const labelClass = "block text-xs font-semibold mb-1.5";
const inputClass =
  "w-full px-3 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#003580]/30 focus:border-[#003580]";
const inputStyle = {
  background: "var(--bg-input)",
  color: "var(--text-primary)",
  border: "1px solid var(--border-color)",
};

export function ItemFinancingPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreate, setShowCreate] = useState(searchParams.get("new") === "1");
  const navigate = useNavigate();

  const prefillTicketId = searchParams.get("ticket_id");
  const prefillUnitId = searchParams.get("unit_id");

  const { data: requests, isLoading, isError, refetch } = useQuery({
    queryKey: ["item-financing", statusFilter],
    queryFn: () => getItemFinancingRequests(statusFilter ? { status: statusFilter } : undefined),
  });

  function closeCreate() {
    setShowCreate(false);
    if (searchParams.get("new")) {
      searchParams.delete("new");
      searchParams.delete("ticket_id");
      searchParams.delete("unit_id");
      setSearchParams(searchParams);
    }
  }

  const list = requests?.data || [];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-page)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Item Financing"
          subtitle="Loans for repairs/maintenance, appliances, and anything else marked eligible"
          action={
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg text-white transition-colors bg-[#003580] hover:bg-[#00224f]"
            >
              <Plus size={16} />
              New Request
            </button>
          }
        />

        <div
          className="mb-6 p-1 rounded-lg inline-flex gap-1 overflow-x-auto"
          style={{ backgroundColor: "var(--bg-muted)" }}
        >
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className="px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap"
              style={{
                backgroundColor: statusFilter === tab.value ? "var(--bg-card)" : "transparent",
                color: statusFilter === tab.value ? "var(--text-primary)" : "var(--text-secondary)",
                boxShadow: statusFilter === tab.value ? "var(--shadow-sm)" : "none",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="text-center py-16 text-sm" style={{ color: "var(--text-secondary)" }}>
            Loading requests…
          </div>
        )}

        {isError && (
          <div className="text-center py-16">
            <AlertCircle className="mx-auto mb-2 text-red-500" size={28} />
            <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
              Failed to load requests.
            </p>
            <button onClick={() => refetch()} className="text-sm font-medium text-[#003580]">
              Try again
            </button>
          </div>
        )}

        {!isLoading && !isError && list.length === 0 && (
          <div className="text-center py-16">
            <Banknote className="mx-auto mb-2" size={28} style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              No financing requests yet.
            </p>
          </div>
        )}

        {list.length > 0 && (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--border-color)", background: "var(--bg-card)" }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                  {["Category", "Item", "Requester", "Total Cost", "Financing", "Status", "Created"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((req: ItemFinancingRequest) => (
                  <tr
                    key={req.id}
                    onClick={() => navigate(`/item-financing/${req.id}`)}
                    className="cursor-pointer transition-colors hover:bg-[var(--bg-muted)]"
                    style={{ borderBottom: "1px solid var(--border-color)" }}
                  >
                    <td className="px-5 py-3.5" style={{ color: "var(--text-primary)" }}>
                      {req.category?.name}
                    </td>
                    <td className="px-5 py-3.5 max-w-xs truncate" style={{ color: "var(--text-secondary)" }}>
                      {req.item_description}
                    </td>
                    <td className="px-5 py-3.5" style={{ color: "var(--text-primary)" }}>
                      {req.requester?.name}
                    </td>
                    <td className="px-5 py-3.5" style={{ color: "var(--text-primary)" }}>
                      {formatCurrency(req.total_cost)}
                    </td>
                    <td className="px-5 py-3.5" style={{ color: "var(--text-secondary)" }}>
                      {ITEM_FINANCING_TYPE_LABELS[req.financing_type]}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge status={req.status} />
                    </td>
                    <td className="px-5 py-3.5" style={{ color: "var(--text-secondary)" }}>
                      {formatDate(req.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateItemFinancingModal
          onClose={closeCreate}
          prefillTicketId={prefillTicketId ?? undefined}
          prefillUnitId={prefillUnitId ?? undefined}
        />
      )}
    </div>
  );
}

function CreateItemFinancingModal({
  onClose,
  prefillTicketId,
  prefillUnitId,
}: {
  onClose: () => void;
  prefillTicketId?: string;
  prefillUnitId?: string;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    category_id: "",
    requester_id: "",
    unit_id: prefillUnitId ?? "",
    item_description: "",
    vendor_name: "",
    total_cost: "",
    financing_type: "in_house_financing" as ItemFinancingType,
    loan_amount: "",
    down_payment_amount: "",
    interest_rate_annual: "0",
    loan_term_months: "",
  });

  const { data: categories } = useQuery({
    queryKey: ["financing-categories"],
    queryFn: getFinancingCategories,
  });
  const { data: tenantsData } = useQuery({
    queryKey: ["tenants", "for-item-financing"],
    queryFn: () => getTenants({ limit: "200" }),
  });
  const { data: unitsData } = useQuery({
    queryKey: ["units", "for-item-financing"],
    queryFn: () => getUnits({ limit: "200" }),
  });

  const activeCategories = (categories || []).filter((c) => c.active);
  const tenants = tenantsData?.data || [];
  const units = unitsData?.data || [];

  const createMutation = useMutation({
    mutationFn: () =>
      createItemFinancingRequest({
        category_id: form.category_id,
        requester_id: form.requester_id,
        unit_id: form.unit_id || undefined,
        maintenance_ticket_id: prefillTicketId,
        item_description: form.item_description.trim(),
        vendor_name: form.vendor_name || undefined,
        total_cost: Number(form.total_cost),
        financing_type: form.financing_type,
        loan_amount: form.loan_amount ? Number(form.loan_amount) : undefined,
        down_payment_amount: form.down_payment_amount ? Number(form.down_payment_amount) : undefined,
        interest_rate_annual: form.interest_rate_annual ? Number(form.interest_rate_annual) : 0,
        loan_term_months: form.loan_term_months ? Number(form.loan_term_months) : undefined,
      }),
    onSuccess: (res) => {
      toast.success("Financing request created");
      queryClient.invalidateQueries({ queryKey: ["item-financing"] });
      onClose();
      navigate(`/item-financing/${res.data.id}`);
    },
    onError: (err: unknown) => toast.error(apiError(err, "Failed to create request")),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        className="rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-lg)", border: "1px solid var(--border-color)" }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--border-color)" }}
        >
          <div>
            <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              New Financing Request
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {prefillTicketId
                ? `Linked to maintenance ticket #${prefillTicketId}`
                : "A repair, appliance, or anything else marked eligible"}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.category_id || !form.requester_id || !form.item_description || !form.total_cost) {
              toast.error("Category, requester, description, and total cost are required");
              return;
            }
            createMutation.mutate();
          }}
          className="px-6 py-5 space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
                Category *
              </label>
              <select
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">Select…</option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
                Requester (Tenant) *
              </label>
              <select
                value={form.requester_id}
                onChange={(e) => setForm({ ...form, requester_id: e.target.value })}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">Select…</option>
                {tenants.map((t: { id: string; name: string }) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
              Unit
            </label>
            <select
              value={form.unit_id}
              onChange={(e) => setForm({ ...form, unit_id: e.target.value })}
              className={inputClass}
              style={inputStyle}
            >
              <option value="">Not tied to a specific unit…</option>
              {units.map((u: { id: string; unit_number: string }) => (
                <option key={u.id} value={u.id}>
                  {u.unit_number}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
              Item / Job Description *
            </label>
            <textarea
              value={form.item_description}
              onChange={(e) => setForm({ ...form, item_description: e.target.value })}
              rows={2}
              className={inputClass}
              style={inputStyle}
              placeholder="e.g. Replacement 1.5HP split-type aircon"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
                Vendor
              </label>
              <input
                value={form.vendor_name}
                onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
                Total Cost *
              </label>
              <input
                type="number"
                value={form.total_cost}
                onChange={(e) => setForm({ ...form, total_cost: e.target.value })}
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>

          <div className="pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              Financing Terms (loan amount/term can be finalized later, before approval)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
                  Route
                </label>
                <select
                  value={form.financing_type}
                  onChange={(e) => setForm({ ...form, financing_type: e.target.value as ItemFinancingType })}
                  className={inputClass}
                  style={inputStyle}
                >
                  {ITEM_FINANCING_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ITEM_FINANCING_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
                  Interest (Annual %)
                </label>
                <input
                  type="number"
                  value={form.interest_rate_annual}
                  onChange={(e) => setForm({ ...form, interest_rate_annual: e.target.value })}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
                  Loan Amount
                </label>
                <input
                  type="number"
                  value={form.loan_amount}
                  onChange={(e) => setForm({ ...form, loan_amount: e.target.value })}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
                  Down Payment
                </label>
                <input
                  type="number"
                  value={form.down_payment_amount}
                  onChange={(e) => setForm({ ...form, down_payment_amount: e.target.value })}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              <div className="col-span-2">
                <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
                  Term (months)
                </label>
                <input
                  type="number"
                  value={form.loan_term_months}
                  onChange={(e) => setForm({ ...form, loan_term_months: e.target.value })}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium rounded-lg"
              style={{ color: "var(--text-secondary)", background: "var(--bg-muted)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-5 py-2.5 text-sm font-semibold rounded-lg text-white disabled:opacity-50"
              style={{ background: "#003580" }}
            >
              {createMutation.isPending ? "Creating…" : "Create Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
