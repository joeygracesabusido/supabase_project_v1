import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getItemFinancingPaymentsList,
  type ItemFinancingPaymentRow,
} from "../api/itemFinancing";
import { formatCurrency, formatDate } from "../lib/utils";
import { Badge } from "../components/ui/Badge";

const PAYMENT_TYPES = ["down_payment", "installment", "penalty", "refund"];

export function ItemFinancingPaymentsPage() {
  const navigate = useNavigate();
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string | undefined>();
  const [dateFrom, setDateFrom] = useState<string | undefined>();
  const [dateTo, setDateTo] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [payments, setPayments] = useState<ItemFinancingPaymentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getItemFinancingPaymentsList({
        payment_type: paymentTypeFilter,
        start_date: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        end_date: dateTo ? new Date(dateTo).toISOString() : undefined,
      });
      setPayments(res.data || []);
      setTotal(res.total || 0);
      setTotalAmount(res.total_amount ?? 0);
    } catch (err: unknown) {
      let message = "Failed to load payments";
      if (typeof err === "object" && err !== null && "response" in err) {
        const response = (err as { response?: { data?: { error?: unknown } } }).response;
        if (typeof response?.data?.error === "string") message = response.data.error;
      }
      toast.error(message);
      setPayments([]);
      setTotal(0);
      setTotalAmount(0);
    } finally {
      setIsLoading(false);
    }
  }, [paymentTypeFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-page)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">
            Item Financing Payments
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            All loan payments for repairs, appliances, and other financed items
          </p>
        </div>

        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-[var(--shadow-sm)] p-4 mb-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Payment Type
              </label>
              <select
                value={paymentTypeFilter || ""}
                onChange={(e) => setPaymentTypeFilter(e.target.value || undefined)}
                className="w-full px-3 py-2 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#003580]"
              >
                <option value="">All Types</option>
                {PAYMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                From
              </label>
              <input
                type="date"
                value={dateFrom || ""}
                onChange={(e) => setDateFrom(e.target.value || undefined)}
                className="w-full px-3 py-2 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#003580]"
                placeholder="Start date"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                To
              </label>
              <input
                type="date"
                value={dateTo || ""}
                onChange={(e) => setDateTo(e.target.value || undefined)}
                className="w-full px-3 py-2 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#003580]"
                placeholder="End date"
              />
            </div>

            <div>
              <button
                onClick={() => {
                  setPaymentTypeFilter(undefined);
                  setDateFrom(undefined);
                  setDateTo(undefined);
                  fetchPayments();
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors bg-[#003580] hover:bg-[#00224f]"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-[var(--text-primary)]" />
            <span className="ml-3 text-sm text-[var(--text-muted)]">Loading payments…</span>
          </div>
        )}

        {payments.length === 0 && !isLoading && (
          <div className="py-12 text-center">
            <AlertCircle className="mx-auto mb-4 size-24 text-[var(--text-muted)]" />
            <p className="text-[var(--text-muted)]">
              No payment transactions found. <br />
              Use the filtration above or record a new payment from a financing request.
            </p>
          </div>
        )}

        {payments.length > 0 && !isLoading && (
          <div className="overflow-x-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)]">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                  {["Date", "Type", "Item", "Requester", "Amount", "Reference", "Actions"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="border-b transition-colors hover:bg-[var(--bg-muted)]"
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm text-[var(--text-primary)]">
                        {formatDate(payment.payment_date)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <Badge status={payment.payment_type} />
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-[var(--text-primary)]">
                        {payment.request?.category?.name || "—"}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {payment.request?.item_description || ""}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-[var(--text-primary)]">
                        {payment.request?.requester?.name || "N/A"}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-lg font-bold text-[var(--text-primary)]">
                        {formatCurrency(payment.amount)}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {payment.payment_method.replace(/_/g, " ")}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-[var(--text-secondary)]">
                        {payment.reference || payment.or_number || "—"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {payment.item_financing_request_id && (
                        <button
                          onClick={() =>
                            navigate(`/item-financing/${payment.item_financing_request_id}`)
                          }
                          className="text-[var(--text-primary)] text-sm underline hover:text-[#003580]"
                        >
                          View Request
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && !isLoading && (
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6 mt-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-[var(--text-muted)]">Total Transactions</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{total}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Total Amount</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {formatCurrency(totalAmount)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
