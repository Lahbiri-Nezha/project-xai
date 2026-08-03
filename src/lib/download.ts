export function triggerDownload(opts: {
  url: string | null;
  csv: string | null;
  fileName: string;
}) {
  if (opts.url) {
    const a = document.createElement("a");
    a.href = opts.url;
    a.rel = "noopener";
    a.download = opts.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  if (opts.csv == null) return;

  const blob = new Blob([opts.csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
