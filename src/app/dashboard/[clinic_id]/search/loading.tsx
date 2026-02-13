/**
 * Loading State for Search Page
 */

export default function SearchLoading() {
  return (
    <div className="p-4 pb-24 max-w-4xl mx-auto animate-pulse">
      {/* Search Form Skeleton */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="w-48 h-6 bg-gray-200 rounded mb-4" />
        <div className="flex gap-2">
          <div className="flex-1 h-12 bg-gray-200 rounded-lg" />
          <div className="w-24 h-12 bg-gray-200 rounded-lg" />
        </div>
      </div>

      {/* Results Skeleton */}
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 h-40" />
        ))}
      </div>
    </div>
  )
}
