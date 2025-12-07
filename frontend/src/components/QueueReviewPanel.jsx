import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import SourceBadge from './SourceBadge'
import PlatformBadge from './PlatformBadge'
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function QueueReviewPanel({ queue, onRemove, onExportComplete, onHistoryUpdate, onSourceChange, onMarkDownloaded }) {
  const [downloadedGroups, setDownloadedGroups] = useState(new Set())
  const [showShopifyModal, setShowShopifyModal] = useState(false)
  const [pendingExport, setPendingExport] = useState(null) // { source, items, shopifyItems, supplierItems }
  
  // Check if item goes through Shopify
  const isShopifyItem = (item) => {
    return item.management_hub === 'Shopify' || 
           item.marketplace === 'Shopify' ||
           item.platform === 'Shopify' ||
           (item.raw_data && typeof item.raw_data === 'object' && item.raw_data.management_hub === 'Shopify') ||
           (item.analysis_meta && typeof item.analysis_meta === 'object' && item.analysis_meta.management_hub === 'Shopify') ||
           (item.metrics && typeof item.metrics === 'object' && item.metrics.management_hub === 'Shopify')
  }
  
  // Group items by supplier only (Shopify 경유와 Direct를 같은 그룹으로 묶음)
  const groupedBySource = queue.reduce((acc, item) => {
    // Safely extract supplier name, handling null, undefined, empty string, and "undefined" string
    let supplier = item.supplier_name || item.supplier || null
    if (!supplier || supplier === "undefined" || supplier === "null" || supplier.trim() === "") {
      supplier = "Unknown"
    }
    
    // 같은 공급처로 그룹화 (Shopify 경유 여부는 나중에 Export 시 분리)
    if (!acc[supplier]) {
      acc[supplier] = {
        supplier: supplier,
        items: []
      }
    }
    acc[supplier].items.push(item)
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

  // Check if items go through Shopify
  const hasShopifyItems = (items) => {
    return items.some(item => 
      item.management_hub === 'Shopify' || 
      item.marketplace === 'Shopify' ||
      (item.raw_data && typeof item.raw_data === 'object' && item.raw_data.management_hub === 'Shopify')
    )
  }

  // Separate items by Shopify vs Source Supplier
  const separateByShopify = (items) => {
    const shopifyItems = items.filter(item => 
      item.management_hub === 'Shopify' || 
      item.marketplace === 'Shopify' ||
      (item.raw_data && typeof item.raw_data === 'object' && item.raw_data.management_hub === 'Shopify')
    )
    const supplierItems = items.filter(item => 
      !(item.management_hub === 'Shopify' || 
        item.marketplace === 'Shopify' ||
        (item.raw_data && typeof item.raw_data === 'object' && item.raw_data.management_hub === 'Shopify'))
    )
    return { shopifyItems, supplierItems }
  }

  const handleShopifyExport = async (supplier, items) => {
    if (items.length === 0) {
      alert(`No items in queue to export.`)
      return
    }
    const { shopifyItems } = separateByShopify(items)
    if (shopifyItems.length > 0) {
      await performExport(supplier, shopifyItems, 'shopify', `${supplier} (via Shopify)`)
    }
  }

  const handleSupplierExport = async (supplier, items) => {
    if (items.length === 0) {
      alert(`No items in queue to export.`)
      return
    }
    const { supplierItems } = separateByShopify(items)
    if (supplierItems.length > 0) {
      await performExport(supplier, supplierItems, 'supplier', `${supplier} (Direct)`)
    }
  }

  const handleSourceExport = async (supplier, items) => {
    if (items.length === 0) {
      alert(`No items in queue to export.`)
      return
    }

    // 같은 공급처 내에서 Shopify 경유와 Direct를 분리
    const { shopifyItems, supplierItems } = separateByShopify(items)
    
    // Shopify 경유만 있으면 Shopify CSV
    if (shopifyItems.length > 0 && supplierItems.length === 0) {
      await performExport(supplier, shopifyItems, 'shopify', `${supplier} (via Shopify)`)
      return
    }
    
    // Direct만 있으면 공급처 CSV
    if (supplierItems.length > 0 && shopifyItems.length === 0) {
      await performExport(supplier, supplierItems, 'supplier', `${supplier} (Direct)`)
      return
    }
  }

  const performExport = async (source, items, exportType, groupKey) => {
    try {
      // Determine target tool based on export type
      let targetTool = 'autods' // Default
      
      if (exportType === 'shopify') {
        // Use Shopify CSV format
        targetTool = 'shopify_matrixify' // or 'shopify_tagging' based on preference
      } else {
        // Use supplier-specific format (determine from supplier name)
        const supplier = items[0]?.supplier_name || items[0]?.supplier || 'Unknown'
        const supplierLower = supplier.toLowerCase()
        
        if (supplierLower.includes('wholesale2b') || supplierLower === 'wholesale2b') {
          targetTool = 'wholesale2b'
        } else if (supplierLower.includes('autods') || supplierLower === 'autods') {
          targetTool = 'autods'
        } else {
          targetTool = 'autods' // Default fallback
        }
      }

      // Use API export for proper CSV format
      try {
        const response = await axios.post(
          `${API_BASE_URL}/api/export-queue`,
          {
            items: items,
            target_tool: targetTool,
            export_mode: targetTool
          },
          {
            responseType: 'blob'
          }
        )

        // Create and download CSV file
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        
        const sourceLower = source.toLowerCase().replace(/\s+/g, '_')
        const exportTypeLabel = exportType === 'shopify' ? 'shopify' : 'supplier'
        const timestamp = new Date().toISOString().split('T')[0]
        link.setAttribute('download', `optlisting_${sourceLower}_${exportTypeLabel}_delete_${timestamp}.csv`)
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
      } catch (apiErr) {
        // Fallback to frontend CSV generation if API fails
        console.warn('API export failed, using frontend generation:', apiErr)
        const csvHeaders = ['Item ID', 'SKU', 'Title', 'Supplier', 'Price', 'Platform', 'Action']
        const csvRows = items.map(item => [
          item.ebay_item_id || item.item_id || '',
          item.sku || '',
          `"${(item.title || '').replace(/"/g, '""')}"`,
          item.supplier_name || item.supplier || 'Unknown',
          item.price || 0,
          item.marketplace || 'eBay',
          'DELETE'
        ])

        const csvContent = [
          csvHeaders.join(','),
          ...csvRows.map(row => row.join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        
        const sourceLower = source.toLowerCase().replace(/\s+/g, '_')
        const exportTypeLabel = exportType === 'shopify' ? 'shopify' : 'supplier'
        const timestamp = new Date().toISOString().split('T')[0]
        link.setAttribute('download', `optlisting_${sourceLower}_${exportTypeLabel}_delete_${timestamp}.csv`)
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
      }

      // Try to log deletion to API
      try {
        await axios.post(`${API_BASE_URL}/api/log-deletion`, { items: items })
      } catch (logErr) {
        console.log('API log skipped')
      }

      // Mark this group as downloaded
      setDownloadedGroups(prev => new Set([...prev, groupKey || source]))
      
      // Update history count
      if (onHistoryUpdate) {
        onHistoryUpdate()
      }

      // Close modal if open
      setShowShopifyModal(false)
      setPendingExport(null)
    } catch (err) {
      alert(`Failed to export ${source} CSV: ${err.message}`)
      console.error(err)
    }
  }

  const handleShopifyModalChoice = async (choice) => {
    if (!pendingExport) return

    const { source, shopifyItems, supplierItems } = pendingExport

    if (choice === 'shopify') {
      // Export only Shopify items via Shopify
      if (shopifyItems.length > 0) {
        await performExport(source, shopifyItems, 'shopify')
      }
      // Also export supplier items if any
      if (supplierItems.length > 0) {
        await performExport(source, supplierItems, 'supplier')
      }
    } else if (choice === 'supplier') {
      // Export all items via source supplier
      await performExport(source, pendingExport.items, 'supplier')
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
      {Object.entries(groupedBySource).map(([supplier, groupData]) => {
        const { items } = groupData
        const { shopifyItems, supplierItems } = separateByShopify(items)
        const hasBothTypes = shopifyItems.length > 0 && supplierItems.length > 0
        const isDownloaded = downloadedGroups.has(supplier)
        return (
          <div
            key={supplier}
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
                    {supplier.toUpperCase()} - {items.length} Item{items.length !== 1 ? 's' : ''}
                  </h2>
                  {hasBothTypes && (
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-[10px] font-medium">
                      Mixed (Shopify + Direct)
                    </span>
                  )}
                  {shopifyItems.length > 0 && supplierItems.length === 0 && (
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded text-[10px] font-medium">
                      via Shopify
                    </span>
                  )}
                  {isDownloaded && (
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full">
                      ✓ Downloaded
                    </span>
                  )}
                </div>
                <SourceBadge source={supplier} />
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
                        <div className="flex flex-col gap-1.5">
                          <SourceBadge 
                            source={item.supplier_name || item.supplier || "Unknown"} 
                            editable={!!onSourceChange}
                            onSourceChange={onSourceChange}
                            itemId={item.id}
                          />
                          {/* Show "via Shopify" badge if product goes through Shopify */}
                          {isShopifyItem(item) && (
                            <span className="inline-block px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded text-[10px] font-medium">
                              via Shopify
                            </span>
                          )}
                        </div>
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
                  {hasBothTypes ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleShopifyExport(supplier, items)}
                        className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        <span>🔄</span>
                        <span>Shopify</span>
                      </button>
                      <button
                        onClick={() => handleSupplierExport(supplier, items)}
                        className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        <span>🔄</span>
                        <span>Supplier</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSourceExport(supplier, items)}
                      className="w-full bg-zinc-700 hover:bg-zinc-600 text-zinc-300 font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <span>🔄</span>
                      <span>Download Again</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {shopifyItems.length > 0 && (
                    <button
                      onClick={() => handleShopifyExport(supplier, items)}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <span>📥</span>
                      <span>Download Shopify CSV ({shopifyItems.length} items)</span>
                    </button>
                  )}
                  {supplierItems.length > 0 && (
                    <button
                      onClick={() => handleSupplierExport(supplier, items)}
                      className={`w-full ${colors.buttonBg} ${colors.buttonHover} text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2`}
                    >
                      <span>📥</span>
                      <span>Download {supplier} CSV ({supplierItems.length} items)</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Shopify Export Choice Modal */}
      {showShopifyModal && pendingExport && createPortal(
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => {
            setShowShopifyModal(false)
            setPendingExport(null)
          }}
        >
          <div 
            className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-2">Export Options</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Some items go through Shopify. Choose where to delete them:
            </p>
            
            <div className="space-y-3 mb-4">
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                <div className="text-xs text-zinc-500 mb-1">Shopify Items</div>
                <div className="text-sm text-white font-semibold">
                  {pendingExport.shopifyItems.length} items via Shopify
                </div>
              </div>
              {pendingExport.supplierItems.length > 0 && (
                <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                  <div className="text-xs text-zinc-500 mb-1">Direct Supplier Items</div>
                  <div className="text-sm text-white font-semibold">
                    {pendingExport.supplierItems.length} items from source supplier
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleShopifyModalChoice('shopify')}
                className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition-colors"
              >
                Delete via Shopify ({pendingExport.shopifyItems.length} items)
              </button>
              <button
                onClick={() => handleShopifyModalChoice('supplier')}
                className="w-full px-4 py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold rounded-lg transition-colors"
              >
                Delete from Source Supplier ({pendingExport.items.length} items)
              </button>
              <button
                onClick={() => {
                  setShowShopifyModal(false)
                  setPendingExport(null)
                }}
                className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default QueueReviewPanel

