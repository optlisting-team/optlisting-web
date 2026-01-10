import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import ZombieTable from './ZombieTable'
import FilterBar from './FilterBar'
import { normalizeImageUrl } from '../utils/imageUtils'

// Use environment variable for Railway URL, fallback based on environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? '' : 'https://optlisting-production.up.railway.app')
const CURRENT_USER_ID = "default-user"

function LowPerformingResults({ mode = 'all' }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  
  // Filters from URL params (for low-performing mode)
  const filters = useMemo(() => {
    if (mode === 'low') {
      return {
        analytics_period_days: parseInt(searchParams.get('days') || '7'),
        min_days: parseInt(searchParams.get('days') || '7'),
        max_sales: parseInt(searchParams.get('sales') || '0'),
        max_watches: parseInt(searchParams.get('watch') || '0'),
        max_watch_count: parseInt(searchParams.get('watch') || '0'),
        max_impressions: parseInt(searchParams.get('imp') || '100'),
        max_views: parseInt(searchParams.get('views') || '10')
      }
    }
    return {}
  }, [mode, searchParams])
  
  // Pagination state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('days_listed')
  const [sortOrder, setSortOrder] = useState('desc')
  
  // Data state
  const [listings, setListings] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  
  // Prevent duplicate calls
  const fetchInProgress = useRef(false)
  
  // Extract supplier info (from Dashboard.jsx)
  const extractSupplierInfo = (title, sku = '', imageUrl = '') => {
    const text = (title || '').toLowerCase() + ' ' + (sku || '').toLowerCase() + ' ' + (imageUrl || '').toLowerCase()
    const skuUpper = (sku || '').toUpperCase()
    const imageUrlLower = (imageUrl || '').toLowerCase()
    
    // Amazon detection
    if (skuUpper.startsWith('B0') || skuUpper.startsWith('ASIN') || text.includes('amazon') || imageUrlLower.includes('amazon')) {
      const supplierId = skuUpper.startsWith('B0') ? skuUpper.substring(0, 10) : null
      return { supplier_name: 'Amazon', supplier_id: supplierId }
    }
    
    // Walmart detection
    if (skuUpper.startsWith('WM') || text.includes('walmart') || imageUrlLower.includes('walmart')) {
      const supplierId = skuUpper.startsWith('WM') ? skuUpper.substring(2) : null
      return { supplier_name: 'Walmart', supplier_id: supplierId }
    }
    
    // AliExpress detection
    if (skuUpper.startsWith('AE') || text.includes('aliexpress') || imageUrlLower.includes('aliexpress')) {
      const supplierId = skuUpper.startsWith('AE') ? skuUpper.substring(2) : null
      return { supplier_name: 'AliExpress', supplier_id: supplierId }
    }
    
    // CJ Dropshipping detection
    if (skuUpper.startsWith('CJ') || text.includes('cj dropshipping') || imageUrlLower.includes('cjdropshipping')) {
      const supplierId = skuUpper.startsWith('CJ') ? skuUpper.substring(2) : null
      return { supplier_name: 'CJ Dropshipping', supplier_id: supplierId }
    }
    
    // Banggood detection
    if (skuUpper.startsWith('BG') || text.includes('banggood') || imageUrlLower.includes('banggood')) {
      const supplierId = skuUpper.startsWith('BG') ? skuUpper.substring(2) : null
      return { supplier_name: 'Banggood', supplier_id: supplierId }
    }
    
    // Common pattern: SKU starting with D (e.g., D0102HEVLYJ-KS Z1 BPNK)
    if (skuUpper.startsWith('D') && /^D\d/.test(skuUpper)) {
      return { supplier_name: 'Unverified', supplier_id: null }
    }
    
    return { supplier_name: 'Unknown', supplier_id: null }
  }
  
  // Fetch listings from API
  const fetchListings = async () => {
    if (fetchInProgress.current) {
      console.warn('⚠️ fetchListings already in progress, skipping duplicate call')
      return
    }
    
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    try {
      fetchInProgress.current = true
      setLoading(true)
      setError(null)
      
      console.log(`📦 fetchListings [${requestId}]: Starting to fetch eBay listings...`, { mode, filters, page, pageSize })
      
      // Performance mark 시작
      if (typeof performance !== 'undefined' && performance.mark) {
        performance.mark(`fetchListings_start_${requestId}`)
      }
      
      // Build API params
      const params = {
        user_id: CURRENT_USER_ID,
        page: page,
        entries_per_page: pageSize,
        search: search || undefined
      }
      
      // Add filter params for low-performing mode
      if (mode === 'low') {
        params.min_days = filters.min_days || filters.analytics_period_days || 7
        params.max_sales = filters.max_sales || 0
        params.max_watches = filters.max_watches || filters.max_watch_count || 0
        params.max_impressions = filters.max_impressions || 100
        params.max_views = filters.max_views || 10
      }
      
      // Add sort params
      if (sortBy) {
        params.sort_by = sortBy
        params.sort_order = sortOrder || 'desc'
      }
      
      console.log(`📡 fetchListings [${requestId}]: Calling API:`, `${API_BASE_URL}/api/ebay/listings/active`, params)
      
      const response = await axios.get(`${API_BASE_URL}/api/ebay/listings/active`, {
        params,
        timeout: 120000,
        headers: {
          'X-Request-Id': requestId
        }
      })
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to fetch eBay listings')
      }
      
      // Performance mark 종료 및 측정
      if (typeof performance !== 'undefined' && performance.mark && performance.measure) {
        performance.mark(`fetchListings_end_${requestId}`)
        performance.measure(
          `fetchListings_duration_${requestId}`,
          `fetchListings_start_${requestId}`,
          `fetchListings_end_${requestId}`
        )
        const measure = performance.getEntriesByName(`fetchListings_duration_${requestId}`)[0]
        console.log(`⏱️ fetchListings [${requestId}]: Completed in ${measure.duration.toFixed(2)}ms`)
      }
      
      const listingsFromEbay = response.data.listings || []
      const total = response.data.total_count || listingsFromEbay.length
      
      console.log(`✅ fetchListings [${requestId}]: Successfully fetched ${listingsFromEbay.length} listings (total: ${total})`)
      
      // Transform listing data
      const transformedListings = listingsFromEbay.map((item, index) => {
        const supplierInfo = extractSupplierInfo(item.title, item.sku, item.image_url || item.picture_url || item.thumbnail_url)
        const rawImageUrl = item.image_url || item.picture_url || item.thumbnail_url
        const normalizedImageUrl = normalizeImageUrl(rawImageUrl)
        
        return {
          id: item.item_id || `ebay-${index}`,
          item_id: item.item_id || item.ebay_item_id,
          ebay_item_id: item.ebay_item_id || item.item_id,
          sell_item_id: item.sell_item_id || item.item_id || item.ebay_item_id,
          title: item.title,
          price: item.price,
          sku: item.sku,
          supplier: supplierInfo.supplier_name,
          supplier_name: supplierInfo.supplier_name,
          supplier_id: supplierInfo.supplier_id,
          source: item.source || supplierInfo.supplier_name,
          total_sales: item.quantity_sold || 0,
          quantity_sold: item.quantity_sold || 0,
          watch_count: item.watch_count || 0,
          view_count: item.view_count || 0,
          views: item.view_count || 0,
          impressions: item.impressions || 0,
          days_listed: item.days_listed || 0,
          start_time: item.start_time,
          picture_url: item.picture_url,
          thumbnail_url: item.thumbnail_url || item.picture_url,
          image_url: normalizedImageUrl || rawImageUrl,
          is_zombie: mode === 'low' ? true : false
        }
      })
      
      setListings(transformedListings)
      setTotalCount(total)
      setError(null)
      
    } catch (err) {
      console.error(`❌ fetchListings [${requestId}] error:`, err)
      setError(err.response?.data?.error || err.message || 'Failed to fetch listings')
      setListings([])
      setTotalCount(0)
    } finally {
      fetchInProgress.current = false
      setLoading(false)
    }
  }
  
  // Fetch listings when component mounts or params change
  useEffect(() => {
    fetchListings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, page, pageSize, search, sortBy, sortOrder])
  
  // Re-fetch when filters change (for low mode)
  useEffect(() => {
    if (mode === 'low') {
      // Reset to page 1 when filters change
      if (page !== 1) {
        setPage(1)
      } else {
        fetchListings()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, mode, page])
  
  const handleSourceChange = async (itemId, newSupplier) => {
    try {
      await axios.patch(`${API_BASE_URL}/api/listing/${itemId}`, {
        supplier: newSupplier
      })
      
      // Update in local state
      setListings(listings.map(item => 
        item.id === itemId ? { ...item, supplier: newSupplier, supplier_name: newSupplier } : item
      ))
    } catch (err) {
      console.error('Failed to update source:', err)
      alert('Failed to update source. Please try again.')
    }
  }
  
  const handleSelect = (id, checked) => {
    if (checked) {
      setSelectedIds([...selectedIds, id])
    } else {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id))
    }
  }
  
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(listings.map(item => item.id))
    } else {
      setSelectedIds([])
    }
  }
  
  const handleAddToQueue = () => {
    // TODO: Implement queue functionality (navigate to dashboard with queue items)
    console.log('Add to queue:', selectedIds)
    alert('Queue functionality will be implemented')
  }
  
  const totalPages = Math.ceil(totalCount / pageSize)
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {mode === 'low' ? '📉 Low-Performing SKUs' : '📋 All Listings'}
          </h2>
          <p className="text-sm text-zinc-400">
            {mode === 'low' 
              ? `Found ${totalCount} low-performing items based on filters`
              : `Total ${totalCount} active listings`
            }
          </p>
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          ← Back to Dashboard
        </button>
      </div>
      
      {/* Filter Bar (for low mode) */}
      {mode === 'low' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <p className="text-sm text-zinc-300 mb-2">
            Filters: No sales in the past{' '}
            <span className="font-bold text-white">{filters.min_days || filters.analytics_period_days || 7} days</span>
            {filters.max_views !== undefined && filters.max_views !== null && (
              <>, views ≤ <span className="font-bold text-white">{filters.max_views}</span></>
            )}
            {filters.max_watches !== undefined && filters.max_watches !== null && (
              <>, watches ≤ <span className="font-bold text-white">{filters.max_watches}</span></>
            )}
            {filters.max_impressions !== undefined && filters.max_impressions !== null && (
              <>, impressions ≤ <span className="font-bold text-white">{filters.max_impressions}</span></>
            )}
          </p>
        </div>
      )}
      
      {/* Search and Sort */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search listings..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="flex-1 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
        />
        <select
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value)
            setPage(1)
          }}
          className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
        >
          <option value="days_listed">Days Listed</option>
          <option value="quantity_sold">Sales</option>
          <option value="watch_count">Watches</option>
          <option value="view_count">Views</option>
          <option value="price">Price</option>
        </select>
        <button
          onClick={() => {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
            setPage(1)
          }}
          className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white hover:bg-zinc-800 transition-colors"
        >
          {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
        </button>
      </div>
      
      {/* Loading Skeleton */}
      {loading && listings.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-zinc-800 rounded-lg animate-pulse" />
            ))}
          </div>
          <p className="text-center text-zinc-500 mt-4">Loading listings...</p>
        </div>
      )}
      
      {/* Error State */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchListings}
            className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
          >
            Retry
          </button>
        </div>
      )}
      
      {/* Table */}
      {!loading && !error && listings.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="p-6">
            <ZombieTable
              zombies={listings}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              onSelectAll={handleSelectAll}
              onSourceChange={handleSourceChange}
              onAddToQueue={mode === 'low' ? handleAddToQueue : null}
              showAddToQueue={mode === 'low'}
              onMoveToZombies={null}
              showMoveToZombies={false}
            />
          </div>
        </div>
      )}
      
      {/* Empty State */}
      {!loading && !error && listings.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
          <p className="text-zinc-400">
            {mode === 'low' 
              ? 'No low-performing items found matching the filters.'
              : 'No listings found.'
            }
          </p>
        </div>
      )}
      
      {/* Pagination */}
      {!loading && !error && listings.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-zinc-400">
            Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalCount)} of {totalCount}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-zinc-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default LowPerformingResults

