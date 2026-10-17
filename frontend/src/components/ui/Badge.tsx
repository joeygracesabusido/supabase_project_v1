import { statusColor } from "../../lib/utils";

interface BadgeProps {
  status: string;
  label?: string;
}

export function Badge({ status, label }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColor(status)}`}
    >
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}
