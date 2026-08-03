export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="w-64 bg-surface border-r border-border animate-pulse">
        <div className="h-16 border-b border-border px-5 py-4">
          <div className="h-6 w-32 bg-surface-elevated rounded" />
        </div>
        <div className="p-4 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 bg-surface-elevated rounded-lg" />
          ))}
        </div>
      </div>
      <div className="flex-1">
        <div className="h-16 border-b border-border px-6 py-4">
          <div className="h-6 w-32 bg-surface-elevated rounded" />
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-surface rounded-xl border border-border animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-surface rounded-xl border border-border animate-pulse" />
        </div>
      </div>
    </div>
  );
}
