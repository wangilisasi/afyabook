/**
 * Loading State for Quick Book Page
 */

export default function QuickBookLoading() {
  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto animate-pulse">
      {/* Progress Indicator Skeleton */}
      <div className="flex items-center justify-between mb-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center">
            <div className="w-10 h-10 bg-gray-200 rounded-full" />
            {i < 4 && <div className="w-8 h-0.5 bg-gray-200 mx-2" />}
          </div>
        ))}
      </div>

      {/* Form Skeleton */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="w-48 h-6 bg-gray-200 rounded mb-4" />
        <div className="h-14 bg-gray-200 rounded-xl mb-4" />
        <div className="h-12 bg-gray-200 rounded-xl" />
      </div>
    </div>
  )
}
