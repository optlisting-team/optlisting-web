import React, { useState } from 'react'
import SourceBadge from './SourceBadge'
import PlatformBadge from './PlatformBadge'
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function QueueReviewPanel({ queue, onRemove, onExportComplete, onHistoryUpdate, onSourceChange, onMarkDownloaded }) {
  const [downloadedGroups, setDownloadedGroups] = useState(new Set())
  // Group items by supplier
  const groupedBySource = queue.reduce((acc, item) => {
    // Safely extract supplier name, handling null, undefined, empty string, and "undefined" string
    let supplier = item.supplier_name || item.supplier || null
    if (!supplier || supplier === "undefined" || supplier === "null" || supplier.trim() === "") {
      supplier = "Unknown"
    }
    if (!acc[supplier]) {
      acc[supplier] = []
    }
    acc[supplier].push(item)
    return acc
  }, {})

  const formatPrice = (price) => {
    return `$${price.toFixed(2)}`
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const handleSourceExport = async (source, items) => {
    if (items.length === 0) {
      alert(`No ${source} items in queue to export.`)
      return
    }

    try {
      // Generate CSV content directly in frontend (works with demo data)
      const csvHeaders = ['Item ID', 'SKU', 'Title', 'Supplier', 'Price', 'Platform', 'Action']
      const csvRows = items.map(item => [
        item.ebay_item_id || item.item_id || '',
        item.sku || '',
        `"${(item.title || '').replace(/"/g, '""')}"`, // Escape quotes in title
        item.supplier_name || item.supplier || 'Unknown',
        item.price || 0,
        item.marketplace || 'eBay',
        'DELETE'
      ])

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.join(','))
      ].join('\n')

      // Create and download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      const sourceLower = source.toLowerCase().replace(/\s+/g, '_')
      const timestamp = new Date().toISOString().split('T')[0]
      link.setAttribute('download', `optlisting_${sourceLower}_delete_${timestamp}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      // Try to log deletion to API (optional, won't block if fails)
      try {
        await axios.post(`${API_BASE_URL}/api/log-deletion`, { items: items })
      } catch (logErr) {
        console.log('API log skipped (demo mode)')
      }

      // Mark this group as downloaded (don't remove)
      setDownloadedGroups(prev => new Set([...prev, source]))
      
      // Update history count
      if (onHistoryUpdate) {
        onHistoryUpdate()
      }
    } catch (err) {
      alert(`Failed to export ${source} CSV: ${err.message}`)
      console.error(err)
    }
  }

  // Monochrome theme - all sources use same styling
  const getSourceColor = () => {
    return {
      headerBg: 'bg-black',
      headerText: 'text-white',
      border: 'border-gray-300',
      bg: 'bg-white',
      buttonBg: 'bg-black',
      buttonHover: 'hover:bg-gray-900'
    }
  }

  if (queue.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-300 p-8 text-center">
        <div className="text-4xl mb-4">🗑️</div>
        <p className="text-lg font-semibold text-gray-900 mb-2">No Items in Queue</p>
        <p className="text-sm text-gray-500">
          Add items from the low interest items list to review them here.
        </p>
      </div>
    )
  }

  const colors = getSourceColor()

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
      {Object.entries(groupedBySource).map(([source, items]) => {
        const isDownloaded = downloadedGroups.has(source)
        return (
          <div
            key={source}
            className={`rounded-lg border overflow-hidden flex flex-col transition-all ${
              isDownloaded 
                ? 'bg-zinc-800 border-zinc-700 opacity-60' 
                : 'bg-white border-gray-300'
            }`}
          >
            {/* Header */}
            <div className={`${isDownloaded ? 'bg-zinc-900 text-zinc-400' : `${colors.headerBg} ${colors.headerText}`} px-6 py-4 flex-shrink-0 border-b ${isDownloaded ? 'border-zinc-700' : 'border-gray-300'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold">
                    {source.toUpperCase()} - {items.length} Item{items.length !== 1 ? 's' : ''}
                  </h2>
                  {isDownloaded && (
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full">
                      ✓ Downloaded
                    </span>
                  )}
                </div>
                <SourceBadge source={source} />
              </div>
            </div>

            {/* Table Area (Scrollable Body) */}
            <div className="flex-1 overflow-x-auto overflow-y-auto max-h-96 bg-white">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-white border-b border-gray-300 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Platform
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider max-w-xs">
                      Title
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Supplier
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <PlatformBadge marketplace={item.marketplace || 'eBay'} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                        {item.ebay_item_id}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 max-w-xs truncate" title={item.title}>
                        {item.title}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <SourceBadge 
                          source={item.supplier_name || item.supplier || "Unknown"} 
                          editable={!!onSourceChange}
                          onSourceChange={onSourceChange}
                          itemId={item.id}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {item.sku}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {formatPrice(item.price)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <button
                          onClick={() => onRemove(item.id)}
                          className="text-gray-600 hover:text-gray-900 font-medium text-xs"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer (Download Button) */}
            <div className="bg-white px-4 py-4 border-t border-gray-300 flex-shrink-0">
              {source === 'Unverified' ? (
                <div className="space-y-3">
                  <div className="bg-gray-50 border border-gray-300 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-gray-600 text-lg">⚠️</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900 mb-1">
                          Supplier Verification Required
                        </p>
                        <p className="text-xs text-gray-600">
                          Please identify the source manually to generate the correct CSV. Click on the source badges above to verify each item.
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    disabled
                    className="w-full bg-gray-300 text-gray-600 font-bold py-3 px-4 rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <span>🔒</span>
                    <span>Download Disabled - Verify Suppliers First</span>
                  </button>
                </div>
              ) : isDownloaded ? (
                <div className="space-y-2">
                  <div className="w-full bg-emerald-600/20 text-emerald-400 font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 border border-emerald-600/30">
                    <span>✅</span>
                    <span>Downloaded - {items.length} items exported</span>
                  </div>
                  <button
                    onClick={() => handleSourceExport(source, items)}
                    className="w-full bg-zinc-700 hover:bg-zinc-600 text-zinc-300 font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <span>🔄</span>
                    <span>Download Again</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleSourceExport(source, items)}
                  className={`w-full ${colors.buttonBg} ${colors.buttonHover} text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2`}
                >
                  <span>📥</span>
                  <span>Download {source} CSV ({items.length} items)</span>
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default QueueReviewPanel

