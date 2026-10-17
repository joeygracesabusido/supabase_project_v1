import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Handshake, Plus, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  getSales,
  createSale,
  createFinancing,
  type UnitSale,
  type CreateFinancingInput,
} from "../api/sales";
import { getUnits } from "../api/units";
import { PageHeader } from "../components/ui/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Pagination } from "../components/ui/Pagination";
import { FinancingFieldsFieldset } from "../components/sales/FinancingFieldsFieldset";
import { FinancingPreviewPanel } from "../components/sales/FinancingPreviewPanel";
import { formatCurrency, formatDate } from "../lib/utils";

function apiError(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

const STATUS_TABS = [
  { value: "", label: "All Sales" },
  { value: "reserved", label: "Reserved" },
  { value: "equity_paying", label: "Equity Paying" },
  { value: "financing_pending", label: "Financing Pending" },
  { value: "financing_approved", label: "Financing Approved" },
  { value: "fully_paid", label: "Fully Paid" },
  { value: "turned_over", label: "Turned Over" },
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

export function SalesPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();
  const limit = 20;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["sales", statusFilter, page],
    queryFn: () =>
      getSales({
        page: String(page),
        limit: String(limit),
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
    retry: 1,
  });

  const sales: UnitSale[] = data?.data || [];
  const pagination = data?.pagination || { page, total: 0, total_pages: 0 };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-page)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Sales & Financing"
          subtitle={`${pagination.total || 0} unit sale${pagination.total === 1 ? "" : "s"} — reservation, financing, and amortization`}
          action={
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg text-white transition-colors bg-[#003580] hover:bg-[#00224f]"
            >
              <Plus size={16} />
              New Sale
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
              onClick={() => {
                setStatusFilter(tab.value);
                setPage(1);
              }}
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
            Loading sales…
          </div>
        )}

        {isError && (
          <div className="text-center py-16">
            <AlertCircle className="mx-auto mb-2 text-red-500" size={28} />
            <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
              Failed to load sales.
            </p>
            <button onClick={() => refetch()} className="text-sm font-medium text-[#003580]">
              Try again
            </button>
          </div>
        )}

        {!isLoading && !isError && sales.length === 0 && (
          <div className="text-center py-16">
            <Handshake className="mx-auto mb-2" size={28} style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              No sales yet — reserve a unit to get started.
            </p>
          </div>
        )}

        {sales.length > 0 && (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--border-color)", background: "var(--bg-card)" }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                  {["Unit", "Buyer", "Contract Price", "Financing", "Status", "Reserved"].map((h) => (
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
                {sales.map((sale) => (
                  <tr
                    key={sale.id}
                    onClick={() => navigate(`/sales/${sale.id}`)}
                    className="cursor-pointer transition-colors hover:bg-[var(--bg-muted)]"
                    style={{ borderBottom: "1px solid var(--border-color)" }}
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                        {sale.unit?.unit_number ?? `Unit #${sale.unit_id}`}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {sale.unit?.properties?.name}
                      </div>
                    </td>
                    <td className="px-5 py-3.5" style={{ color: "var(--text-primary)" }}>
                      {sale.buyer?.name}
                    </td>
                    <td className="px-5 py-3.5" style={{ color: "var(--text-primary)" }}>
                      {formatCurrency(sale.total_contract_price)}
                    </td>
                    <td className="px-5 py-3.5" style={{ color: "var(--text-secondary)" }}>
                      {sale.financing_application?.financing_type.replace(/_/g, " ") ?? "Not set"}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge status={sale.status} />
                    </td>
                    <td className="px-5 py-3.5" style={{ color: "var(--text-secondary)" }}>
                      {formatDate(sale.reservation_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 pb-4">
              <Pagination
                page={page}
                totalPages={pagination.total_pages}
                total={pagination.total}
                onPageChange={setPage}
              />
            </div>
          </div>
        )}
      </div>

      {showCreate && <CreateSaleModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateSaleModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    unit_id: "",
    buyer_name: "",
    buyer_email: "",
    buyer_phone: "",
    buyer_monthly_income: "",
    total_contract_price: "",
    reservation_fee: "",
    broker_name: "",
  });
  const [chooseFinancingNow, setChooseFinancingNow] = useState(true);
  const [financing, setFinancing] = useState<CreateFinancingInput>({
    financing_type: "bank_financing",
    interest_rate_annual: 6,
  });

  const { data: unitsData } = useQuery({
    queryKey: ["units", "vacant-for-sale"],
    queryFn: () => getUnits({ status: "vacant", limit: "100" }),
  });
  const units = unitsData?.data || [];

  const financingReady = chooseFinancingNow && !!financing.loan_amount && !!financing.loan_term_months;

  const createMutation = useMutation({
    mutationFn: async () => {
      const sale = await createSale({
        unit_id: form.unit_id,
        buyer: {
          name: form.buyer_name,
          email: form.buyer_email || undefined,
          phone: form.buyer_phone || undefined,
          monthly_income: form.buyer_monthly_income ? Number(form.buyer_monthly_income) : undefined,
        },
        total_contract_price: Number(form.total_contract_price),
        reservation_fee: form.reservation_fee ? Number(form.reservation_fee) : undefined,
        broker_name: form.broker_name || undefined,
      });

      if (financingReady) {
        try {
          await createFinancing(sale.id, financing);
        } catch (err) {
          toast.error(
            apiError(err, "Sale reserved, but financing terms couldn't be saved — add them from the sale page"),
          );
        }
      }

      return sale;
    },
    onSuccess: (sale) => {
      toast.success(`Unit reserved for ${sale.buyer?.name}`);
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      onClose();
      navigate(`/sales/${sale.id}`);
    },
    onError: (err: unknown) => toast.error(apiError(err, "Failed to create sale")),
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
              Reserve a Unit for Sale
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Start the buyer's acquisition and, if known, their financing route
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.unit_id || !form.buyer_name || !form.total_contract_price) {
              toast.error("Unit, buyer name, and total contract price are required");
              return;
            }
            createMutation.mutate();
          }}
          className="px-6 py-5 space-y-4"
        >
          <div>
            <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
              Unit *
            </label>
            <select
              value={form.unit_id}
              onChange={(e) => setForm({ ...form, unit_id: e.target.value })}
              className={inputClass}
              style={inputStyle}
            >
              <option value="">Select a vacant unit…</option>
              {units.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.property_name ? `${u.property_name} · ` : ""}
                  {u.unit_number}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
                Buyer Name *
              </label>
              <input
                value={form.buyer_name}
                onChange={(e) => setForm({ ...form, buyer_name: e.target.value })}
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
                Buyer Email
              </label>
              <input
                type="email"
                value={form.buyer_email}
                onChange={(e) => setForm({ ...form, buyer_email: e.target.value })}
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
                Buyer Phone
              </label>
              <input
                value={form.buyer_phone}
                onChange={(e) => setForm({ ...form, buyer_phone: e.target.value })}
                placeholder="09171234567"
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
                Buyer Monthly Income
              </label>
              <input
                type="number"
                value={form.buyer_monthly_income}
                onChange={(e) => setForm({ ...form, buyer_monthly_income: e.target.value })}
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
                Total Contract Price *
              </label>
              <input
                type="number"
                value={form.total_contract_price}
                onChange={(e) => setForm({ ...form, total_contract_price: e.target.value })}
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
                Reservation Fee
              </label>
              <input
                type="number"
                value={form.reservation_fee}
                onChange={(e) => setForm({ ...form, reservation_fee: e.target.value })}
                placeholder="20,000 – 50,000 typical"
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>

          <div className="pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
            <label className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              <input
                type="checkbox"
                checked={chooseFinancingNow}
                onChange={(e) => setChooseFinancingNow(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              Choose a financing route now
            </label>

            {chooseFinancingNow && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <FinancingFieldsFieldset value={financing} onChange={setFinancing} />
                </div>
                <FinancingPreviewPanel
                  input={{
                    ...financing,
                    total_contract_price: form.total_contract_price ? Number(form.total_contract_price) : undefined,
                    buyer_monthly_income: form.buyer_monthly_income ? Number(form.buyer_monthly_income) : null,
                  }}
                />
                {!financingReady && (
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Loan amount and term are required to attach financing now — leave them blank to
                    decide later from the sale page.
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
              Broker / Agent
            </label>
            <input
              value={form.broker_name}
              onChange={(e) => setForm({ ...form, broker_name: e.target.value })}
              className={inputClass}
              style={inputStyle}
            />
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
              {createMutation.isPending ? "Reserving…" : "Reserve Unit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
