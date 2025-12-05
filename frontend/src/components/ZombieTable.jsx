import { useState, useMemo } from 'react'
import SourceBadge from './SourceBadge'
import PlatformBadge from './PlatformBadge'
import { AlertTriangle, TrendingDown, Trash2, Eye, RefreshCw } from 'lucide-react'

// Calculate zombie score based on metrics
function calculateZombieScore(listing) {
  let score = 0
  
  // Age factor (max 30 points)
  const dateListed = listing.date_listed || listing.metrics?.date_listed
  if (dateListed) {
    const ageInDays = Math.floor((new Date() - new Date(dateListed)) / (1000 * 60 * 60 * 24))
    score += Math.min(30, Math.floor(ageInDays / 3))
  } else {
    score += 15 // Default if no date
  }
  
  // Sales factor (max 30 points - inverted, 0 sales = 30 points)
  const sales = listing.sold_qty || listing.metrics?.sales?.total_sales || listing.metrics?.sales || 0
  score += Math.max(0, 30 - (sales * 10))
  
  // Watch/Interest factor (max 20 points - inverted)
  const watches = listing.watch_count || listing.metrics?.watches?.total_watches || listing.metrics?.watches || 0
  score += Math.max(0, 20 - (watches * 4))
  
  // Views factor (max 20 points - inverted)
  const views = listing.metrics?.views?.total_views || listing.metrics?.views || 0
  score += Math.max(0, 20 - Math.floor(views / 5))
  
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
  
  // Score-based recommendations
  if (score >= 80) {
    return { action: 'DELETE', color: 'red', icon: Trash2, text: 'Delete Immediately' }
  } else if (score >= 60) {
    return { action: 'DELETE', color: 'red', icon: Trash2, text: 'Recommend Delete' }
  } else if (score >= 40) {
    return { action: 'OPTIMIZE', color: 'yellow', icon: RefreshCw, text: 'Optimize Listing' }
  } else {
    return { action: 'MONITOR', color: 'blue', icon: TrendingDown, text: 'Monitor' }
  }
}

// Zombie Score Badge Component
function ZombieScoreBadge({ score }) {
  const getScoreColor = (score) => {
    if (score >= 80) return 'bg-red-500/20 text-red-400 border-red-500/30'
    if (score >= 60) return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    if (score >= 40) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  }
  
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${getScoreColor(score)}`}>
      <div className="relative w-8 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div 
          className={`absolute left-0 top-0 h-full rounded-full transition-all ${
            score >= 80 ? 'bg-red-500' : score >= 60 ? 'bg-orange-500' : score >= 40 ? 'bg-yellow-500' : 'bg-blue-500'
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-bold data-value">{score}</span>
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
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${colorMap[recommendation.color]}`}>
      <Icon className="w-3.5 h-3.5" />
      <span className="text-xs font-semibold">{recommendation.text}</span>
    </div>
  )
}

function ZombieTable({ zombies, selectedIds, onSelect, onSelectAll, onSourceChange, onAddToQueue, showAddToQueue = false, onMoveToZombies, showMoveToZombies = false }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(50)

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
    if (!searchQuery.trim()) return processedZombies
    
    const query = searchQuery.toLowerCase()
    return processedZombies.filter(zombie => {
      const title = (zombie.title || '').toLowerCase()
      const sku = (zombie.sku || '').toLowerCase()
      const itemId = ((zombie.ebay_item_id || zombie.item_id) || '').toLowerCase()
      
      return title.includes(query) || sku.includes(query) || itemId.includes(query)
    })
  }, [processedZombies, searchQuery])

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
              <span>🧟</span>
              <span>Move to Zombies</span>
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
          <table className="min-w-full divide-y divide-zinc-800">
            <thead className="bg-zinc-900/50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={el => el && (el.indeterminate = someVisibleSelected && !allVisibleSelected)}
                    onChange={(e) => handleSelectAllPage(e.target.checked)}
                    className="rounded border-zinc-600 text-white focus:ring-white bg-zinc-800"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Platform
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Item ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider max-w-xs">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  <span className="text-red-400">Zombie Score</span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  {showMoveToZombies ? 'Action' : 'Recommendation'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Age
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Watches
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
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(zombie.id)}
                      onChange={(e) => onSelect(zombie.id, e.target.checked)}
                      className="rounded border-zinc-600 text-white focus:ring-white bg-zinc-800"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="relative group inline-block">
                      <PlatformBadge marketplace={zombie.marketplace || 'eBay'} />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none whitespace-nowrap z-50">
                        {getManagementHubTooltip(zombie)}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm font-mono text-zinc-400">
                    {zombie.sku || '-'}
                  </td>
                  <td className="px-4 py-4 text-sm font-mono text-zinc-300">
                    {zombie.ebay_item_id || zombie.item_id || 'N/A'}
                  </td>
                  <td className="px-4 py-4 max-w-xs">
                    <div className="flex items-start gap-2">
                      <span className="text-sm text-white truncate" title={zombie.title}>
                        {zombie.title}
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
                  <td className="px-4 py-4">
                    <ZombieScoreBadge score={zombie.zombieScore} />
                  </td>
                  <td className="px-4 py-4">
                    {showMoveToZombies ? (
                      <button
                        onClick={() => onMoveToZombies(zombie.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-semibold hover:bg-red-500/30 transition-all"
                      >
                        <span>🧟</span>
                        <span>To Zombie</span>
                      </button>
                    ) : (
                      <RecommendationBadge recommendation={zombie.recommendation} />
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <SourceBadge 
                      source={zombie.supplier_name || zombie.supplier || "Unknown"} 
                      editable={!!onSourceChange}
                      onSourceChange={onSourceChange}
                      itemId={zombie.id}
                    />
                  </td>
                  <td className="px-4 py-4 text-sm text-white data-value">
                    {formatPrice(zombie.price)}
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-400">
                    {formatDate(zombie.date_listed)}
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-400 data-value">
                    {zombie.watch_count || 0}
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
