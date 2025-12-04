import { useState, useEffect } from 'react'
import { Filter, RotateCw, ChevronDown, Info } from 'lucide-react'

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

  // Filter input component - Compact
  const FilterInput = ({ id, label, value, onChange, icon, tooltip, unit, min = 0, step = 1 }) => (
    <div className="relative group">
      <label htmlFor={id} className="flex items-center gap-1 text-xs font-medium text-zinc-500 mb-1">
        <span className="text-xs">{icon}</span>
        <span className="uppercase tracking-wide">{label}</span>
        {tooltip && (
          <Info className="w-3 h-3 text-zinc-600 cursor-help" title={tooltip} />
        )}
      </label>
      <div className="relative">
        <input
          type="number"
          id={id}
          min={min}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm font-bold focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
        />
        {unit && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-600">
            {unit}
          </span>
        )}
      </div>
    </div>
  )

  return (
    <div className="opt-card p-3 opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
      {/* Header with Action Buttons */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 flex items-center justify-center">
            <Filter className="w-3 h-3 text-red-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">Low Interest Filter</h3>
          </div>
        </div>
        
        {/* Right Side: Period Badge + Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Analysis Period Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
            <span className="text-xs text-zinc-500">Period:</span>
            <span className="text-xs font-bold text-white">{getDateRange()}</span>
          </div>
          
          {/* Reset Button */}
          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-medium rounded-lg hover:bg-zinc-700 hover:text-white disabled:opacity-50 transition-all"
          >
            Reset
          </button>
          
          {/* Sync Button */}
          <button
            type="button"
            onClick={handleSync}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-medium rounded-lg hover:bg-zinc-700 hover:text-white disabled:opacity-50 transition-all"
            title="Sync latest data from eBay"
          >
            <RotateCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Primary Filters Row - Compact */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
          {/* 1. 분석 기준 기간 */}
          <FilterInput
            id="analysisPeriod"
            label="Period"
            value={analysisPeriod}
            onChange={setAnalysisPeriod}
            icon="📅"
            tooltip="Analysis window in days"
            unit="days"
            min={1}
          />
          
          {/* 2. 기간 내 판매 건수 */}
          <FilterInput
            id="maxSales"
            label="Max Sales"
            value={maxSales}
            onChange={setMaxSales}
            icon="💰"
            tooltip="Maximum sales in period (0 = no sales)"
            unit="qty"
          />
          
          {/* 3. 찜하기 */}
          <FilterInput
            id="maxWatches"
            label="Max Watches"
            value={maxWatches}
            onChange={setMaxWatches}
            icon="❤️"
            tooltip="Maximum watch/save count"
            unit="qty"
          />
          
          {/* 4. 총 노출 횟수 */}
          <FilterInput
            id="maxImpressions"
            label="Max Impressions"
            value={maxImpressions}
            onChange={setMaxImpressions}
            icon="👁️"
            tooltip="Maximum search impressions"
            unit="views"
          />
          
          {/* 5. 총 조회 횟수 */}
          <FilterInput
            id="maxViews"
            label="Max Views"
            value={maxViews}
            onChange={setMaxViews}
            icon="📊"
            tooltip="Maximum page views"
            unit="views"
          />
        </div>

        {/* Advanced Filters Toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 mb-4 transition-colors"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          <span>Advanced Filters</span>
        </button>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
            {/* Platform Filter */}
            <div>
              <label htmlFor="marketplaceFilter" className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                <span>🏪</span>
                <span>Platform</span>
              </label>
              <select
                id="marketplaceFilter"
                value={marketplaceFilter}
                onChange={(e) => setMarketplaceFilter(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white font-medium focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-zinc-500 transition-all cursor-pointer"
              >
                <option value="eBay">eBay</option>
                <option value="Shopify">Shopify</option>
              </select>
            </div>

            {/* Source Filter */}
            <div>
              <label htmlFor="sourceFilter" className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                <span>📦</span>
                <span>Supplier</span>
              </label>
              <select
                id="sourceFilter"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white font-medium focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-zinc-500 transition-all cursor-pointer"
              >
                <option value="All">All Sources</option>
                <option value="Amazon">Amazon</option>
                <option value="Walmart">Walmart</option>
                <option value="Home Depot">Home Depot</option>
                <option value="AliExpress">AliExpress</option>
                <option value="CJ Dropshipping">CJ Dropshipping</option>
                <option value="Wholesale2B">Wholesale2B</option>
                <option value="Costway">Costway</option>
              </select>
            </div>
          </div>
        )}

        {/* Filter Summary + Find Button - Inline */}
        <div className="flex items-center gap-3">
          <div className="flex-1 p-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <p className="text-xs text-zinc-400">
              <span className="text-zinc-500">Finding:</span>{' '}
              <span className="text-white">{maxSales} sales</span>,{' '}
              <span className="text-white">{maxWatches} watches</span>,{' '}
              <span className="text-white">&lt;{maxImpressions} imp</span>,{' '}
              <span className="text-white">&lt;{maxViews} views</span>{' '}
              <span className="text-zinc-500">in {analysisPeriod}d</span>
            </p>
          </div>

          {/* Find Button */}
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-red-600 to-orange-500 text-white text-sm font-bold rounded-lg hover:from-red-500 hover:to-orange-400 disabled:opacity-50 transition-all shadow-lg shadow-red-500/30"
          >
          {loading ? (
            <>
              <RotateCw className="w-4 h-4 animate-spin" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <span>🔬</span>
              <span>Find Zombies</span>
              <span>→</span>
            </>
          )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default FilterBar
