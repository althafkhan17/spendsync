/**
 * Instant loading skeleton for every dashboard route. Next.js wraps the page
 * in a Suspense boundary with this as the fallback, so navigation shows a
 * placeholder immediately instead of a blank screen while server data loads.
 */
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-8" aria-busy="true" aria-live="polite">
      <div className="space-y-3">
        <div className="h-8 w-64 rounded-md bg-slate-200" />
        <div className="h-4 w-96 max-w-full rounded-md bg-slate-100" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl border border-hairline bg-white p-5 shadow-sm">
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="mt-4 h-7 w-32 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-hairline bg-white shadow-sm">
        <div className="border-b border-hairline px-6 py-4">
          <div className="h-4 w-40 rounded bg-slate-200" />
        </div>
        <div className="space-y-4 p-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-9 w-9 rounded-full bg-slate-200" />
              <div className="h-4 flex-1 rounded bg-slate-100" />
              <div className="h-4 w-20 rounded bg-slate-100" />
              <div className="h-4 w-24 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
