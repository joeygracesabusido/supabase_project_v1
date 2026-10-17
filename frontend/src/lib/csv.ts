export function downloadCsv<T extends Record<string, any>>(
  data: T[],
  columns: { key: string; label: string }[],
  filename: string,
) {
  const header = columns.map((c) => `"${c.label}"`).join(",");
  const rows = data.map((item) =>
    columns
      .map((c) => {
        const val = item[c.key];
        const str = val == null ? "" : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      })
      .join(","),
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
