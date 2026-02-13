/**
 * Dashboard Layout Loading State
 */

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Skeleton */}
      <header className="bg-teal-600 h-16 animate-pulse" />
      
      {/* Content Skeleton */}
      <div className="p-4 max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-8 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    </div>
  )
}
