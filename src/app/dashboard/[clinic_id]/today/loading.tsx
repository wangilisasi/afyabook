/**
 * Loading State for Today Dashboard
 */

export default function TodayLoading() {
  return (
    <div className="p-4 pb-24 animate-pulse">
      {/* Date Navigation Skeleton */}
      <div className="flex items-center justify-between mb-4 bg-white rounded-xl shadow-sm p-3">
        <div className="w-10 h-10 bg-gray-200 rounded-lg" />
        <div className="space-y-2">
          <div className="w-32 h-6 bg-gray-200 rounded" />
          <div className="w-20 h-4 bg-gray-200 rounded mx-auto" />
        </div>
        <div className="w-10 h-10 bg-gray-200 rounded-lg" />
      </div>

      {/* Stats Skeleton */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-gray-200 rounded-lg p-2 h-16" />
        ))}
      </div>

      {/* Timeline Skeleton */}
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 h-32" />
        ))}
      </div>
    </div>
  )
}
