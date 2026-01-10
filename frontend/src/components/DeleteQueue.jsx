import SourceBadge from './SourceBadge'

function DeleteQueue({ queue, onRemove, onExport, loading, onError = null }) {
  // Group items by supplier
  const groupedBySource = queue.reduce((acc, item) => {
    const supplier = item.supplier_name || item.supplier || "Unknown"
    if (!acc[supplier]) {
      acc[supplier] = []
    }
    acc[supplier].push(item)
    return acc
  }, {})

  const amazonItems = groupedBySource.Amazon || []
  const walmartItems = groupedBySource.Walmart || []
  const unknownItems = groupedBySource.Unknown || []

  const handleSourceExport = async (source, mode = 'autods') => {
    // Filter queue items by supplier
    const sourceItems = queue.filter(item => (item.supplier_name || item.supplier || "Unknown") === source)
    
    if (sourceItems.length === 0) {
      if (onError) {
        onError(`No ${source} items in queue to export.`, null)
      }
      return
    }

    // Call export with filtered items
    await onExport(mode, sourceItems)
  }

  const renderSourceSection = (source, items) => {
    if (items.length === 0) return null

    return (
      <div className="rounded-lg border border-gray-300 bg-white p-3 mb-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            {source} ({items.length})
          </h4>
        </div>

        {/* Items List */}
        <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded p-2 border border-gray-200 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start gap-2">
                {/* Tiny Image */}
                <div className="flex-shrink-0">
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-10 h-10 object-cover rounded border border-gray-200"
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect width="40" height="40" fill="%23e5e7eb"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="8"%3ENo Image%3C/text%3E%3C/svg%3E'
                    }}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex-1 min-w-0">
                      <h5 className="text-xs font-semibold text-gray-900 truncate mb-0.5">
                        {item.title}
                      </h5>
                      <div className="text-xs text-gray-500 font-mono truncate">
                        {item.sku}
                      </div>
                    </div>

                    {/* Remove Button (X) */}
                    <button
                      onClick={() => onRemove(item.id)}
                      className="flex-shrink-0 p-0.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      title="Remove from queue"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Export Button */}
        <button
          onClick={() => handleSourceExport(source, 'autods')}
          className="w-full px-3 py-2 bg-black text-white text-xs font-semibold rounded-md hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-colors flex items-center justify-center gap-2"
        >
          <span>Download {source} CSV</span>
          <span className="px-1.5 py-0.5 bg-gray-800 rounded text-xs font-bold">
            {items.length}
          </span>
        </button>
      </div>
    )
  }

  if (queue.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-300 p-4 h-full flex flex-col">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Ready to Delete
          </h3>
          <p className="text-sm text-gray-500">Count: 0</p>
        </div>
        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500 text-center text-sm">
            No items in queue.<br />
            Select items from the left to add them here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-300 p-4 h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Ready to Delete
        </h3>
        <p className="text-sm text-gray-500">Total: {queue.length} items</p>
      </div>

      {/* Categorized Queue - Scrollable */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {/* Amazon Section */}
        {renderSourceSection('Amazon', amazonItems)}

        {/* Walmart Section */}
        {renderSourceSection('Walmart', walmartItems)}

        {/* Unknown Section */}
        {renderSourceSection('Unknown', unknownItems)}
      </div>
    </div>
  )
}

export default DeleteQueue

