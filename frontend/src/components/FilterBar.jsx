import { useState, useEffect } from 'react'
import { RotateCw } from 'lucide-react'

/**
 * OptListing 최종 좀비 분석 필터
 * 순서: 판매(Sales) → 관심(Watch) → 트래픽(Traffic)
 * eBay 셀러의 자연스러운 판단 흐름 반영
 */
function FilterBar({ onApplyFilter, onSync, loading, initialFilters = {} }) {
  // 1. 분석 기준 기간 (analytics_period_days)
  const [analysisPeriod, setAnalysisPeriod] = useState(initialFilters.analytics_period_days || 7)
  
  // 2. 기간 내 판매 건수 (max_sales)
  const [maxSales, setMaxSales] = useState(initialFilters.max_sales || 0)
  
  // 3. 찜하기 (max_watches)
  const [maxWatches, setMaxWatches] = useState(initialFilters.max_watches || 0)
  
  // 4. 총 노출 횟수 (max_impressions)
  const [maxImpressions, setMaxImpressions] = useState(initialFilters.max_impressions || 100)
  
  // 5. 총 조회 횟수 (max_views)
  const [maxViews, setMaxViews] = useState(initialFilters.max_views || 10)
  
  // 플랫폼 & 소스 필터
  const [marketplaceFilter, setMarketplaceFilter] = useState(initialFilters.marketplace_filter || 'eBay')
  const [sourceFilter, setSourceFilter] = useState(initialFilters.source_filter || 'All')
  
  // Advanced mode toggle
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Update state when initialFilters change
  useEffect(() => {
    setAnalysisPeriod(initialFilters.analytics_period_days || 7)
    setMaxSales(initialFilters.max_sales || 0)
    setMaxWatches(initialFilters.max_watches || 0)
    setMaxImpressions(initialFilters.max_impressions || 100)
    setMaxViews(initialFilters.max_views || 10)
    setMarketplaceFilter(initialFilters.marketplace_filter || 'eBay')
    setSourceFilter(initialFilters.source_filter || 'All')
  }, [initialFilters])

  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Ensure values are non-negative
    const safeAnalysisPeriod = Math.max(1, parseInt(analysisPeriod) || 7)
    const safeMaxSales = Math.max(0, parseInt(maxSales) || 0)
    const safeMaxWatches = Math.max(0, parseInt(maxWatches) || 0)
    const safeMaxImpressions = Math.max(0, parseInt(maxImpressions) || 100)
    const safeMaxViews = Math.max(0, parseInt(maxViews) || 10)
    
    onApplyFilter({
      analytics_period_days: safeAnalysisPeriod,
      min_days: safeAnalysisPeriod, // Legacy compatibility
      max_sales: safeMaxSales,
      max_watches: safeMaxWatches,
      max_watch_count: safeMaxWatches, // Legacy compatibility
      max_impressions: safeMaxImpressions,
      max_views: safeMaxViews,
      marketplace_filter: marketplaceFilter,
      source_filter: sourceFilter,
      supplier_filter: sourceFilter // Legacy compatibility
    })
  }

  const handleReset = () => {
    setAnalysisPeriod(7)
    setMaxSales(0)
    setMaxWatches(0)
    setMaxImpressions(100)
    setMaxViews(10)
    setMarketplaceFilter('eBay')
    setSourceFilter('All')
    
    onApplyFilter({
      analytics_period_days: 7,
      min_days: 7,
      max_sales: 0,
      max_watches: 0,
      max_watch_count: 0,
      max_impressions: 100,
      max_views: 10,
      marketplace_filter: 'eBay',
      source_filter: 'All',
      supplier_filter: 'All'
    })
  }

  const handleSync = () => {
    if (onSync) {
      onSync()
    }
  }

  // Calculate analysis date range
  const getDateRange = () => {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - (parseInt(analysisPeriod) || 7))
    
    const formatDate = (date) => date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    })
    
    return `${formatDate(startDate)} - ${formatDate(endDate)}`
  }

  // Filter input component - Wider Layout
  const FilterInput = ({ id, label, value, onChange, icon, unit, min = 0, step = 1 }) => (
    <div className="flex items-center gap-2 bg-zinc-900/50 rounded-lg px-3 py-2 border border-zinc-800 flex-1">
      <span className="text-sm">{icon}</span>
      <span className="text-xs text-zinc-500 uppercase font-medium">{label}</span>
      <input
        type="number"
        id={id}
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm font-bold text-center focus:outline-none focus:border-zinc-600"
      />
      {unit && <span className="text-xs text-zinc-600">{unit}</span>}
    </div>
  )

  return (
    <div className="opt-card p-4 opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
      <form onSubmit={handleSubmit}>
        {/* Filters Row - Wide Layout */}
        <div className="flex items-center gap-3 mb-4">
          {/* Filters - Spread out */}
          <FilterInput id="analysisPeriod" label="Days" value={analysisPeriod} onChange={setAnalysisPeriod} icon="📅" unit="d" min={1} />
          <FilterInput id="maxSales" label="Sales" value={maxSales} onChange={setMaxSales} icon="💰" />
          <FilterInput id="maxWatches" label="Watch" value={maxWatches} onChange={setMaxWatches} icon="❤️" />
          <FilterInput id="maxImpressions" label="Imp" value={maxImpressions} onChange={setMaxImpressions} icon="👁️" />
          <FilterInput id="maxViews" label="Views" value={maxViews} onChange={setMaxViews} icon="📊" />
          
          {/* Reset Button */}
          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="ml-auto px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-all"
          >
            Reset
          </button>
        </div>

        {/* Find Low-Interest Items Button - Large, Below */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-red-600 to-orange-500 text-white text-base font-bold rounded-xl hover:from-red-500 hover:to-orange-400 disabled:opacity-50 transition-all shadow-lg shadow-red-500/30"
        >
          {loading ? (
            <RotateCw className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span className="text-xl">🔍</span>
              <span>Find Low-Interest Items</span>
            </>
          )}
        </button>
      </form>
    </div>
  )
}

export default FilterBar
