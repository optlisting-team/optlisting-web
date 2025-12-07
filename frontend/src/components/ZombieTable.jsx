import { useState, useMemo, useRef, useEffect } from 'react'
import SourceBadge from './SourceBadge'
import PlatformBadge from './PlatformBadge'
import { AlertTriangle, TrendingDown, Trash2, Eye, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, Info } from 'lucide-react'

// Calculate Performance Score based on metrics
// Lower score = Lower performance (Zombie)
// Higher score = Higher performance (Good)
function calculateZombieScore(listing) {
  let score = 100 // Start with perfect score
  
  // Age factor (subtract up to 30 points for old listings)
  const dateListed = listing.date_listed || listing.metrics?.date_listed
  if (dateListed) {
    const ageInDays = Math.floor((new Date() - new Date(dateListed)) / (1000 * 60 * 60 * 24))
    score -= Math.min(30, Math.floor(ageInDays / 3))
  } else {
    score -= 15 // Default penalty if no date
  }
  
  // Sales factor (subtract up to 30 points for low sales)
  const sales = listing.sold_qty || listing.metrics?.sales?.total_sales || listing.metrics?.sales || 0
  score -= Math.max(0, 30 - (sales * 10))
  
  // Watch/Interest factor (subtract up to 20 points for low watches)
  const watches = listing.watch_count || listing.metrics?.watches?.total_watches || listing.metrics?.watches || 0
  score -= Math.max(0, 20 - (watches * 4))
  
  // Views factor (subtract up to 20 points for low views)
  const views = listing.metrics?.views?.total_views || listing.metrics?.views || 0
  score -= Math.max(0, 20 - Math.floor(views / 5))
  
  return Math.min(100, Math.max(0, score))
}

// Get recommendation based on zombie score and listing data
function getRecommendation(listing, score) {
  // Check for special flags first
  if (listing.is_global_winner) {
    return { action: 'REVIEW', color: 'amber', icon: Eye, text: 'Review - Global Winner' }
  }
  if (listing.is_active_elsewhere) {
    return { action: 'REVIEW', color: 'orange', icon: AlertTriangle, text: 'Review - Active Elsewhere' }
  }
  
  // Score-based recommendations (Lower score = Lower performance)
  if (score <= 20) {
    return { action: 'DELETE', color: 'red', icon: Trash2, text: 'Delete Immediately' }
  } else if (score <= 40) {
    return { action: 'DELETE', color: 'red', icon: Trash2, text: 'Recommend Delete' }
  } else if (score <= 60) {
    return { action: 'OPTIMIZE', color: 'yellow', icon: RefreshCw, text: 'Optimize Listing' }
  } else {
    return { action: 'MONITOR', color: 'blue', icon: TrendingDown, text: 'Monitor' }
  }
}

// Zombie Score Badge Component
function ZombieScoreBadge({ score }) {
  const getScoreColor = (score) => {
    if (score <= 20) return 'bg-red-500/20 text-red-400 border-red-500/30'
    if (score <= 40) return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    if (score <= 60) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  }
  
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border ${getScoreColor(score)}`}>
      <div className="relative w-6 h-1 bg-zinc-700 rounded-full overflow-hidden">
        <div 
          className={`absolute left-0 top-0 h-full rounded-full transition-all ${
            score <= 20 ? 'bg-red-500' : score <= 40 ? 'bg-orange-500' : score <= 60 ? 'bg-yellow-500' : 'bg-blue-500'
          }`}
          style={{ width: `${100 - score}%` }}
        />
      </div>
      <span className="text-[10px] font-bold data-value">{score}</span>
    </div>
  )
}

// Recommendation Badge Component
function RecommendationBadge({ recommendation }) {
  const Icon = recommendation.icon
  const colorMap = {
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  }
  
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border ${colorMap[recommendation.color]}`}>
      <Icon className="w-3 h-3" />
      <span className="text-[10px] font-semibold">{recommendation.text}</span>
    </div>
  )
}

function ZombieTable({ zombies, selectedIds, onSelect, onSelectAll, onSourceChange, onAddToQueue, showAddToQueue = false, onMoveToZombies, showMoveToZombies = false }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(50)
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc') // 'asc' or 'desc'
  const [showScoreTooltip, setShowScoreTooltip] = useState(false)
  const scoreTooltipRef = useRef(null)
  
  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (scoreTooltipRef.current && !scoreTooltipRef.current.contains(event.target)) {
        setShowScoreTooltip(false)
      }
    }
    
    if (showScoreTooltip) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showScoreTooltip])

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatPrice = (price) => {
    if (!price && price !== 0) return 'N/A'
    return `$${Number(price).toFixed(2)}`
  }

  const getManagementHubTooltip = (listing) => {
    const platform = listing.marketplace || 'eBay'
    const managementHub = listing.management_hub

    if (managementHub === 'Shopify') {
      return `Listed on ${platform}, Managed by Shopify Hub.`
    } else if (managementHub === 'eBay Direct') {
      return 'Direct listing via eBay File Exchange.'
    } else if (managementHub === null || managementHub === undefined || managementHub === 'self' || managementHub === 'OptListing') {
      return 'Managed directly by OptListing.'
    } else {
      return `Listed on ${platform}, Managed by ${managementHub}.`
    }
  }

  // Process zombies with scores and recommendations
  const processedZombies = useMemo(() => {
    return zombies.map(zombie => {
      const score = calculateZombieScore(zombie)
      const recommendation = getRecommendation(zombie, score)
      return { ...zombie, zombieScore: score, recommendation }
    })
  }, [zombies])

  // Filter zombies based on search query
  const filteredZombies = useMemo(() => {
    let filtered = processedZombies
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(zombie => {
        const title = (zombie.title || '').toLowerCase()
        const sku = (zombie.sku || '').toLowerCase()
        const itemId = ((zombie.ebay_item_id || zombie.item_id) || '').toLowerCase()
        
        return title.includes(query) || sku.includes(query) || itemId.includes(query)
      })
    }
    
    // Apply sorting
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let aValue, bValue
        
        switch (sortColumn) {
          case 'platform':
            aValue = (a.marketplace || a.platform || '').toLowerCase()
            bValue = (b.marketplace || b.platform || '').toLowerCase()
            break
          case 'sku':
            aValue = (a.sku || '').toLowerCase()
            bValue = (b.sku || '').toLowerCase()
            break
          case 'itemId':
            aValue = ((a.ebay_item_id || a.item_id) || '').toLowerCase()
            bValue = ((b.ebay_item_id || b.item_id) || '').toLowerCase()
            break
          case 'title':
            aValue = (a.title || '').toLowerCase()
            bValue = (b.title || '').toLowerCase()
            break
          case 'performanceScore':
            aValue = a.zombieScore ?? 0
            bValue = b.zombieScore ?? 0
            break
          case 'recommendation':
            aValue = (a.recommendation?.text || '').toLowerCase()
            bValue = (b.recommendation?.text || '').toLowerCase()
            break
          case 'supplier':
            aValue = (a.supplier_name || a.supplier || '').toLowerCase()
            bValue = (b.supplier_name || b.supplier || '').toLowerCase()
            break
          case 'price':
            aValue = parseFloat(a.price || 0)
            bValue = parseFloat(b.price || 0)
            break
          case 'age':
            aValue = a.days_listed || 0
            bValue = b.days_listed || 0
            break
          case 'sales':
            aValue = a.total_sales || a.quantity_sold || 0
            bValue = b.total_sales || b.quantity_sold || 0
            break
          case 'watches':
            aValue = a.watch_count || 0
            bValue = b.watch_count || 0
            break
          case 'impressions':
            aValue = a.impressions || 0
            bValue = b.impressions || 0
            break
          case 'views':
            aValue = a.views || a.view_count || 0
            bValue = b.views || b.view_count || 0
            break
          default:
            return 0
        }
        
        // Handle string comparison
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          if (sortDirection === 'asc') {
            return aValue.localeCompare(bValue)
          } else {
            return bValue.localeCompare(aValue)
          }
        }
        
        // Handle number comparison
        if (sortDirection === 'asc') {
          return aValue - bValue
        } else {
          return bValue - aValue
        }
      })
    }
    
    return filtered
  }, [processedZombies, searchQuery, sortColumn, sortDirection])
  
  // Handle column sort
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, default to ascending
      setSortColumn(column)
      setSortDirection('asc')
    }
  }
  
  // Get sort icon for column
  const getSortIcon = (column) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3.5 h-3.5 text-zinc-300" />
      : <ArrowDown className="w-3.5 h-3.5 text-zinc-300" />
  }

  // Calculate pagination
  const totalPages = Math.ceil(filteredZombies.length / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const visibleZombies = filteredZombies.slice(startIndex, endIndex)

  // Reset to page 1 when search query changes
  useMemo(() => {
    setCurrentPage(1)
  }, [searchQuery])

  // Handle select all for current page only
  const handleSelectAllPage = (checked) => {
    if (checked) {
      const pageIds = visibleZombies.map(z => z.id)
      const newSelectedIds = [...new Set([...selectedIds, ...pageIds])]
      onSelectAll(newSelectedIds)
    } else {
      const pageIds = visibleZombies.map(z => z.id)
      const newSelectedIds = selectedIds.filter(id => !pageIds.includes(id))
      onSelectAll(newSelectedIds)
    }
  }

  const allVisibleSelected = visibleZombies.length > 0 && visibleZombies.every(z => selectedIds.includes(z.id))
  const someVisibleSelected = visibleZombies.some(z => selectedIds.includes(z.id))

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
    }
  }

  return (
    <div className="w-full">
      {/* Search, Selection Info, and Action Controls */}
      <div className="flex items-center justify-between gap-4 mb-4">
        {/* Left: Action Buttons & Selection Info */}
        <div className="flex items-center gap-3">
          {showAddToQueue && (
            <button
              onClick={onAddToQueue}
              disabled={selectedIds.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-zinc-800 to-zinc-700 text-white text-sm font-semibold rounded-lg hover:from-zinc-700 hover:to-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all border border-zinc-600"
            >
              <span>Add to CSV</span>
              <span>➡️</span>
              {selectedIds.length > 0 && (
                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs font-bold">
                  {selectedIds.length}
                </span>
              )}
            </button>
          )}
          {showMoveToZombies && (
            <button
              onClick={() => onMoveToZombies()}
              disabled={selectedIds.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-orange-500 text-white text-sm font-semibold rounded-lg hover:from-red-500 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md"
            >
              <span>📉</span>
              <span>Mark as Low-Performing</span>
              {selectedIds.length > 0 && (
                <span className="px-1.5 py-0.5 bg-white/20 rounded text-xs font-bold">
                  {selectedIds.length}
                </span>
              )}
            </button>
          )}
          {selectedIds.length > 0 && (
            <div className="text-sm text-emerald-400 font-medium">
              ✓ {selectedIds.length} selected
            </div>
          )}
        </div>

        {/* Center: Search */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by title, SKU, or Item ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
        
        {/* Right: Results Info & Rows per page */}
        <div className="flex items-center gap-4">
          <div className="text-sm text-zinc-500">
            Showing <span className="text-white font-medium data-value">{startIndex + 1}-{Math.min(endIndex, filteredZombies.length)}</span> of <span className="text-white font-medium data-value">{filteredZombies.length}</span>
          </div>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value))
              setCurrentPage(1)
            }}
            className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-zinc-500"
          >
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-zinc-800 table-fixed">
            <thead className="bg-zinc-900/50">
              <tr>
                <th className="px-2 py-3 text-left w-12">
                  {someVisibleSelected && !allVisibleSelected ? (
                    <button
                      onClick={() => handleSelectAllPage(false)}
                      className="w-5 h-5 rounded border border-zinc-600 bg-blue-500 flex items-center justify-center"
                      title="Clear selection"
                    >
                      <div className="w-3 h-0.5 bg-white rounded"></div>
                    </button>
                  ) : (
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(e) => handleSelectAllPage(e.target.checked)}
                      className="w-5 h-5 rounded border-zinc-600 text-white focus:ring-white bg-zinc-800 cursor-pointer"
                    />
                  )}
                </th>
                {/* Column order: Platform → SKU → Item ID → Title → Score → Filter order (Age → Sales → Watch → Imp → Views) → Recommendation → Supplier → Price */}
                <th 
                  className="px-2 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-zinc-800/50 transition-colors w-20"
                  onClick={() => handleSort('platform')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Platform</span>
                    {getSortIcon('platform')}
                  </div>
                </th>
                <th 
                  className="px-2 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-zinc-800/50 transition-colors w-24"
                  onClick={() => handleSort('sku')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>SKU</span>
                    {getSortIcon('sku')}
                  </div>
                </th>
                <th 
                  className="px-2 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-zinc-800/50 transition-colors w-28"
                  onClick={() => handleSort('itemId')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Item ID</span>
                    {getSortIcon('itemId')}
                  </div>
                </th>
                <th 
                  className="px-2 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-zinc-800/50 transition-colors w-40"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Title</span>
                    {getSortIcon('title')}
                  </div>
                </th>
                <th 
                  className="px-2 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-zinc-800/50 transition-colors w-32"
                  onClick={() => handleSort('performanceScore')}
                >
                  <div className="flex items-center gap-1.5">
                    <div className="relative" ref={scoreTooltipRef}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowScoreTooltip(!showScoreTooltip)
                        }}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                      
                      {/* Tooltip */}
                      {showScoreTooltip && (
                        <div className="absolute left-0 top-full mt-2 w-64 bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-xl z-50">
                          <h4 className="text-xs font-bold text-white mb-2">Performance Score</h4>
                          <div className="text-xs text-zinc-400 space-y-1.5">
                            <p className="text-zinc-300 font-medium">Lower score = Lower performance</p>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span>0-20:</span>
                                <span className="text-red-400">Delete</span>
                              </div>
                              <div className="flex justify-between">
                                <span>21-40:</span>
                                <span className="text-orange-400">Recommend Delete</span>
                              </div>
                              <div className="flex justify-between">
                                <span>41-60:</span>
                                <span className="text-yellow-400">Optimize</span>
                              </div>
                              <div className="flex justify-between">
                                <span>61-100:</span>
                                <span className="text-blue-400">Monitor</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="text-red-400">Score</span>
                    {getSortIcon('performanceScore')}
                  </div>
                </th>
                {/* Filter order: Days (Age) → Sales → Watches → Impressions → Views */}
                <th 
                  className="px-2 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-zinc-800/50 transition-colors w-16"
                  onClick={() => handleSort('age')}
                >
                  <div className="flex items-center gap-1.5">
                    <span title="Days Listed">Age</span>
                    {getSortIcon('age')}
                  </div>
                </th>
                <th 
                  className="px-2 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-zinc-800/50 transition-colors w-16"
                  onClick={() => handleSort('sales')}
                >
                  <div className="flex items-center gap-1.5">
                    <span title="Total Sales">Sales</span>
                    {getSortIcon('sales')}
                  </div>
                </th>
                <th 
                  className="px-2 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-zinc-800/50 transition-colors w-20"
                  onClick={() => handleSort('watches')}
                >
                  <div className="flex items-center gap-1.5">
                    <span title="Watch Count">Watch</span>
                    {getSortIcon('watches')}
                  </div>
                </th>
                <th 
                  className="px-2 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-zinc-800/50 transition-colors w-16"
                  onClick={() => handleSort('impressions')}
                >
                  <div className="flex items-center gap-1.5">
                    <span title="Search Impressions">Imp</span>
                    {getSortIcon('impressions')}
                  </div>
                </th>
                <th 
                  className="px-2 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-zinc-800/50 transition-colors w-16"
                  onClick={() => handleSort('views')}
                >
                  <div className="flex items-center gap-1.5">
                    <span title="Page Views">Views</span>
                    {getSortIcon('views')}
                  </div>
                </th>
                <th 
                  className="px-2 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-zinc-800/50 transition-colors w-24"
                  onClick={() => handleSort('supplier')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Supplier</span>
                    {getSortIcon('supplier')}
                  </div>
                </th>
                <th className="px-2 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider w-20">
                  <span>VIA</span>
                </th>
                <th 
                  className="px-2 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-zinc-800/50 transition-colors w-20"
                  onClick={() => handleSort('price')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Price</span>
                    {getSortIcon('price')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {visibleZombies.map((zombie) => (
                <tr 
                  key={zombie.id} 
                  className={`hover:bg-zinc-800/50 transition-colors ${
                    selectedIds.includes(zombie.id) ? 'bg-zinc-800/30' : ''
                  }`}
                >
                  <td className="px-2 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(zombie.id)}
                      onChange={(e) => onSelect(zombie.id, e.target.checked)}
                      className="w-5 h-5 rounded border-zinc-600 text-white focus:ring-white bg-zinc-800 cursor-pointer"
                    />
                  </td>
                  {/* Column order: Platform → SKU → Item ID → Title → Score → Filter order (Age → Sales → Watch → Imp → Views) → Recommendation → Supplier → Price */}
                  <td className="px-2 py-4">
                    <div className="relative group inline-block">
                      <PlatformBadge marketplace={zombie.marketplace || 'eBay'} />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none whitespace-nowrap z-50">
                        {getManagementHubTooltip(zombie)}
                      </div>
                    </div>
                  </td>
                  <td 
                    className="px-2 py-4 text-xs font-mono text-zinc-400 group cursor-pointer hover:bg-zinc-800/50 transition-colors relative"
                    title={`SKU: ${zombie.sku || 'N/A'}\n클릭 시 SKU가 클립보드에 복사됩니다.`}
                    onClick={() => {
                      if (zombie.sku) {
                        navigator.clipboard.writeText(zombie.sku)
                      }
                    }}
                  >
                    {zombie.sku || '-'}
                  </td>
                  <td className="px-2 py-4 text-xs font-mono text-zinc-300">
                    {zombie.ebay_item_id || zombie.item_id || 'N/A'}
                  </td>
                  <td className="px-2 py-4 max-w-[150px]">
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-white truncate block" title={zombie.title}>
                        {zombie.title && zombie.title.length > 30 
                          ? `${zombie.title.substring(0, 30)}...` 
                          : zombie.title}
                      </span>
                      {zombie.is_active_elsewhere && (
                        <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                          🔴 ACTIVE
                        </span>
                      )}
                      {zombie.is_global_winner && (
                        <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          ⚠️ WINNER
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-4">
                    <ZombieScoreBadge score={zombie.zombieScore} />
                  </td>
                  {/* Filter order: Days (Age) → Sales → Watches → Impressions → Views */}
                  <td className="px-2 py-4 text-sm text-zinc-400 text-center">
                    {zombie.days_listed || 'N/A'}d
                  </td>
                  <td className="px-2 py-4 text-sm text-zinc-400 data-value text-center">
                    {zombie.total_sales || 0}
                  </td>
                  <td className="px-2 py-4 text-sm text-zinc-400 data-value text-center">
                    {zombie.watch_count || 0}
                  </td>
                  <td className="px-2 py-4 text-sm text-zinc-400 data-value text-center">
                    {zombie.impressions || 0}
                  </td>
                  <td className="px-2 py-4 text-sm text-zinc-400 data-value text-center">
                    {zombie.views || 0}
                  </td>
                  <td className="px-2 py-4">
                    <div className="flex flex-col gap-1.5">
                      <div 
                        className="group relative inline-block"
                        title={zombie.supplier_name || zombie.supplier || "Unknown"}
                      >
                        <SourceBadge 
                          source={zombie.supplier_name || zombie.supplier || "Unknown"} 
                          editable={!!onSourceChange}
                          onSourceChange={onSourceChange}
                          itemId={zombie.id}
                        />
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                          {zombie.supplier_name || zombie.supplier || "Unknown"}
                        </div>
                      </div>
                      {/* Show "via Shopify" badge if product goes through Shopify */}
                      {(() => {
                        // Check multiple possible fields for Shopify indication
                        const isShopify = 
                          zombie.management_hub === 'Shopify' || 
                          zombie.marketplace === 'Shopify' ||
                          zombie.platform === 'Shopify' ||
                          (zombie.raw_data && typeof zombie.raw_data === 'object' && zombie.raw_data.management_hub === 'Shopify') ||
                          (zombie.analysis_meta && typeof zombie.analysis_meta === 'object' && zombie.analysis_meta.management_hub === 'Shopify') ||
                          (zombie.metrics && typeof zombie.metrics === 'object' && zombie.metrics.management_hub === 'Shopify')
                        
                        return isShopify ? (
                          <span className="inline-block px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded text-[10px] font-medium whitespace-nowrap">
                            via Shopify
                          </span>
                        ) : null
                      })()}
                    </div>
                  </td>
                  <td className="px-2 py-4 text-xs text-white data-value">
                    {formatPrice(zombie.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors"
          >
            Previous
          </button>
          
          <div className="flex items-center gap-2">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (currentPage <= 3) {
                pageNum = i + 1
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = currentPage - 2 + i
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === pageNum
                      ? 'bg-white text-black'
                      : 'bg-zinc-900 border border-zinc-700 text-white hover:bg-zinc-800'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}
          </div>
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

export default ZombieTable
