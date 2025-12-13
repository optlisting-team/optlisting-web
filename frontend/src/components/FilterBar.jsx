import { useState, useEffect, useRef } from 'react'
import { RotateCw, Info } from 'lucide-react'

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
  
  // Performance Score tooltip
  const [showScoreTooltip, setShowScoreTooltip] = useState(false)
  const tooltipRef = useRef(null)
  
  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
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
    console.log('🔍 FilterBar handleSubmit 호출됨 - Find Low-Performing SKUs 버튼 클릭')
    
    // Ensure values are non-negative
    const safeAnalysisPeriod = Math.max(1, parseInt(analysisPeriod) || 7)
    const safeMaxSales = Math.max(0, parseInt(maxSales) || 0)
    const safeMaxWatches = Math.max(0, parseInt(maxWatches) || 0)
    const safeMaxImpressions = Math.max(0, parseInt(maxImpressions) || 100)
    const safeMaxViews = Math.max(0, parseInt(maxViews) || 10)
    
    const filterParams = {
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
    }
    
    console.log('📋 필터 파라미터:', filterParams)
    console.log('🔄 onApplyFilter 호출 중...')
    
    if (onApplyFilter) {
      onApplyFilter(filterParams)
    } else {
      console.error('❌ onApplyFilter가 정의되지 않음!')
    }
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
    <div className="flex items-center gap-2 bg-zinc-900/50 rounded-lg px-3 py-2 border border-zinc-800 flex-1 min-w-0">
      <span className="text-sm flex-shrink-0">{icon}</span>
      <span className="text-xs text-zinc-500 uppercase font-medium whitespace-nowrap flex-shrink-0">{label}</span>
      <input
        type="number"
        id={id}
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm font-bold text-center focus:outline-none focus:border-zinc-600"
      />
      {unit && <span className="text-xs text-zinc-600 flex-shrink-0">{unit}</span>}
    </div>
  )

  return (
    <div className="opt-card p-4 opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
      <form onSubmit={handleSubmit}>
        {/* Header with Performance Score Info */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400 font-medium">Filter Settings</span>
          </div>
          <div className="relative" ref={tooltipRef}>
            <button
              type="button"
              onClick={() => setShowScoreTooltip(!showScoreTooltip)}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <Info className="w-4 h-4" />
              <span>Performance Score</span>
            </button>
            
            {/* Tooltip */}
            {showScoreTooltip && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-zinc-800 border border-zinc-700 rounded-lg p-4 shadow-xl z-50">
                <h4 className="text-sm font-bold text-white mb-2">Performance Score Calculation</h4>
                <div className="text-xs text-zinc-400 space-y-2">
                  <p className="text-zinc-300 font-medium mb-2">Score is calculated from 4 factors (0-100 points):</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span>• Listing Age:</span>
                      <span className="text-zinc-500">Subtract up to 30 points</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Sales Volume:</span>
                      <span className="text-zinc-500">Subtract up to 30 points</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Watch Count:</span>
                      <span className="text-zinc-500">Subtract up to 20 points</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• View Count:</span>
                      <span className="text-zinc-500">Subtract up to 20 points</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-zinc-700">
                    <p className="text-zinc-300 font-medium mb-1">Lower score = Lower performance (Zombie)</p>
                    <p className="text-zinc-500 text-[10px]">0-20: Delete | 21-40: Recommend Delete | 41-60: Optimize | 61-100: Monitor</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Filters Row - Wide Layout */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
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
            className="flex-shrink-0 px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-all whitespace-nowrap"
          >
            Reset
          </button>
        </div>

        {/* Find Low-Interest Items Button - Large, Below */}
        <div className="relative group">
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-red-600 to-orange-500 text-white text-base font-bold rounded-xl hover:from-red-500 hover:to-orange-400 disabled:opacity-50 transition-all shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40 hover:-translate-y-0.5"
            title="현재 필터 설정으로 분석을 시작합니다. 클릭 시 유통 경로 분석 결과를 확인합니다."
          >
            {loading ? (
              <RotateCw className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span className="text-xl">🔍</span>
                <span>Find Low-Performing SKUs</span>
              </>
            )}
          </button>
          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            현재 필터 설정으로 분석을 시작합니다. 클릭 시 유통 경로 분석 결과를 확인합니다.
          </div>
        </div>
      </form>
    </div>
  )
}

export default FilterBar
