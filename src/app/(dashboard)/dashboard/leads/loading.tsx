export default function LeadsLoading() {
  return (
    <div className="flex-1 p-6 space-y-4">
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-16 bg-surface-elevated rounded-full animate-pulse" />
        ))}
      </div>
      <div className="rounded-xl bg-surface border border-border overflow-hidden">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="px-5 py-3.5 border-b border-border flex items-center gap-3 animate-pulse">
            <div className="h-9 w-9 rounded-lg bg-surface-elevated" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-32 bg-surface-elevated rounded" />
              <div className="h-3 w-24 bg-surface-elevated rounded" />
            </div>
            <div className="h-6 w-10 bg-surface-elevated rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
