import { useState, useEffect, useRef, memo } from 'react'
import { RotateCw, Info } from 'lucide-react'
import StepperNumberField from './StepperNumberField'

/**
 * OptListing Final Zombie Analysis Filter
 * Order: Sales → Watch → Traffic
 * Reflects eBay seller's natural decision flow
 */
const FilterBar = memo(function FilterBar({ onApplyFilter, onSync, loading, initialFilters = {} }) {
  // 1. Analysis period (analytics_period_days)
  const [analysisPeriod, setAnalysisPeriod] = useState(initialFilters.analytics_period_days || 7)
  
  // 2. Sales count within period (max_sales)
  const [maxSales, setMaxSales] = useState(initialFilters.max_sales || 0)
  
  // 3. Watch count (max_watches)
  const [maxWatches, setMaxWatches] = useState(initialFilters.max_watches || 0)
  
  // 4. Total impressions (max_impressions)
  const [maxImpressions, setMaxImpressions] = useState(initialFilters.max_impressions || 100)
  
  // 5. Total views (max_views)
  const [maxViews, setMaxViews] = useState(initialFilters.max_views || 10)
  
  // Platform & source filter
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
    console.log('🔍 FilterBar handleSubmit called - Find Low-Performing SKUs button clicked')
    
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
    
    console.log('📋 Filter parameters:', filterParams)
    console.log('🔄 Calling onApplyFilter...')
    
    if (onApplyFilter) {
      onApplyFilter(filterParams)
    } else {
      console.error('❌ onApplyFilter is not defined!')
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

  // DAYS preset values
  const DAYS_PRESETS = [7, 14, 30, 90]

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
        
        {/* Filters Row - Single Row Layout (Evenly Distributed) */}
        <div className="flex items-end gap-4 mb-4">
          {/* DAYS Filter with Presets */}
          <div className="flex-shrink-0" style={{ minWidth: '280px' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm">📅</span>
              <span className="text-xs text-zinc-500 uppercase font-medium">Days</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Preset Buttons */}
              <div className="flex gap-1 flex-shrink-0">
                {DAYS_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAnalysisPeriod(preset)}
                    className={`
                      px-2 py-1 text-xs font-medium rounded border transition-all
                      ${analysisPeriod === preset
                        ? 'bg-zinc-800 border-zinc-600 text-white'
                        : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                      }
                    `}
                  >
                    {preset}d
                  </button>
                ))}
              </div>
              
              {/* Stepper */}
              <div className="flex-shrink-0" style={{ width: '140px' }}>
                <StepperNumberField
                  label=""
                  value={analysisPeriod}
                  onChange={setAnalysisPeriod}
                  min={1}
                  step={1}
                  bigStep={7}
                  unit="d"
                />
              </div>
            </div>
          </div>

          {/* SALES */}
          <div className="flex-shrink-0" style={{ minWidth: '140px' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm">💰</span>
              <span className="text-xs text-zinc-500 uppercase font-medium">Sales</span>
            </div>
            <div style={{ width: '140px' }}>
              <StepperNumberField
                label=""
                value={maxSales}
                onChange={setMaxSales}
                min={0}
                step={1}
                bigStep={10}
              />
            </div>
          </div>

          {/* WATCH */}
          <div className="flex-shrink-0" style={{ minWidth: '140px' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm">❤️</span>
              <span className="text-xs text-zinc-500 uppercase font-medium">Watch</span>
            </div>
            <div style={{ width: '140px' }}>
              <StepperNumberField
                label=""
                value={maxWatches}
                onChange={setMaxWatches}
                min={0}
                step={1}
                bigStep={10}
              />
            </div>
          </div>

          {/* IMP */}
          <div className="flex-shrink-0" style={{ minWidth: '140px' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm">👁️</span>
              <span className="text-xs text-zinc-500 uppercase font-medium">Imp</span>
            </div>
            <div style={{ width: '140px' }}>
              <StepperNumberField
                label=""
                value={maxImpressions}
                onChange={setMaxImpressions}
                min={0}
                step={10}
                bigStep={100}
              />
            </div>
          </div>

          {/* VIEWS */}
          <div className="flex-shrink-0" style={{ minWidth: '140px' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm">📊</span>
              <span className="text-xs text-zinc-500 uppercase font-medium">Views</span>
            </div>
            <div style={{ width: '140px' }}>
              <StepperNumberField
                label=""
                value={maxViews}
                onChange={setMaxViews}
                min={0}
                step={1}
                bigStep={10}
              />
            </div>
          </div>

          {/* Reset Button */}
          <div className="flex-shrink-0 flex items-end">
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-all whitespace-nowrap mb-0.5"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Find Low-Interest Items Button - Large, Below */}
        <div className="relative group">
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-red-600 to-orange-500 text-white text-base font-bold rounded-xl hover:from-red-500 hover:to-orange-400 disabled:opacity-50 transition-all shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40 hover:-translate-y-0.5"
            title="Start analysis with current filter settings. Click to view distribution channel analysis results."
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
            Start analysis with current filter settings. Click to view distribution channel analysis results.
          </div>
        </div>
      </form>
    </div>
  )
})

FilterBar.displayName = 'FilterBar'

export default FilterBar
