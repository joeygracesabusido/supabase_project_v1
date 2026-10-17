import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Lock,
  Plus,
  Scale,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  getInspection,
  getInspections,
  updateInspection,
  addInspectionItem,
  updateInspectionItem,
  deleteInspectionItem,
  type InspectionItem,
} from "../api/inspections";
import { PageHeader } from "../components/ui/PageHeader";
import { formatDate } from "../lib/utils";

const CONDITIONS = ["good", "fair", "poor", "damaged"] as const;

const conditionActive: Record<string, string> = {
  good: "bg-green-600 text-white border-green-600",
  fair: "bg-yellow-500 text-white border-yellow-500",
  poor: "bg-orange-500 text-white border-orange-500",
  damaged: "bg-red-600 text-white border-red-600",
};

const inputClass =
  "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

function apiError(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function ItemRow({
  inspectionId,
  item,
  readOnly,
}: {
  inspectionId: string;
  item: InspectionItem;
  readOnly: boolean;
}) {
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["inspection", inspectionId] });

  const updateMutation = useMutation({
    mutationFn: (body: { condition?: string; notes?: string }) =>
      updateInspectionItem(inspectionId, item.id, body),
    onSuccess: invalidate,
    onError: (err) => toast.error(apiError(err, "Failed to update item")),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteInspectionItem(inspectionId, item.id),
    onSuccess: () => {
      toast.success("Item removed");
      invalidate();
    },
    onError: (err) => toast.error(apiError(err, "Failed to remove item")),
  });

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="text-sm text-slate-700 w-44 shrink-0">{item.item}</span>

      <div className="flex gap-1">
        {CONDITIONS.map((c) => (
          <button
            key={c}
            type="button"
            disabled={readOnly || updateMutation.isPending}
            onClick={() => updateMutation.mutate({ condition: c })}
            className={`px-2.5 py-1 rounded-md border text-xs font-medium capitalize transition-colors ${
              item.condition === c
                ? conditionActive[c]
                : "bg-white border-slate-200 text-slate-500 hover:border-slate-400"
            } ${readOnly ? "cursor-default opacity-70" : ""}`}
          >
            {c}
          </button>
        ))}
      </div>

      <input
        defaultValue={item.notes ?? ""}
        readOnly={readOnly}
        placeholder="Notes…"
        onBlur={(e) => {
          if (!readOnly && e.target.value !== (item.notes ?? "")) {
            updateMutation.mutate({ notes: e.target.value });
          }
        }}
        className="flex-1 min-w-40 px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-slate-50"
      />

      {!readOnly && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => deleteMutation.mutate()}
            title="Remove item"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export function InspectionDetailPage() {
  const { id } = useParams();
  const inspectionId = id ?? "";
  const queryClient = useQueryClient();

  const [newArea, setNewArea] = useState("");
  const [newItem, setNewItem] = useState("");

  const {
    data: inspection,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["inspection", inspectionId],
    queryFn: () => getInspection(inspectionId),
    retry: 1,
  });

  // Sibling inspections on the same lease — enables the Compare link once
  // both move-in and move-out are completed.
  const { data: siblings } = useQuery({
    queryKey: ["inspections", inspection?.lease_id],
    queryFn: () => getInspections(inspection!.lease_id),
    enabled: Boolean(inspection?.lease_id),
  });
  const bothCompleted =
    (siblings?.filter((s) => s.status === "completed").length ?? 0) >= 2;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["inspection", inspectionId] });

  const updateMutation = useMutation({
    mutationFn: (body: Parameters<typeof updateInspection>[1]) =>
      updateInspection(inspectionId, body),
    onSuccess: (_, body) => {
      toast.success(
        body.status === "completed"
          ? "Inspection completed and locked"
          : "Inspection updated",
      );
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["inspections"] });
    },
    onError: (err) => toast.error(apiError(err, "Failed to update inspection")),
  });

  const addItemMutation = useMutation({
    mutationFn: () =>
      addInspectionItem(inspectionId, { area: newArea, item: newItem }),
    onSuccess: () => {
      toast.success("Checklist item added");
      setNewArea("");
      setNewItem("");
      invalidate();
    },
    onError: (err) => toast.error(apiError(err, "Failed to add item")),
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

  if (isError || !inspection) {
    return (
      <div className="p-6 text-center py-16 text-slate-400">
        <AlertCircle size={40} className="mx-auto mb-3 opacity-40" />
        <p className="font-medium text-red-500">Inspection not found</p>
        <Link
          to="/inspections"
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Back to inspections
        </Link>
      </div>
    );
  }

  const readOnly = inspection.status === "completed";
  const items = inspection.inspection_items;
  const areas = [...new Set(items.map((i) => i.area))];
  const recorded = items.filter((i) => i.condition).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title={`${inspection.type === "move_in" ? "Move-in" : "Move-out"} inspection`}
        subtitle={`${inspection.leases?.units.properties.name} · ${inspection.leases?.units.unit_number} — ${inspection.leases?.tenants.name}`}
        action={
          <div className="flex items-center gap-2">
            {bothCompleted && (
              <Link
                to={`/inspections/compare/${inspection.lease_id}`}
                className="inline-flex items-center gap-2 border border-slate-300 hover:border-blue-500 text-slate-700 hover:text-blue-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <Scale size={16} /> Compare move-in vs move-out
              </Link>
            )}
            {!readOnly && (
              <button
                onClick={() => {
                  if (
                    confirm(
                      "Complete this inspection? It becomes read-only afterwards.",
                    )
                  ) {
                    updateMutation.mutate({ status: "completed" });
                  }
                }}
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <CheckCircle2 size={16} /> Complete inspection
              </button>
            )}
          </div>
        }
      />

      <div className="flex items-center gap-3 mb-6 text-sm">
        {readOnly ? (
          <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
            <Lock size={12} /> Completed{" "}
            {inspection.completed_at &&
              formatDate(inspection.completed_at)}
          </span>
        ) : (
          <span className="text-slate-500 text-xs">
            {recorded}/{items.length} items recorded
            {inspection.scheduled_date &&
              ` · scheduled ${formatDate(inspection.scheduled_date)}`}
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
            <div className="divide-y divide-slate-50">
              {items
                .filter((i) => i.area === area)
                .map((item) => (
                  <ItemRow
                    key={item.id}
                    inspectionId={inspectionId}
                    item={item}
                    readOnly={readOnly}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>

      {!readOnly && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newArea.trim() || !newItem.trim()) {
              toast.error("Area and item name are both required");
              return;
            }
            addItemMutation.mutate();
          }}
          className="mt-4 bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-wrap items-end gap-3"
        >
          <div className="w-44">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Area
            </label>
            <input
              value={newArea}
              onChange={(e) => setNewArea(e.target.value)}
              placeholder="e.g. Balcony"
              className={inputClass}
            />
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Item
            </label>
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="e.g. Railing"
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={addItemMutation.isPending}
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} /> Add item
          </button>
        </form>
      )}

      <div className="mt-4 bg-white rounded-xl border border-slate-100 shadow-sm p-4">
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Overall notes
        </label>
        <textarea
          defaultValue={inspection.overall_notes ?? ""}
          readOnly={readOnly}
          rows={3}
          placeholder="General observations about the unit…"
          onBlur={(e) => {
            if (
              !readOnly &&
              e.target.value !== (inspection.overall_notes ?? "")
            ) {
              updateMutation.mutate({ overall_notes: e.target.value });
            }
          }}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-slate-50"
        />
      </div>
    </div>
  );
}
