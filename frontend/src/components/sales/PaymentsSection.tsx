import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Receipt, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  getSalePayments,
  recordSalePayment,
  getAmortizationSchedule,
  PAYMENT_TYPES,
  type PaymentType,
} from "../../api/sales";
import { formatCurrency, formatDate } from "../../lib/utils";
import { Badge } from "../ui/Badge";

const labelClass = "block text-xs font-semibold mb-1.5";
const inputClass =
  "w-full px-3 py-2 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#003580]/30 focus:border-[#003580]";
const inputStyle = {
  background: "var(--bg-input)",
  color: "var(--text-primary)",
  border: "1px solid var(--border-color)",
};

function apiError(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export function PaymentsSection({ saleId, hasFinancing }: { saleId: string; hasFinancing: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["sale-payments", saleId],
    queryFn: () => getSalePayments(saleId),
  });

  const { data: schedule } = useQuery({
    queryKey: ["schedule", saleId],
    queryFn: () => getAmortizationSchedule(saleId),
    enabled: hasFinancing,
  });

  const pendingInstallments = (schedule || []).filter((i) => i.status !== "paid");

  const [form, setForm] = useState({
    payment_type: "reservation" as PaymentType,
    amount: "",
    payment_method: "bank_transfer",
    payment_date: new Date().toISOString().slice(0, 10),
    reference: "",
    amortization_schedule_id: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      recordSalePayment(saleId, {
        payment_type: form.payment_type,
        amount: Number(form.amount),
        payment_method: form.payment_method,
        payment_date: form.payment_date,
        reference: form.reference || undefined,
        amortization_schedule_id: form.amortization_schedule_id || undefined,
      }),
    onSuccess: () => {
      toast.success("Payment recorded");
      queryClient.invalidateQueries({ queryKey: ["sale-payments", saleId] });
      queryClient.invalidateQueries({ queryKey: ["schedule", saleId] });
      queryClient.invalidateQueries({ queryKey: ["sale", saleId] });
      setShowForm(false);
      setForm((f) => ({ ...f, amount: "", reference: "", amortization_schedule_id: "" }));
    },
    onError: (err: unknown) => toast.error(apiError(err, "Failed to record payment")),
  });

  const payments = data?.data || [];
  const totals = data?.totals || {};

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Receipt size={18} style={{ color: "var(--text-secondary)" }} />
          <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
            Payments
          </h3>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 text-sm font-medium text-[#003580]"
        >
          <Plus size={14} />
          Record Payment
        </button>
      </div>

      {Object.keys(totals).length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          {Object.entries(totals).map(([type, sum]) => (
            <div
              key={type}
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{ background: "var(--bg-muted)", color: "var(--text-secondary)" }}
            >
              <span className="capitalize">{type}</span>: {formatCurrency(sum)}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.amount || Number(form.amount) <= 0) {
              toast.error("Enter a valid amount");
              return;
            }
            mutation.mutate();
          }}
          className="grid grid-cols-2 gap-3 mb-5 p-4 rounded-lg"
          style={{ background: "var(--bg-muted)" }}
        >
          <div>
            <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
              Type
            </label>
            <select
              value={form.payment_type}
              onChange={(e) => setForm({ ...form, payment_type: e.target.value as PaymentType })}
              className={inputClass}
              style={inputStyle}
            >
              {PAYMENT_TYPES.filter((t) => t !== "refund").map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
              Amount
            </label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
              Method
            </label>
            <select
              value={form.payment_method}
              onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
              className={inputClass}
              style={inputStyle}
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="credit_card">Credit Card</option>
            </select>
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
              Date
            </label>
            <input
              type="date"
              value={form.payment_date}
              onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {form.payment_type === "amortization" && (
            <div className="col-span-2">
              <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
                Installment
              </label>
              <select
                value={form.amortization_schedule_id}
                onChange={(e) => {
                  const installment = pendingInstallments.find((i) => String(i.id) === e.target.value);
                  setForm({
                    ...form,
                    amortization_schedule_id: e.target.value,
                    amount: installment ? String(installment.amount_due) : form.amount,
                  });
                }}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">Not tied to a specific installment…</option>
                {pendingInstallments.map((i) => (
                  <option key={i.id} value={i.id}>
                    #{i.installment_number} · due {formatDate(i.due_date)} ·{" "}
                    {formatCurrency(i.amount_due)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="col-span-2">
            <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
              Reference
            </label>
            <input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="OR / transaction number"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div className="col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50"
              style={{ background: "#003580" }}
            >
              {mutation.isPending ? "Saving…" : "Save Payment"}
            </button>
          </div>
        </form>
      )}

      {payments.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          No payments recorded yet.
        </p>
      ) : (
        <div className="space-y-2">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm py-2" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div>
                <Badge status={p.payment_type} />
                <span className="ml-2" style={{ color: "var(--text-secondary)" }}>
                  {formatDate(p.payment_date)} · {p.payment_method.replace(/_/g, " ")}
                  {p.reference ? ` · ${p.reference}` : ""}
                </span>
              </div>
              <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                {formatCurrency(p.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
