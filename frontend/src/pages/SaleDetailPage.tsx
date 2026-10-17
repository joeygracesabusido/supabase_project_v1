import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, KeyRound, MapPin, User, X } from "lucide-react";
import { toast } from "sonner";
import { getSale, cancelSale, turnOverSale } from "../api/sales";
import { Badge } from "../components/ui/Badge";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { FinancingSection } from "../components/sales/FinancingSection";
import { PaymentsSection } from "../components/sales/PaymentsSection";
import { formatCurrency, formatDate } from "../lib/utils";

const CANCELLABLE_STATUSES = ["reserved", "equity_paying", "financing_pending", "financing_approved"];

function apiError(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export function SaleDetailPage() {
  const { id } = useParams();
  const saleId = id ?? "";
  const [showCancel, setShowCancel] = useState(false);
  const [showTurnover, setShowTurnover] = useState(false);
  const queryClient = useQueryClient();

  const { data: sale, isLoading } = useQuery({
    queryKey: ["sale", saleId],
    queryFn: () => getSale(saleId),
    enabled: Boolean(saleId),
  });

  const turnoverMutation = useMutation({
    mutationFn: () => turnOverSale(saleId),
    onSuccess: () => {
      toast.success("Unit turned over — sale complete");
      queryClient.invalidateQueries({ queryKey: ["sale", saleId] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      setShowTurnover(false);
    },
    onError: (err: unknown) => toast.error(apiError(err, "Failed to record turnover")),
  });

  if (isLoading || !sale) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg-page)" }}>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Loading sale…
        </p>
      </div>
    );
  }

  const canCancel = CANCELLABLE_STATUSES.includes(sale.status);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-page)" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          to="/sales"
          className="inline-flex items-center gap-1.5 text-sm font-medium mb-4"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft size={14} />
          Back to Sales
        </Link>

        <div
          className="rounded-xl p-5 mb-6"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                  {sale.unit?.unit_number ?? `Unit #${sale.unit_id}`}
                </h1>
                <Badge status={sale.status} />
              </div>
              <p className="text-sm flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                <MapPin size={13} />
                {sale.unit?.properties?.name}
                {sale.unit?.properties?.city ? `, ${sale.unit.properties.city}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              {sale.status === "fully_paid" && (
                <button
                  onClick={() => setShowTurnover(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-white bg-[#003580] hover:bg-[#00224f]"
                >
                  <KeyRound size={14} />
                  Mark Turned Over
                </button>
              )}
              {canCancel && (
                <button
                  onClick={() => setShowCancel(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:text-red-400"
                >
                  <Ban size={14} />
                  Cancel Sale
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs mb-0.5" style={{ color: "var(--text-secondary)" }}>
                Buyer
              </p>
              <p className="flex items-center gap-1.5 font-medium" style={{ color: "var(--text-primary)" }}>
                <User size={13} />
                {sale.buyer?.name}
              </p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: "var(--text-secondary)" }}>
                Total Contract Price
              </p>
              <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                {formatCurrency(sale.total_contract_price)}
              </p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: "var(--text-secondary)" }}>
                Reservation Fee
              </p>
              <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                {formatCurrency(sale.reservation_fee ?? 0)} {sale.reservation_paid ? "(paid)" : "(unpaid)"}
              </p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: "var(--text-secondary)" }}>
                Broker
              </p>
              <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                {sale.broker_name ?? "—"}
              </p>
            </div>
          </div>

          {sale.status === "cancelled" && (
            <div className="mt-4 pt-4 text-sm" style={{ borderTop: "1px solid var(--border-color)" }}>
              <p style={{ color: "var(--text-secondary)" }}>
                Cancelled {formatDate(sale.cancelled_at)} — {sale.cancellation_reason || "no reason given"}.
                RA 6552 refund due: <strong>{formatCurrency(sale.refund_amount ?? 0)}</strong>
              </p>
            </div>
          )}

          {sale.status === "turned_over" && (
            <div className="mt-4 pt-4 text-sm" style={{ borderTop: "1px solid var(--border-color)" }}>
              <p style={{ color: "var(--text-secondary)" }}>
                Unit turned over to the buyer on <strong>{formatDate(sale.turned_over_at)}</strong>. Sale complete.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <FinancingSection saleId={saleId} />
          <PaymentsSection saleId={saleId} hasFinancing={!!sale.financing_application} />
        </div>
      </div>

      {showCancel && <CancelSaleModal saleId={saleId} onClose={() => setShowCancel(false)} />}

      <ConfirmDialog
        open={showTurnover}
        title="Mark this unit turned over?"
        message="This closes out the sale as complete — the buyer takes possession and title transfer proceeds outside the system."
        confirmLabel={turnoverMutation.isPending ? "Saving…" : "Mark Turned Over"}
        onConfirm={() => turnoverMutation.mutate()}
        onCancel={() => setShowTurnover(false)}
      />
    </div>
  );
}

function CancelSaleModal({ saleId, onClose }: { saleId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const cancelMutation = useMutation({
    mutationFn: () => cancelSale(saleId, reason || "Not specified"),
    onSuccess: (res) => {
      const refund = res.maceda_refund;
      toast.success(
        refund.eligibleForRefund
          ? `Cancelled — RA 6552 cash surrender value: ${formatCurrency(refund.refundAmount)} (${refund.refundPercent}%)`
          : `Cancelled — under 2 years paid, no refund entitlement (${refund.shortTermGraceDays}-day grace period applied instead)`,
      );
      queryClient.invalidateQueries({ queryKey: ["sale", saleId] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      onClose();
    },
    onError: (err: unknown) => toast.error(apiError(err, "Failed to cancel sale")),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        className="rounded-xl w-full max-w-md"
        style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-lg)", border: "1px solid var(--border-color)" }}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border-color)" }}>
          <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
            Cancel this sale?
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            cancelMutation.mutate();
          }}
          className="px-6 py-5 space-y-4"
        >
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            This computes the RA 6552 (Maceda Law) cash surrender value the buyer is entitled to
            based on payments made toward the contract price, and cannot be undone.
          </p>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Reason
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Buyer default, mutual withdrawal, etc."
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003580]/30"
              style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2" style={{ borderTop: "1px solid var(--border-color)" }}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg"
              style={{ color: "var(--text-secondary)", background: "var(--bg-muted)" }}
            >
              Keep Sale
            </button>
            <button
              type="submit"
              disabled={cancelMutation.isPending}
              className="px-4 py-2 text-sm font-semibold rounded-lg text-white bg-[#cc0000] hover:bg-[#b30000] disabled:opacity-50"
            >
              {cancelMutation.isPending ? "Cancelling…" : "Cancel Sale"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
