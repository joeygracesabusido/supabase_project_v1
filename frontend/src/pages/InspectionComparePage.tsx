import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Scale } from "lucide-react";

import { compareInspections } from "../api/inspections";
import { formatDate } from "../lib/utils";
import { PageHeader } from "../components/ui/PageHeader";

const conditionStyles: Record<string, string> = {
  good: "bg-green-100 text-green-700",
  fair: "bg-yellow-100 text-yellow-700",
  poor: "bg-orange-100 text-orange-700",
  damaged: "bg-red-100 text-red-700",
};

function ConditionBadge({ condition }: { condition: string | null }) {
  if (!condition) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span
      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
        conditionStyles[condition] || "bg-slate-100 text-slate-600"
      }`}
    >
      {condition}
    </span>
  );
}

export function InspectionComparePage() {
  const { leaseId } = useParams();

  const {
    data: comparison,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["inspection-compare", leaseId],
    queryFn: () => compareInspections(leaseId ?? ""),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-slate-100 p-4 animate-pulse h-16"
          />
        ))}
      </div>
    );
  }

  if (isError || !comparison) {
    const message =
      error instanceof Error
        ? error.message
        : "Both move-in and move-out inspections must be completed before comparison";
    return (
      <div className="p-6 text-center py-16 text-slate-400">
        <AlertCircle size={40} className="mx-auto mb-3 opacity-40" />
        <p className="font-medium text-slate-600">
          {message}
        </p>
        <Link
          to="/inspections"
          className="mt-4 inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft size={14} /> Back to inspections
        </Link>
      </div>
    );
  }

  const rows = comparison.items;
  const areas = [...new Set(rows.map((r) => r.area))];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Move-in vs move-out comparison"
        subtitle="Side-by-side condition report for deposit settlement"
        action={
          <Link
            to={`/inspections/${comparison.move_out.id}`}
            className="inline-flex items-center gap-2 border border-slate-300 hover:border-blue-500 text-slate-700 hover:text-blue-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <ArrowLeft size={16} /> Back to inspection
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
            comparison.changed_count > 0
              ? "bg-red-100 text-red-700"
              : "bg-green-100 text-green-700"
          }`}
        >
          <Scale size={12} />
          {comparison.changed_count > 0
            ? `${comparison.changed_count} item${comparison.changed_count === 1 ? "" : "s"} changed condition`
            : "No condition changes"}
        </span>
        {comparison.move_in.completed_at && (
          <span className="text-xs text-slate-500">
            Move-in completed{" "}
            {formatDate(comparison.move_in.completed_at)}
          </span>
        )}
        {comparison.move_out.completed_at && (
          <span className="text-xs text-slate-500">
            · Move-out completed{" "}
            {formatDate(comparison.move_out.completed_at)}
          </span>
        )}
      </div>

      <div className="space-y-4">
        {areas.map((area) => (
          <div
            key={area}
            className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"
          >
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 border-b border-slate-100 px-4 py-2">
              {area}
            </h2>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-2 w-1/4">
                    Item
                  </th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-2 w-1/4">
                    Move-in
                  </th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-2 w-1/4">
                    Move-out
                  </th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-2">
                    Move-out notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows
                  .filter((r) => r.area === area)
                  .map((row) => (
                    <tr
                      key={`${row.area}-${row.item}`}
                      className={row.changed ? "bg-red-50" : undefined}
                    >
                      <td className="px-4 py-2.5 text-sm text-slate-700">
                        {row.item}
                        {row.changed && (
                          <span className="ml-2 text-[10px] font-semibold text-red-600 uppercase">
                            changed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <ConditionBadge
                          condition={row.move_in?.condition ?? null}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <ConditionBadge
                          condition={row.move_out?.condition ?? null}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        {row.move_out?.notes || "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
