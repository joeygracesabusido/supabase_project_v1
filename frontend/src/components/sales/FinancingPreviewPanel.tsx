import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Calculator, Info } from "lucide-react";
import { previewFinancing, type FinancingPreviewInput } from "../../api/sales";
import { formatCurrency, formatDate } from "../../lib/utils";

/** Debounces the raw input so we don't hit the API on every keystroke. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Live-computed amortization preview shown while picking financing terms —
 * calls the same calculator the backend uses to generate the real schedule,
 * so the numbers shown here always match what gets created on submit.
 */
export function FinancingPreviewPanel({ input }: { input: FinancingPreviewInput }) {
  const debounced = useDebounced(input, 400);
  const ready = !!debounced.loan_amount && !!debounced.loan_term_months;

  const { data, isFetching } = useQuery({
    queryKey: ["financing-preview", debounced],
    queryFn: () => previewFinancing(debounced),
    enabled: ready,
  });

  if (!ready) {
    return (
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        Enter a loan amount and term to see the computed monthly payment.
      </p>
    );
  }

  const preview = data?.data;
  const advisory = data?.advisory;

  return (
    <div className="space-y-2">
      {isFetching && !preview && (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Computing…
        </p>
      )}

      {preview && (
        <div
          className="flex items-center gap-4 flex-wrap p-3 rounded-lg"
          style={{ background: "var(--bg-page)", border: "1px solid var(--border-color)" }}
        >
          <div className="flex items-center gap-2">
            <Calculator size={16} style={{ color: "#003580" }} />
            <div>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {preview.term_months === 1 ? "Payment" : "Monthly Payment"}
              </p>
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                {formatCurrency(preview.monthly_payment)}
              </p>
            </div>
          </div>
          <div>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Total Interest
            </p>
            <p className="font-medium" style={{ color: "var(--text-primary)" }}>
              {formatCurrency(preview.total_interest)}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              First Due
            </p>
            <p className="font-medium" style={{ color: "var(--text-primary)" }}>
              {formatDate(preview.first_due_date)}
            </p>
          </div>
        </div>
      )}

      {advisory && (advisory.errors.length > 0 || advisory.warnings.length > 0) && (
        <div className="space-y-1.5">
          {advisory.errors.map((e, i) => (
            <div key={`err-${i}`} className="flex items-start gap-2 text-xs text-red-700 dark:text-red-400">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {e}
            </div>
          ))}
          {advisory.warnings.map((w, i) => (
            <div key={`warn-${i}`} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              <Info size={13} className="mt-0.5 shrink-0" />
              {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
