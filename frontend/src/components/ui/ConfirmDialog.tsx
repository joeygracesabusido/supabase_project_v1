import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm bg-[var(--bg-card)] rounded-2xl shadow-[var(--shadow-lg)] border border-[var(--border-color)] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`p-2.5 rounded-xl ${danger ? "bg-red-100 dark:bg-red-950" : "bg-blue-100 dark:bg-blue-950"}`}
          >
            <AlertTriangle
              size={20}
              className={danger ? "text-[#cc0000]" : "text-[#003580]"}
            />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">
              {title}
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              {message}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-muted)] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors ${
              danger
                ? "bg-[#cc0000] hover:bg-[#b30000]"
                : "bg-[#003580] hover:bg-[#003070]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
