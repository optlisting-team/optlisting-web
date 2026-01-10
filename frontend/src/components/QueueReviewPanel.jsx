import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import SourceBadge from './SourceBadge'
import PlatformBadge from './PlatformBadge'
import axios from 'axios'

// Use environment variable for Railway URL, fallback based on environment
// In local development, use empty string to leverage Vite proxy (localhost:8000)
// In production, use relative path /api which is proxied by vercel.json to Railway backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? '' : '')

function QueueReviewPanel({ queue, onRemove, onExportComplete, onHistoryUpdate, onSourceChange, onMarkDownloaded, onError = null }) {
  const [downloadedGroups, setDownloadedGroups] = useState(new Set())
  const [showShopifyModal, setShowShopifyModal] = useState(false)
  const [pendingExport, setPendingExport] = useState(null) // { source, items, shopifyItems, supplierItems }
  const [exporting, setExporting] = useState(false) // Loading state
  const [exportError, setExportError] = useState(null) // Error state
  const [showPreviewModal, setShowPreviewModal] = useState(false) // CSV preview modal
  const [previewData, setPreviewData] = useState(null) // { source, items, exportType, targetTool }
  const [hoveredImage, setHoveredImage] = useState(null) // Mouseover zoom image
  
  // Check if item goes through Shopify
  const isShopifyItem = (item) => {
    return item.management_hub === 'Shopify' || 
           item.marketplace === 'Shopify' ||
           item.platform === 'Shopify' ||
           (item.raw_data && typeof item.raw_data === 'object' && item.raw_data.management_hub === 'Shopify') ||
           (item.analysis_meta && typeof item.analysis_meta === 'object' && item.analysis_meta.management_hub === 'Shopify') ||
           (item.metrics && typeof item.metrics === 'object' && item.metrics.management_hub === 'Shopify')
  }
  
  // Group items by supplier only (group Shopify-routed and Direct items together)
  const groupedBySource = queue.reduce((acc, item) => {
    // Safely extract supplier name, handling null, undefined, empty string, and "undefined" string
    let supplier = item.supplier_name || item.supplier || null
    if (!supplier || supplier === "undefined" || supplier === "null" || supplier.trim() === "") {
      supplier = "Unknown"
    }
    
    // Group by same supplier (Shopify routing will be separated during Export)
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
      if (onError) {
        onError('No items in queue to export.', null)
      } else {
        setExportError('No items in queue to export.')
      }
      return
    }
    const { shopifyItems } = separateByShopify(items)
    if (shopifyItems.length > 0) {
      // Show preview modal
      setPreviewData({
        source: supplier,
        items: shopifyItems,
        exportType: 'shopify',
        targetTool: 'shopify_matrixify',
        groupKey: `${supplier} (via Shopify)`
      })
      setShowPreviewModal(true)
    }
  }

  const handleSupplierExport = async (supplier, items) => {
    if (items.length === 0) {
      if (onError) {
        onError('No items in queue to export.', null)
      } else {
        setExportError('No items in queue to export.')
      }
      return
    }
    const { supplierItems } = separateByShopify(items)
    if (supplierItems.length > 0) {
      // Determine target tool
      const supplierLower = (supplier || '').toLowerCase()
      let targetTool = 'autods'
      if (supplierLower.includes('wholesale2b') || supplierLower === 'wholesale2b') {
        targetTool = 'wholesale2b'
      } else if (supplierLower.includes('autods') || supplierLower === 'autods') {
        targetTool = 'autods'
      } else if (supplierLower.includes('yaballe') || supplierLower === 'yaballe') {
        targetTool = 'yaballe'
      }
      
      // Show preview modal
      setPreviewData({
        source: supplier,
        items: supplierItems,
        exportType: 'supplier',
        targetTool: targetTool,
        groupKey: `${supplier} (Direct)`
      })
      setShowPreviewModal(true)
    }
  }

  const handleSourceExport = async (supplier, items) => {
    if (items.length === 0) {
      if (onError) {
        onError('No items in queue to export.', null)
      } else {
        setExportError('No items in queue to export.')
      }
      return
    }

    // Separate Shopify and Direct within same supplier
    const { shopifyItems, supplierItems } = separateByShopify(items)
    
    // Determine target tool
    const supplierLower = (supplier || '').toLowerCase()
    let targetTool = 'autods'
    if (supplierLower.includes('wholesale2b') || supplierLower === 'wholesale2b') {
      targetTool = 'wholesale2b'
    } else if (supplierLower.includes('autods') || supplierLower === 'autods') {
      targetTool = 'autods'
    } else if (supplierLower.includes('yaballe') || supplierLower === 'yaballe') {
      targetTool = 'yaballe'
    }
    
    // If only Shopify items exist, export Shopify CSV
    if (shopifyItems.length > 0 && supplierItems.length === 0) {
      // Show preview modal
      setPreviewData({
        source: supplier,
        items: shopifyItems,
        exportType: 'shopify',
        targetTool: 'shopify_matrixify',
        groupKey: `${supplier} (via Shopify)`
      })
      setShowPreviewModal(true)
      return
    }
    
    // If only Direct items exist, export supplier CSV
    if (supplierItems.length > 0 && shopifyItems.length === 0) {
      // Show preview modal
      setPreviewData({
        source: supplier,
        items: supplierItems,
        exportType: 'supplier',
        targetTool: targetTool,
        groupKey: `${supplier} (Direct)`
      })
      setShowPreviewModal(true)
      return
    }
    
    // If both exist, display Shopify modal (existing logic)
    setPendingExport({
      source: supplier,
      items: items,
      shopifyItems: shopifyItems,
      supplierItems: supplierItems
    })
    setShowShopifyModal(true)
  }
  
  const performExport = async (source, items, exportType, groupKey) => {
    // Prevent concurrent requests
    if (exporting) {
      console.warn('Export already in progress')
      return
    }
    
    setExporting(true)
    setExportError(null)
    
    let apiErrorMsg = null // Store API error message
    
    try {
      // Safely define and validate source parameter
      let safeSource = 'Unknown'
      if (source && typeof source === 'string' && source.trim() !== '') {
        safeSource = source
      } else if (items && items.length > 0 && items[0]) {
        const item = items[0]
        safeSource = item.supplier_name || item.supplier || item.source || 'Unknown'
      }
      
      // Final validation check
      if (!safeSource || typeof safeSource !== 'string' || safeSource.trim() === '') {
        safeSource = 'Unknown'
      }
      
      // Determine target tool based on export type
      let targetTool = 'autods' // Default
      
      if (exportType === 'shopify') {
        // Use Shopify CSV format
        targetTool = 'shopify_matrixify' // or 'shopify_tagging' based on preference
      } else {
        // Use supplier-specific format (determine from supplier name)
        const supplier = items[0]?.supplier_name || items[0]?.supplier || items[0]?.source || 'Unknown'
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
            responseType: 'blob',
            timeout: 30000 // Added 30s timeout
          }
        )

        // Create and download CSV file
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        
        const sourceLower = safeSource.toLowerCase().replace(/\s+/g, '_')
        const exportTypeLabel = exportType === 'shopify' ? 'shopify' : 'supplier'
        const timestamp = new Date().toISOString().split('T')[0]
        link.setAttribute('download', `optlisting_${sourceLower}_${exportTypeLabel}_delete_${timestamp}.csv`)
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
      } catch (apiErr) {
        // Generate frontend CSV as fallback if API error occurs
        console.warn('API export failed, using frontend generation:', apiErr)
        
        // Store error message (to display to user later)
        if (apiErr.code === 'ECONNABORTED') {
          apiErrorMsg = 'Request timeout. Generating CSV in default format.'
        } else if (apiErr.response) {
          apiErrorMsg = `Server error (${apiErr.response.status}). Generating CSV in default format.`
        } else if (apiErr.request) {
          apiErrorMsg = 'Server connection failed. Generating CSV in default format.'
        } else {
          apiErrorMsg = 'CSV generation via API failed. Generating in default format.'
        }
        
        // Fallback to frontend CSV generation
        const csvHeaders = ['Item ID', 'SKU', 'Title', 'Supplier', 'Price', 'Platform', 'Action']
        const csvRows = items.map(item => [
          item.ebay_item_id || item.item_id || '',
          item.sku || '',
          `"${(item.title || '').replace(/"/g, '""')}"`,
          item.supplier_name || item.supplier || item.source || 'Unknown',
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
        
        const sourceLower = safeSource.toLowerCase().replace(/\s+/g, '_')
        const exportTypeLabel = exportType === 'shopify' ? 'shopify' : 'supplier'
        const timestamp = new Date().toISOString().split('T')[0]
        link.setAttribute('download', `optlisting_${sourceLower}_${exportTypeLabel}_delete_${timestamp}.csv`)
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
        
        // Show warning message if API fails (but CSV is downloaded)
        if (apiErrorMsg) {
          console.warn(apiErrorMsg)
          // Notify user (but only warning since CSV is already downloaded)
          if (onError) {
            onError(`${apiErrorMsg}\n\nCSV file has been generated in default format.`, null)
          } else {
            setExportError(`${apiErrorMsg}\n\nCSV file has been generated in default format.`)
          }
        }
      }

      // Try to log deletion to API
      try {
        await axios.post(`${API_BASE_URL}/api/log-deletion`, { items: items }, {
          timeout: 30000 // Increased from 10s to 30s
        })
      } catch (logErr) {
        console.log('API log skipped:', logErr.message)
        // Logging failure is not critical, so continue
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
      setExporting(false)
    } catch (err) {
      setExporting(false)
      const errorMsg = err.code === 'ERR_NETWORK' 
        ? 'Network error. Please check your connection.'
        : err.response?.status === 401 || err.response?.status === 403
        ? 'Please reconnect your eBay account.'
        : err.response?.status >= 500
        ? 'Server error. Try again later.'
        : err.code === 'ECONNABORTED'
        ? 'Request timeout. Please try again.'
        : `CSV extraction failed: ${err.message || 'An unknown error occurred.'}`
      setExportError(errorMsg)
      if (onError) {
        onError(errorMsg, err)
      }
      console.error('Export error:', err)
    }
  }

  const handleShopifyModalChoice = async (choice) => {
    if (!pendingExport) return

    const { source, shopifyItems, supplierItems } = pendingExport
    
    // Extract from items if source is missing
    const safeSource = source || pendingExport.items[0]?.supplier_name || pendingExport.items[0]?.supplier || pendingExport.items[0]?.source || 'Unknown'
    
    // Determine target tool
    const supplierLower = (safeSource || '').toLowerCase()
    let targetTool = 'autods'
    if (supplierLower.includes('wholesale2b') || supplierLower === 'wholesale2b') {
      targetTool = 'wholesale2b'
    } else if (supplierLower.includes('autods') || supplierLower === 'autods') {
      targetTool = 'autods'
    } else if (supplierLower.includes('yaballe') || supplierLower === 'yaballe') {
      targetTool = 'yaballe'
    }

    if (choice === 'shopify') {
      // Export only Shopify items via Shopify
      if (shopifyItems.length > 0) {
        setPreviewData({
          source: safeSource,
          items: shopifyItems,
          exportType: 'shopify',
          targetTool: 'shopify_matrixify',
          groupKey: `${safeSource} (via Shopify)`
        })
        setShowPreviewModal(true)
      }
      // Also export supplier items if any (second item displayed after first completes)
      if (supplierItems.length > 0) {
        // Slight delay to display second after first preview
        setTimeout(() => {
          setPreviewData({
            source: safeSource,
            items: supplierItems,
            exportType: 'supplier',
            targetTool: targetTool,
            groupKey: `${safeSource} (Direct)`
          })
          setShowPreviewModal(true)
        }, 100)
      }
      setShowShopifyModal(false)
      setPendingExport(null)
    } else if (choice === 'supplier') {
      // Export all items via source supplier
      setPreviewData({
        source: safeSource,
        items: pendingExport.items,
        exportType: 'supplier',
        targetTool: targetTool,
        groupKey: `${safeSource} (All)`
      })
      setShowPreviewModal(true)
      setShowShopifyModal(false)
      setPendingExport(null)
    }
  }
  
  const handleConfirmPreview = async () => {
    if (!previewData) return
    
    setShowPreviewModal(false)
    const currentPreview = previewData
    setPreviewData(null)
    
    await performExport(
      currentPreview.source,
      currentPreview.items,
      currentPreview.exportType,
      currentPreview.groupKey
    )
    
    // Show deletion guide after successful export
    const toolName = currentPreview.targetTool === 'autods' ? 'AutoDS' : 
                    currentPreview.targetTool === 'yaballe' ? 'Yaballe' : 
                    currentPreview.targetTool === 'wholesale2b' ? 'Wholesale2B' : 
                    currentPreview.targetTool === 'shopify_matrixify' ? 'Shopify' : 'Supplier'
    
    // Show success message via callback or state
    const successMsg = currentPreview.targetTool === 'shopify_matrixify'
      ? `CSV downloaded successfully! Next steps: 1. Log in to your Shopify account 2. Use Matrixify/Excelify to import the CSV 3. Review and confirm deletion`
      : `CSV downloaded successfully! Next steps: 1. Log in to your ${toolName} account 2. Upload the CSV file using Bulk Actions 3. Review and confirm deletion`
    if (onError) {
      // Use onError callback but with success type (if supported) or show in state
      setTimeout(() => {
        onError(successMsg, null) // Can be extended to support success type
      }, 500)
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
              {exportError && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{exportError}</p>
                  <button
                    onClick={() => setExportError(null)}
                    className="mt-2 text-xs text-red-500 hover:text-red-700"
                  >
                    Close
                  </button>
                </div>
              )}
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
                        disabled={exporting}
                        className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-300 font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        {exporting ? (
                          <>
                            <span className="animate-spin">⏳</span>
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <span>🔄</span>
                            <span>Shopify</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleSupplierExport(supplier, items)}
                        disabled={exporting}
                        className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-300 font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        {exporting ? (
                          <>
                            <span className="animate-spin">⏳</span>
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <span>🔄</span>
                            <span>Supplier</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSourceExport(supplier, items)}
                      disabled={exporting}
                      className="w-full bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-300 font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      {exporting ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          <span>Generating CSV...</span>
                        </>
                      ) : (
                        <>
                          <span>🔄</span>
                          <span>Download Again</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {shopifyItems.length > 0 && (
                    <button
                      onClick={() => handleShopifyExport(supplier, items)}
                      disabled={exporting}
                      className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      {exporting ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          <span>Generating CSV...</span>
                        </>
                      ) : (
                        <>
                          <span>📥</span>
                          <span>Download Shopify CSV ({shopifyItems.length} items)</span>
                        </>
                      )}
                    </button>
                  )}
                  {supplierItems.length > 0 && (
                    <button
                      onClick={() => handleSupplierExport(supplier, items)}
                      disabled={exporting}
                      className={`w-full ${colors.buttonBg} ${colors.buttonHover} disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2`}
                    >
                      {exporting ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          <span>Generating CSV...</span>
                        </>
                      ) : (
                        <>
                          <span>📥</span>
                          <span>Download {supplier} CSV ({supplierItems.length} items)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* CSV Preview Modal */}
      {showPreviewModal && previewData && createPortal(
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowPreviewModal(false)
            setPreviewData(null)
          }}
        >
          <div 
            className="bg-zinc-900 border border-zinc-700 rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-zinc-700">
              <h3 className="text-xl font-bold text-white mb-2">CSV Export Preview</h3>
              <p className="text-sm text-zinc-400">
                {previewData.items.length} items will be exported to {previewData.targetTool === 'shopify_matrixify' ? 'Shopify' : previewData.source} CSV format
              </p>
            </div>
            
            {/* Preview Table */}
            <div className="flex-1 overflow-auto p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-800 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Image</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Sell Item ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">SKU</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Supplier ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {previewData.items.map((item, index) => {
                      const imageUrl = item.image_url || item.picture_url || item.thumbnail_url
                      const sellItemId = item.sell_item_id || item.item_id || item.ebay_item_id || 'N/A'
                      const supplierId = item.supplier_id || item.sku || 'N/A'
                      
                      return (
                        <tr key={item.id || index} className="hover:bg-zinc-800/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="relative group">
                              {imageUrl ? (
                                <img 
                                  src={imageUrl}
                                  alt={item.title || 'Product'}
                                  className="w-16 h-16 object-cover rounded border border-zinc-700 cursor-pointer"
                                  onMouseEnter={(e) => {
                                    const rect = e.target.getBoundingClientRect()
                                    setHoveredImage({
                                      url: imageUrl,
                                      x: rect.right + 10,
                                      y: rect.top
                                    })
                                  }}
                                  onMouseLeave={() => setHoveredImage(null)}
                                  onError={(e) => {
                                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" fill="%23171717"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23717171" font-size="10"%3ENo Image%3C/text%3E%3C/svg%3E'
                                  }}
                                />
                              ) : (
                                <div className="w-16 h-16 bg-zinc-800 border border-zinc-700 rounded flex items-center justify-center">
                                  <span className="text-xs text-zinc-500">No Image</span>
                                </div>
                              )}
                              {/* Mouseover Zoom */}
                              {hoveredImage && hoveredImage.url === imageUrl && (
                                <div 
                                  className="fixed z-[100] pointer-events-none"
                                  style={{
                                    left: `${hoveredImage.x}px`,
                                    top: `${hoveredImage.y}px`,
                                    transform: 'translateY(-50%)'
                                  }}
                                >
                                  <img 
                                    src={imageUrl}
                                    alt="Zoomed"
                                    className="w-64 h-64 object-contain rounded-lg border-2 border-zinc-600 shadow-2xl bg-zinc-900"
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-zinc-300">{sellItemId}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-zinc-300">{item.sku || 'N/A'}</span>
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            <span className="text-zinc-300 text-xs line-clamp-2" title={item.title}>
                              {item.title || 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-zinc-300">{supplierId}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-zinc-300 text-xs">${(item.price || 0).toFixed(2)}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-6 border-t border-zinc-700">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-zinc-400">
                  Total: {previewData.items.length} items
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowPreviewModal(false)
                      setPreviewData(null)
                    }}
                    className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmPreview}
                    disabled={exporting}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                  >
                    {exporting ? 'Exporting...' : 'Confirm & Download CSV'}
                  </button>
                </div>
              </div>
              
              {/* Supplier Deletion Guide */}
              {previewData.targetTool !== 'shopify_matrixify' && (
                <div className="mt-4 p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg">
                  <h4 className="text-sm font-semibold text-white mb-2">
                    📋 {previewData.targetTool === 'autods' ? 'AutoDS' : previewData.targetTool === 'yaballe' ? 'Yaballe' : 'Supplier'} CSV Upload Guide
                  </h4>
                  <div className="text-xs text-zinc-400 space-y-1">
                    {previewData.targetTool === 'autods' && (
                      <>
                        <p>1. Log in to your AutoDS account</p>
                        <p>2. Go to <strong className="text-zinc-300">Products → Bulk Actions</strong></p>
                        <p>3. Click <strong className="text-zinc-300">Upload CSV</strong> and select the downloaded file</p>
                        <p>4. Review the items and confirm deletion</p>
                      </>
                    )}
                    {previewData.targetTool === 'yaballe' && (
                      <>
                        <p>1. Log in to your Yaballe account</p>
                        <p>2. Go to <strong className="text-zinc-300">Monitors → Bulk Actions</strong></p>
                        <p>3. Click <strong className="text-zinc-300">Import CSV</strong> and select the downloaded file</p>
                        <p>4. Review the items and confirm deletion</p>
                      </>
                    )}
                    {previewData.targetTool === 'wholesale2b' && (
                      <>
                        <p>1. Log in to your Wholesale2B account</p>
                        <p>2. Go to <strong className="text-zinc-300">Products → Bulk Import</strong></p>
                        <p>3. Upload the CSV file and confirm deletion</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

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

