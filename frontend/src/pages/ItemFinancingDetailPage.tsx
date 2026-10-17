import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Banknote, AlertTriangle, Info, Receipt, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  getItemFinancingRequest,
  updateItemFinancingRequest,
  updateItemFinancingStatus,
  resetItemFinancingStatus,
  getItemAmortizationSchedule,
  getItemFinancingPayments,
  recordItemFinancingPayment,
  ITEM_FINANCING_TYPES,
  ITEM_FINANCING_TYPE_LABELS,
  ITEM_FINANCING_STATUS_TRANSITIONS,
  ITEM_PAYMENT_TYPES,
  type ItemFinancingType,
  type ItemPaymentType,
  type ItemAmortizationInstallment,
} from "../api/itemFinancing";
import { Badge } from "../components/ui/Badge";
import { formatCurrency, formatDate } from "../lib/utils";

function apiError(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

const STATUS_ACTION_LABELS: Record<string, string> = {
  submitted: "Submit",
  under_review: "Send to Review",
  approved: "Approve (generates schedule)",
  disapproved: "Disapprove",
  cancelled: "Cancel",
  completed: "Mark Completed",
  draft: "Send Back for Revision",
};

const labelClass = "block text-xs font-semibold mb-1.5";
const inputClass =
  "w-full px-3 py-2 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#003580]/30 focus:border-[#003580]";
const inputStyle = {
  background: "var(--bg-input)",
  color: "var(--text-primary)",
  border: "1px solid var(--border-color)",
};

export function ItemFinancingDetailPage() {
  const { id } = useParams();
  const requestId = id ?? "";
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["item-financing-detail", requestId],
    queryFn: () => getItemFinancingRequest(requestId),
    enabled: Boolean(requestId),
  });

  const { data: schedule } = useQuery({
    queryKey: ["item-schedule", requestId],
    queryFn: () => getItemAmortizationSchedule(requestId),
    enabled: !!data?.data && ["approved", "completed"].includes(data.data.status),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["item-financing-detail", requestId] });
    queryClient.invalidateQueries({ queryKey: ["item-schedule", requestId] });
    queryClient.invalidateQueries({ queryKey: ["item-financing"] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateItemFinancingStatus(requestId, status),
    onSuccess: (res) => {
      toast.success(
        res.installments_generated
          ? `Approved — ${res.installments_generated} installments generated`
          : "Status updated",
      );
      invalidateAll();
    },
    onError: (err: unknown) => toast.error(apiError(err, "Failed to update status")),
  });

  const resetMutation = useMutation({
    mutationFn: () => resetItemFinancingStatus(requestId),
    onSuccess: () => {
      toast.success("Request reset to Approved");
      invalidateAll();
    },
    onError: (err: unknown) => toast.error(apiError(err, "Failed to reset status")),
  });

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg-page)" }}>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Loading request…
        </p>
      </div>
    );
  }

  const request = data.data;
  const advisory = data.advisory;
  const allowedNext = ITEM_FINANCING_STATUS_TRANSITIONS[request.status] ?? [];
  const canEdit = ["draft", "disapproved"].includes(request.status);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-page)" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          to="/item-financing"
          className="inline-flex items-center gap-1.5 text-sm font-medium mb-4"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft size={14} />
          Back to Item Financing
        </Link>

        <div
          className="rounded-xl p-5 mb-6"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                  {request.category?.name}
                </h1>
                <Badge status={request.status} />
              </div>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {request.item_description}
              </p>
              {request.unit && (
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  Unit {request.unit.unit_number}
                  {request.maintenance_ticket ? ` · Ticket ${request.maintenance_ticket.ticket_number}` : ""}
                </p>
              )}
            </div>
            {canEdit && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="px-3 py-2 text-xs font-semibold rounded-lg"
                style={{ color: "var(--text-secondary)", background: "var(--bg-muted)" }}
              >
                Edit Terms
              </button>
            )}
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
            <Field label="Requester" value={request.requester?.name ?? "—"} />
            <Field label="Vendor" value={request.vendor_name ?? "—"} />
            <Field label="Total Cost" value={formatCurrency(request.total_cost)} />
            <Field label="Financing Route" value={ITEM_FINANCING_TYPE_LABELS[request.financing_type]} />
            <Field label="Loan Amount" value={formatCurrency(request.loan_amount ?? 0)} />
            <Field label="Down Payment" value={formatCurrency(request.down_payment_amount ?? 0)} />
            <Field label="Interest (Annual)" value={`${request.interest_rate_annual ?? 0}%`} />
            <Field label="Term" value={`${request.loan_term_months ?? 0} months`} />
          </dl>

          {request.status === "disapproved" && request.disapproval_reason && (
            <p className="text-xs mt-3 text-red-700 dark:text-red-400">
              Disapproved: {request.disapproval_reason}
            </p>
          )}
        </div>

        {editing ? (
          <EditTermsForm
            requestId={requestId}
            existing={request}
            onDone={() => {
              setEditing(false);
              invalidateAll();
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div
            className="rounded-xl p-5 mb-6"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
          >
            {advisory && (advisory.errors.length > 0 || advisory.warnings.length > 0) && (
              <div className="mb-4 space-y-2">
                {advisory.errors.map((e, i) => (
                  <div key={`err-${i}`} className="flex items-start gap-2 text-xs text-red-700 dark:text-red-400">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    {e}
                  </div>
                ))}
                {advisory.warnings.map((w, i) => (
                  <div
                    key={`warn-${i}`}
                    className="flex items-start gap-2 text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <Info size={14} className="mt-0.5 shrink-0" />
                    {w}
                  </div>
                ))}
              </div>
            )}

            {allowedNext.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {allowedNext.map((status) => (
                  <button
                    key={status}
                    onClick={() => statusMutation.mutate(status)}
                    disabled={statusMutation.isPending}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-50"
                    style={
                      status === "cancelled" || status === "disapproved"
                        ? { background: "#fee2e2", color: "#b91c1c" }
                        : { background: "#003580", color: "#ffffff" }
                    }
                  >
                    {STATUS_ACTION_LABELS[status] ?? status}
                  </button>
                ))}
              </div>
            )}
            {allowedNext.length === 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  This request is in a final state.
                </p>
                <button
                  onClick={() => {
                    if (confirm("Are you sure you want to reset this request to Approved? This will allow you to record more payments or cancel the request.")) {
                      resetMutation.mutate();
                    }
                  }}
                  disabled={resetMutation.isPending}
                  className="w-fit px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-50"
                  style={{ background: "var(--bg-muted)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                >
                  {resetMutation.isPending ? "Resetting..." : "Reset to Approved (Admin)"}
                </button>
              </div>
            )}
          </div>
        )}

        {schedule && schedule.length > 0 && (
          <div
            className="rounded-xl p-5 mb-6"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
          >
            <h4 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-secondary)" }}>
              Amortization Schedule
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                    {["#", "Due", "Principal", "Interest", "Amount Due", "Balance", "Status"].map((h) => (
                      <th key={h} className="text-left py-1.5 pr-3" style={{ color: "var(--text-secondary)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((row) => (
                    <tr key={row.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td className="py-1.5 pr-3">{row.installment_number}</td>
                      <td className="py-1.5 pr-3">{formatDate(row.due_date)}</td>
                      <td className="py-1.5 pr-3">{formatCurrency(row.principal_amount)}</td>
                      <td className="py-1.5 pr-3">{formatCurrency(row.interest_amount)}</td>
                      <td className="py-1.5 pr-3 font-medium">{formatCurrency(row.amount_due)}</td>
                      <td className="py-1.5 pr-3">{formatCurrency(row.running_balance)}</td>
                      <td className="py-1.5">
                        <Badge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {request.status === "approved" && (
          <PaymentsPanel requestId={requestId} schedule={schedule || []} />
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {label}
      </dt>
      <dd style={{ color: "var(--text-primary)" }}>{value}</dd>
    </div>
  );
}

function EditTermsForm({
  requestId,
  existing,
  onDone,
  onCancel,
}: {
  requestId: string;
  existing: {
    item_description: string;
    vendor_name?: string | null;
    total_cost: string | number;
    financing_type: ItemFinancingType;
    loan_amount?: string | number | null;
    down_payment_amount?: string | number | null;
    interest_rate_annual?: string | number | null;
    loan_term_months?: number | null;
  };
  onDone: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    item_description: existing.item_description,
    vendor_name: existing.vendor_name ?? "",
    total_cost: String(existing.total_cost ?? ""),
    financing_type: existing.financing_type,
    loan_amount: existing.loan_amount ? String(existing.loan_amount) : "",
    down_payment_amount: existing.down_payment_amount ? String(existing.down_payment_amount) : "",
    interest_rate_annual: existing.interest_rate_annual ? String(existing.interest_rate_annual) : "0",
    loan_term_months: existing.loan_term_months ? String(existing.loan_term_months) : "",
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateItemFinancingRequest(requestId, {
        item_description: form.item_description,
        vendor_name: form.vendor_name || undefined,
        total_cost: Number(form.total_cost),
        financing_type: form.financing_type,
        loan_amount: form.loan_amount ? Number(form.loan_amount) : undefined,
        down_payment_amount: form.down_payment_amount ? Number(form.down_payment_amount) : undefined,
        interest_rate_annual: Number(form.interest_rate_annual || 0),
        loan_term_months: form.loan_term_months ? Number(form.loan_term_months) : undefined,
      }),
    onSuccess: () => {
      toast.success("Terms updated");
      onDone();
    },
    onError: (err: unknown) => toast.error(apiError(err, "Failed to update terms")),
  });

  return (
    <div
      className="rounded-xl p-5 mb-6"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Banknote size={18} style={{ color: "var(--text-secondary)" }} />
        <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
          Edit Terms
        </h3>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateMutation.mutate();
        }}
        className="grid grid-cols-2 gap-3"
      >
        <div className="col-span-2">
          <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
            Item / Job Description
          </label>
          <textarea
            value={form.item_description}
            onChange={(e) => setForm({ ...form, item_description: e.target.value })}
            rows={2}
            className={inputClass}
            style={inputStyle}
          />
        </div>
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
            Total Cost
          </label>
          <input
            type="number"
            value={form.total_cost}
            onChange={(e) => setForm({ ...form, total_cost: e.target.value })}
            className={inputClass}
            style={inputStyle}
          />
        </div>
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
        <div>
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

        <div className="col-span-2 flex justify-end gap-3 pt-2" style={{ borderTop: "1px solid var(--border-color)" }}>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg"
            style={{ color: "var(--text-secondary)", background: "var(--bg-muted)" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="px-5 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50"
            style={{ background: "#003580" }}
          >
            {updateMutation.isPending ? "Saving…" : "Save Terms"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PaymentsPanel({
  requestId,
  schedule,
}: {
  requestId: string;
  schedule: ItemAmortizationInstallment[];
}) {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: payments } = useQuery({
    queryKey: ["item-payments", requestId],
    queryFn: () => getItemFinancingPayments(requestId),
  });

  const pendingInstallments = schedule.filter((i) => i.status !== "paid");

  const [form, setForm] = useState({
    payment_type: "installment" as ItemPaymentType,
    amount: "",
    payment_method: "cash",
    payment_date: new Date().toISOString().slice(0, 10),
    reference: "",
    amortization_schedule_id: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      recordItemFinancingPayment(requestId, {
        payment_type: form.payment_type,
        amount: Number(form.amount),
        payment_method: form.payment_method,
        payment_date: form.payment_date,
        reference: form.reference || undefined,
        amortization_schedule_id: form.amortization_schedule_id || undefined,
      }),
    onSuccess: () => {
      toast.success("Payment recorded");
      queryClient.invalidateQueries({ queryKey: ["item-payments", requestId] });
      queryClient.invalidateQueries({ queryKey: ["item-schedule", requestId] });
      queryClient.invalidateQueries({ queryKey: ["item-financing-detail", requestId] });
      setShowForm(false);
      setForm((f) => ({ ...f, amount: "", reference: "", amortization_schedule_id: "" }));
    },
    onError: (err: unknown) => toast.error(apiError(err, "Failed to record payment")),
  });

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
              onChange={(e) => setForm({ ...form, payment_type: e.target.value as ItemPaymentType })}
              className={inputClass}
              style={inputStyle}
            >
              {ITEM_PAYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
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
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
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

          {form.payment_type === "installment" && (
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
                    #{i.installment_number} · due {formatDate(i.due_date)} · {formatCurrency(i.amount_due)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="col-span-2">
            <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
              Reference / OR Number
            </label>
            <input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
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

      {!payments || payments.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          No payments recorded yet.
        </p>
      ) : (
        <div className="space-y-2">
          {payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between text-sm py-2"
              style={{ borderBottom: "1px solid var(--border-color)" }}
            >
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
