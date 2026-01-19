import React, { useState, useEffect, useRef, useMemo } from 'react'
import axios from 'axios'
import apiClient, { API_BASE_URL } from '../lib/api'
import ZombieTable from './ZombieTable'
import { normalizeImageUrl } from '../utils/imageUtils'

// Use environment variable for Railway URL, fallback based on environment
// CRITICAL: Production MUST use relative path /api (proxied by vercel.json) to avoid CORS issues
// Only use VITE_API_URL in development if needed, production always uses relative path
// API_BASE_URL은 api.js에서 import
// JWT 인증이 필요한 요청은 apiClient 사용, 인증이 필요 없는 요청(health check 등)은 axios 사용

function LowPerformingResults({ mode = 'low', initialFilters = null, initialItems = null, onClose = null, onError = null }) {
  // Filters from props (for low-performing mode) or defaults
  const filters = useMemo(() => {
    if (mode === 'low' && initialFilters) {
      return {
        analytics_period_days: initialFilters.analytics_period_days || initialFilters.min_days || 7,
        min_days: initialFilters.min_days || initialFilters.analytics_period_days || 7,
        max_sales: initialFilters.max_sales || 0,
        max_watches: initialFilters.max_watches || initialFilters.max_watch_count || 0,
        max_watch_count: initialFilters.max_watch_count || initialFilters.max_watches || 0,
        max_impressions: initialFilters.max_impressions || 100,
        max_views: initialFilters.max_views || 10
      }
    }
    return {}
  }, [mode, initialFilters])
  
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
      // user_id는 JWT 인증으로 자동 추출되므로 파라미터에서 제거
      const params = {
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
      
      // JWT 인증이 필요한 요청은 apiClient 사용 (Authorization 헤더 자동 추가)
      const response = await apiClient.get(`/api/ebay/listings/active`, {
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
  
  // 초기 items가 있으면 사용 (서버 호출 생략)
  // initialItems가 변경될 때만 listings 업데이트
  useEffect(() => {
    if (initialItems && Array.isArray(initialItems) && initialItems.length > 0) {
      console.log('📦 LowPerformingResults: Using initial items from analysis result', initialItems.length)
      // Transform initial items (한 번만 수행)
      const transformedListings = initialItems.map((item, index) => {
        const supplierInfo = extractSupplierInfo(item.title, item.sku, item.image_url)
        const rawImageUrl = item.image_url
        const normalizedImageUrl = normalizeImageUrl(rawImageUrl)
        
        return {
          id: item.item_id || item.id || `ebay-${index}`,
          item_id: item.item_id || item.ebay_item_id || item.id,
          ebay_item_id: item.ebay_item_id || item.item_id || item.id,
          sell_item_id: item.sell_item_id || item.item_id || item.ebay_item_id || item.id,
          title: item.title,
          price: item.price,
          sku: item.sku,
          supplier: supplierInfo.supplier_name,
          supplier_name: supplierInfo.supplier_name,
          supplier_id: supplierInfo.supplier_id,
          source: item.source || supplierInfo.supplier_name,
          total_sales: item.total_sales || item.quantity_sold || 0,
          quantity_sold: item.quantity_sold || item.total_sales || 0,
          watch_count: item.watch_count || 0,
          view_count: item.view_count || item.views || 0,
          views: item.views || item.view_count || 0,
          impressions: item.impressions || 0,
          days_listed: item.days_listed || 0,
          start_time: item.start_time,
          picture_url: item.image_url,
          thumbnail_url: item.image_url,
          image_url: normalizedImageUrl || rawImageUrl,
          is_zombie: true
        }
      })
      
      setListings(transformedListings)
      setTotalCount(initialItems.length)
      setLoading(false)
      setError(null)
      setPage(1) // Reset to page 1 when initial items loaded
      return
    }
    
    // initialItems가 없거나 빈 배열이면 서버에서 가져오기
    if (!initialItems || (Array.isArray(initialItems) && initialItems.length === 0)) {
      fetchListings()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialItems]) // initialItems가 변경될 때만 실행
  
  // 페이지네이션/검색/정렬 변경 시 (initialItems가 없을 때만 서버 호출)
  useEffect(() => {
    // initialItems가 있으면 클라이언트 측 필터링만 수행 (이미 listings state에 있음)
    if (initialItems && Array.isArray(initialItems) && initialItems.length > 0) {
      return // 클라이언트 측 필터링만 수행 (useMemo에서 처리)
    }
    
    // initialItems가 없으면 서버에서 가져오기
    fetchListings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, page, pageSize, search, sortBy, sortOrder])
  
  // 필터 변경 시 (initialItems가 없을 때만)
  useEffect(() => {
    if (mode === 'low' && (!initialItems || (Array.isArray(initialItems) && initialItems.length === 0))) {
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
      if (onError) {
        const errorMsg = err.code === 'ERR_NETWORK' 
          ? 'Network error. Please check your connection.'
          : err.response?.status === 401 || err.response?.status === 403
          ? 'Please reconnect your eBay account.'
          : err.response?.status >= 500
          ? 'Server error. Try again later.'
          : 'Failed to update source. Please try again.'
        onError(errorMsg, err)
      }
    }
  }
  
  const handleSelect = (id, checked) => {
    if (checked) {
      setSelectedIds([...selectedIds, id])
    } else {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id))
    }
  }
  
  const handleAddToQueue = () => {
    // TODO: Implement queue functionality (navigate to dashboard with queue items)
    console.log('Add to queue:', selectedIds)
    if (onError) {
      onError('Queue functionality will be implemented soon.', null)
    }
  }
  
  // 클라이언트 측 필터링/정렬/검색 (initialItems가 있을 때)
  const filteredAndSortedListings = useMemo(() => {
    let filtered = listings
    
    // 검색 필터
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(item => 
        item.title?.toLowerCase().includes(searchLower) ||
        item.sku?.toLowerCase().includes(searchLower) ||
        item.supplier_name?.toLowerCase().includes(searchLower)
      )
    }
    
    // 정렬
    if (sortBy) {
      filtered = [...filtered].sort((a, b) => {
        let aVal = a[sortBy] || 0
        let bVal = b[sortBy] || 0
        
        // 숫자 비교
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
        }
        
        // 문자열 비교
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortOrder === 'asc' 
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal)
        }
        
        return 0
      })
    }
    
    return filtered
  }, [listings, search, sortBy, sortOrder])
  
  // 페이지네이션
  const paginatedListings = useMemo(() => {
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredAndSortedListings.slice(startIndex, endIndex)
  }, [filteredAndSortedListings, page, pageSize])
  
  const totalPages = Math.ceil(filteredAndSortedListings.length / pageSize)
  const displayCount = filteredAndSortedListings.length
  
  // 전체 선택 핸들러 (paginatedListings 정의 후에 정의)
  const handleSelectAll = (checked) => {
    // 전체 선택: 현재 표시된 페이지의 모든 항목 선택
    if (checked) {
      setSelectedIds(paginatedListings.map(item => item.id))
    } else {
      setSelectedIds([])
    }
  }
  
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
              ? `Found ${displayCount} low-performing items${search ? ` (filtered from ${totalCount})` : ''}`
              : `Total ${displayCount} active listings${search ? ` (filtered from ${totalCount})` : ''}`
            }
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            ✕ 닫기
          </button>
        )}
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
      
      {/* Sort */}
      <div className="flex items-center gap-4">
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
      {!loading && !error && paginatedListings.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="p-6">
            <ZombieTable
              zombies={paginatedListings}
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
      {!loading && !error && paginatedListings.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
          <p className="text-zinc-400">
            {search
              ? `No items found matching "${search}".`
              : mode === 'low'
              ? 'No low-performing items found matching the filters.'
              : 'No listings found.'
            }
          </p>
        </div>
      )}
      
      {/* Pagination */}
      {!loading && !error && displayCount > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-zinc-400">
            Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, displayCount)} of {displayCount}
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

