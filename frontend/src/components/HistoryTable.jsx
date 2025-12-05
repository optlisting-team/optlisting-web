import React from 'react'
import SourceBadge from './SourceBadge'
import PlatformBadge from './PlatformBadge'

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

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        Loading deletion history...
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="text-4xl mb-4">💀</div>
        <p className="text-lg font-semibold text-gray-700 mb-2">No Deletions Yet</p>
        <p className="text-sm text-gray-500">
          Your deletion history will appear here once you export items for deletion.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full border border-gray-300 rounded-lg overflow-x-auto bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-white border-b border-gray-300">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Deleted On
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Platform
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Item ID
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider max-w-xs">
              Title
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Supplier
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-zinc-50 transition-colors">
              <td className="px-6 py-5 whitespace-nowrap text-sm text-gray-500">
                {formatDateTime(log.deleted_at)}
              </td>
              <td className="px-6 py-5 whitespace-nowrap">
                <PlatformBadge marketplace={log.platform || 'eBay'} />
              </td>
              <td className="px-6 py-5 whitespace-nowrap text-sm font-mono text-gray-900">
                {log.item_id}
              </td>
              <td className="px-6 py-5 text-sm font-semibold text-gray-900 max-w-xs truncate" title={log.title}>
                {log.title}
              </td>
              <td className="px-6 py-5 whitespace-nowrap">
                <SourceBadge source={log.supplier || "Unknown"} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default HistoryTable

