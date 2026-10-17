import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import {
  getFinancing,
  createFinancing,
  updateFinancing,
  updateFinancingStatus,
  getAmortizationSchedule,
  FINANCING_TYPE_LABELS,
  FINANCING_STATUS_TRANSITIONS,
  type FinancingType,
  type CreateFinancingInput,
  type FinancingApplication,
} from "../../api/sales";
import { formatCurrency, formatDate } from "../../lib/utils";
import { Badge } from "../ui/Badge";
import { FinancingFieldsFieldset } from "./FinancingFieldsFieldset";

function apiError(err: unknown, fallback: string) {
  const e = err as { response?: { data?: { error?: string; details?: string[] } } };
  const details = e?.response?.data?.details;
  if (details?.length) return details.join("; ");
  return e?.response?.data?.error || fallback;
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

export function FinancingSection({ saleId }: { saleId: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data } = useQuery({
    queryKey: ["financing", saleId],
    queryFn: () => getFinancing(saleId),
  });

  const application = data?.data ?? null;
  const advisory = data?.advisory;

  const { data: schedule } = useQuery({
    queryKey: ["schedule", saleId],
    queryFn: () => getAmortizationSchedule(saleId),
    enabled: !!application,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["financing", saleId] });
    queryClient.invalidateQueries({ queryKey: ["schedule", saleId] });
    queryClient.invalidateQueries({ queryKey: ["sale", saleId] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateFinancingStatus(saleId, status),
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

  if (!application && !editing) {
    return (
      <div
        className="rounded-xl p-5"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Banknote size={18} style={{ color: "var(--text-secondary)" }} />
          <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
            Financing
          </h3>
        </div>
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          No financing route chosen yet — pick spot cash, deferred (0%) cash, in-house, bank, or
          Pag-IBIG financing.
        </p>
        <button
          onClick={() => setEditing(true)}
          className="px-4 py-2 text-sm font-semibold rounded-lg text-white"
          style={{ background: "#003580" }}
        >
          Set Up Financing
        </button>
      </div>
    );
  }

  if (editing || (application && ["draft", "disapproved"].includes(application.status))) {
    return (
      <FinancingForm
        saleId={saleId}
        existing={application}
        onDone={() => {
          setEditing(false);
          invalidateAll();
        }}
        onCancelEdit={application ? () => setEditing(false) : undefined}
      />
    );
  }

  const app = application as FinancingApplication;
  const allowedNext = FINANCING_STATUS_TRANSITIONS[app.status] ?? [];

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Banknote size={18} style={{ color: "var(--text-secondary)" }} />
          <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
            Financing — {FINANCING_TYPE_LABELS[app.financing_type as FinancingType]}
          </h3>
        </div>
        <Badge status={app.status} />
      </div>

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

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
        <Field label="Lender" value={app.lender_name ?? "—"} />
        <Field label="Loan Amount" value={formatCurrency(app.loan_amount ?? 0)} />
        <Field label="Down Payment" value={formatCurrency(app.down_payment_amount ?? 0)} />
        <Field label="Interest (Annual)" value={`${app.interest_rate_annual ?? 0}%`} />
        <Field label="Term" value={`${app.loan_term_months ?? 0} months`} />
        <Field label="Loan Takeout" value={formatDate(app.loan_takeout_date)} />
      </dl>

      {app.status === "disapproved" && app.disapproval_reason && (
        <p className="text-xs mb-4 text-red-700 dark:text-red-400">
          Disapproved: {app.disapproval_reason}
        </p>
      )}

      {allowedNext.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
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

      {schedule && schedule.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-secondary)" }}>
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

function FinancingForm({
  saleId,
  existing,
  onDone,
  onCancelEdit,
}: {
  saleId: string;
  existing: FinancingApplication | null;
  onDone: () => void;
  onCancelEdit?: () => void;
}) {
  const [form, setForm] = useState<CreateFinancingInput>({
    financing_type: existing?.financing_type ?? "bank_financing",
    lender_name: existing?.lender_name ?? "",
    loan_amount: existing?.loan_amount ? Number(existing.loan_amount) : undefined,
    down_payment_amount: existing?.down_payment_amount ? Number(existing.down_payment_amount) : undefined,
    interest_rate_annual: existing?.interest_rate_annual ? Number(existing.interest_rate_annual) : 0,
    loan_term_months: existing?.loan_term_months ?? undefined,
    repricing_period_years: existing?.repricing_period_years ?? undefined,
  });

  const createMutation = useMutation({
    mutationFn: () => createFinancing(saleId, form),
    onSuccess: () => {
      toast.success("Financing route saved");
      onDone();
    },
    onError: (err: unknown) => toast.error(apiError(err, "Failed to save financing terms")),
  });

  const updateMutation = useMutation({
    mutationFn: () => updateFinancing(saleId, form),
    onSuccess: () => {
      toast.success("Financing terms updated");
      onDone();
    },
    onError: (err: unknown) => toast.error(apiError(err, "Failed to update financing terms")),
  });

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Banknote size={18} style={{ color: "var(--text-secondary)" }} />
        <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
          {existing ? "Edit Financing Terms" : "Set Up Financing"}
        </h3>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          existing ? updateMutation.mutate() : createMutation.mutate();
        }}
        className="grid grid-cols-2 gap-3"
      >
        <FinancingFieldsFieldset value={form} onChange={setForm} lockType={!!existing} />

        <div className="col-span-2 flex justify-end gap-3 pt-2" style={{ borderTop: "1px solid var(--border-color)" }}>
          {onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-4 py-2 text-sm font-medium rounded-lg"
              style={{ color: "var(--text-secondary)", background: "var(--bg-muted)" }}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="px-5 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50"
            style={{ background: "#003580" }}
          >
            {createMutation.isPending || updateMutation.isPending ? "Saving…" : "Save Financing Terms"}
          </button>
        </div>
      </form>
    </div>
  );
}
