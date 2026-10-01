function download(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportJSON(data: unknown, filename: string): void {
  download(filename, JSON.stringify(data, null, 2), "application/json");
}

export function exportMarkdown(content: string, filename: string): void {
  download(filename, content, "text/markdown");
}

/** Exports an array of flat objects as CSV. Columns are taken from the first row's keys. */
export function exportCSV<T extends Record<string, unknown>>(rows: T[], filename: string): void {
  if (rows.length === 0) {
    download(filename, "", "text/csv");
    return;
  }
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];
  download(filename, lines.join("\n"), "text/csv");
}
