import React from 'react'
import SourceBadge from './SourceBadge'

function HistoryTable({ logs, loading }) {
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatPrice = (price) => {
    if (!price && price !== 0) return 'N/A'
    return `$${Number(price).toFixed(2)}`
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-zinc-500">
        Loading deletion history...
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-4xl mb-4">💀</div>
        <p className="text-lg font-semibold text-white mb-2">No Deletions Yet</p>
        <p className="text-sm text-zinc-500">
          Your deletion history will appear here once you export items for deletion.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Summary */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-zinc-400">
          Total <span className="text-white font-bold">{logs.length}</span> items deleted
        </div>
      </div>

      {/* Table */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-800">
            <thead className="bg-zinc-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Deleted On
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider max-w-xs">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Reason
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-zinc-400">
                    {formatDateTime(log.deleted_at)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-zinc-400">
                    {log.sku || '-'}
                  </td>
                  <td className="px-4 py-4 text-sm text-white max-w-xs truncate" title={log.title}>
                    {log.title}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <SourceBadge source={log.supplier || "Unknown"} />
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-white data-value">
                    {formatPrice(log.price)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="text-xs px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md">
                      {log.reason || 'Manual deletion'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default HistoryTable
