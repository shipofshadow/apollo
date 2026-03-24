/** A single pulsing skeleton "card" placeholder used while content loads. */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-brand-dark border border-gray-800 rounded-sm overflow-hidden animate-pulse ${className}`}>
      <div className="aspect-square bg-gray-800/60" />
      <div className="p-6 space-y-3">
        <div className="h-4 bg-gray-700 rounded w-3/4" />
        <div className="h-3 bg-gray-800 rounded w-1/2" />
        <div className="h-5 bg-gray-700 rounded w-1/3 mt-4" />
      </div>
    </div>
  );
}

/** A single pulsing skeleton "blog card" placeholder. */
export function SkeletonBlogCard() {
  return (
    <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden animate-pulse flex flex-col">
      <div className="h-48 bg-gray-800/60" />
      <div className="p-6 space-y-3 flex-grow">
        <div className="h-3 bg-gray-700 rounded w-1/3" />
        <div className="h-5 bg-gray-700 rounded w-5/6" />
        <div className="h-3 bg-gray-800 rounded w-full" />
        <div className="h-3 bg-gray-800 rounded w-4/5" />
        <div className="h-3 bg-gray-800 rounded w-2/3" />
      </div>
    </div>
  );
}

/** A pulsing skeleton row for table-style list items (e.g. bookings). */
export function SkeletonRow() {
  return (
    <div className="bg-brand-dark border border-gray-800 rounded-sm p-4 md:p-5 animate-pulse flex items-center gap-4">
      <div className="shrink-0 w-1 h-10 bg-gray-700 rounded-full" />
      <div className="shrink-0 w-10 h-10 bg-gray-800 rounded-sm" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-gray-700 rounded w-1/3" />
        <div className="h-3 bg-gray-800 rounded w-1/2" />
      </div>
      <div className="shrink-0 w-20 h-6 bg-gray-800 rounded-sm" />
    </div>
  );
}
