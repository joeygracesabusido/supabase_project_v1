import {
  FINANCING_TYPES,
  FINANCING_TYPE_LABELS,
  type FinancingType,
  type CreateFinancingInput,
} from "../../api/sales";

const labelClass = "block text-xs font-semibold mb-1.5";
const inputClass =
  "w-full px-3 py-2 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#003580]/30 focus:border-[#003580]";
const inputStyle = {
  background: "var(--bg-input)",
  color: "var(--text-primary)",
  border: "1px solid var(--border-color)",
};

interface FinancingFieldsFieldsetProps {
  value: CreateFinancingInput;
  onChange: (next: CreateFinancingInput) => void;
  /** Lock the financing route once a real application already exists. */
  lockType?: boolean;
}

/**
 * The financing-route select plus its conditional terms fields (lender, loan
 * amount, down payment, interest, term, Pag-IBIG repricing period). Shared
 * between the standalone "Set Up Financing" form and the New Sale modal's
 * inline financing section so both stay in sync with one implementation.
 */
export function FinancingFieldsFieldset({
  value,
  onChange,
  lockType,
}: FinancingFieldsFieldsetProps) {
  const isDeferredOrSpot = value.financing_type === "deferred_cash" || value.financing_type === "spot_cash";

  return (
    <>
      <div className="col-span-2">
        <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
          Financing Route
        </label>
        <select
          value={value.financing_type}
          onChange={(e) =>
            onChange({
              ...value,
              financing_type: e.target.value as FinancingType,
              interest_rate_annual:
                e.target.value === "deferred_cash" || e.target.value === "spot_cash"
                  ? 0
                  : value.interest_rate_annual,
              loan_term_months: e.target.value === "spot_cash" ? 1 : value.loan_term_months,
            })
          }
          className={inputClass}
          style={inputStyle}
          disabled={lockType}
        >
          {FINANCING_TYPES.map((t) => (
            <option key={t} value={t}>
              {FINANCING_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {value.financing_type !== "spot_cash" && value.financing_type !== "deferred_cash" && (
        <div className="col-span-2">
          <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
            Lender
          </label>
          <input
            value={value.lender_name ?? ""}
            onChange={(e) => onChange({ ...value, lender_name: e.target.value })}
            placeholder={value.financing_type === "pagibig_financing" ? "Pag-IBIG Fund" : "e.g. BDO, BPI"}
            className={inputClass}
            style={inputStyle}
          />
        </div>
      )}

      <div>
        <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
          Loan / Financed Amount
        </label>
        <input
          type="number"
          value={value.loan_amount ?? ""}
          onChange={(e) => onChange({ ...value, loan_amount: e.target.value ? Number(e.target.value) : undefined })}
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
          value={value.down_payment_amount ?? ""}
          onChange={(e) =>
            onChange({ ...value, down_payment_amount: e.target.value ? Number(e.target.value) : undefined })
          }
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div>
        <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
          Interest Rate (Annual %)
        </label>
        <input
          type="number"
          step="0.01"
          value={value.interest_rate_annual ?? 0}
          onChange={(e) => onChange({ ...value, interest_rate_annual: Number(e.target.value) })}
          className={inputClass}
          style={inputStyle}
          disabled={isDeferredOrSpot}
        />
      </div>
      <div>
        <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
          Term (months)
        </label>
        <input
          type="number"
          value={value.loan_term_months ?? ""}
          onChange={(e) =>
            onChange({ ...value, loan_term_months: e.target.value ? Number(e.target.value) : undefined })
          }
          className={inputClass}
          style={inputStyle}
          disabled={value.financing_type === "spot_cash"}
        />
      </div>

      {value.financing_type === "pagibig_financing" && (
        <div className="col-span-2">
          <label className={labelClass} style={{ color: "var(--text-secondary)" }}>
            Repricing Period (years)
          </label>
          <select
            value={value.repricing_period_years ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                repricing_period_years: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className={inputClass}
            style={inputStyle}
          >
            <option value="">Select…</option>
            {[1, 3, 5, 10, 15, 20, 25, 30].map((y) => (
              <option key={y} value={y}>
                {y} year{y > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
