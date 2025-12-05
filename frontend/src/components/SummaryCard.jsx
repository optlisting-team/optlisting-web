import { useEffect, useState } from 'react'

// Animated Counter Component
function AnimatedNumber({ value, loading }) {
  const [displayValue, setDisplayValue] = useState(0)
  
  useEffect(() => {
    if (loading) return
    
    const duration = 800
    const steps = 30
    const stepValue = value / steps
    const stepTime = duration / steps
    
    let current = 0
    const timer = setInterval(() => {
      current += stepValue
      if (current >= value) {
        setDisplayValue(value)
        clearInterval(timer)
      } else {
        setDisplayValue(Math.floor(current))
      }
    }, stepTime)
    
    return () => clearInterval(timer)
  }, [value, loading])
  
  if (loading) {
    return <span className="skeleton inline-block w-24 h-12 rounded-lg" />
  }
  
  return (
    <span className="data-value animate-count-up">
      {displayValue.toLocaleString()}
    </span>
  )
}

// Status Card Component
function StatCard({ 
  icon, 
  value, 
  label, 
  sublabel,
  breakdown,
  loading, 
  isActive, 
  isDanger,
  isSuccess,
  hasPulse,
  onClick,
  delay = 0 
}) {
  const cardClasses = `
    opt-card p-6 text-center cursor-pointer select-none
    opacity-0 animate-fade-in-up
    ${isDanger ? 'opt-card-danger' : ''}
    ${isSuccess ? 'opt-card-success' : ''}
    ${isActive ? 'opt-card-active' : ''}
    ${hasPulse && !loading ? 'animate-pulse-glow' : ''}
  `
  
  return (
    <div 
      onClick={onClick}
      className={cardClasses}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Pulse Indicator */}
      {hasPulse && !loading && (
        <div className="absolute top-3 right-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        </div>
      )}
      
      {/* Icon */}
      <div className="text-4xl mb-3 transform transition-transform group-hover:scale-110">
        {icon}
      </div>
      
      {/* Value */}
      <div className={`text-5xl font-extrabold mb-2 tracking-tight ${
        isDanger && value > 0 ? 'text-red-500' : 
        isSuccess ? 'text-emerald-500' : 
        'text-white'
      }`}>
        <AnimatedNumber value={value} loading={loading} />
      </div>
      
      {/* Label */}
      <div className={`text-xs font-bold tracking-widest uppercase ${
        isDanger && value > 0 ? 'text-red-400' : 'text-zinc-500'
      }`}>
        {label}
      </div>
      
      {/* Sublabel */}
      {sublabel && (
        <div className="text-xs text-zinc-600 mt-1">
          {sublabel}
        </div>
      )}
      
      {/* Breakdown Tags */}
      {breakdown && Object.keys(breakdown).length > 0 && (
        <div className="flex gap-2 justify-center mt-3 flex-wrap">
          {Object.entries(breakdown).map(([key, count]) => (
            count > 0 && (
              <span 
                key={key} 
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  isDanger 
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                }`}
              >
                {key}: {count}
              </span>
            )
          ))}
        </div>
      )}
    </div>
  )
}

// Calculate estimated fee savings
function calculateFeeSavings(zombieCount, avgPrice = 25) {
  // eBay Final Value Fee: ~13.25% average
  // Listing Fee: $0.35 per listing after free allowance
  // Estimated monthly holding cost per zombie listing
  const listingFee = 0.35
  const avgFinalValueFee = avgPrice * 0.1325
  const monthlyAdCost = 0.50 // Promoted listings average
  
  // Total monthly savings per zombie removed
  const savingsPerZombie = listingFee + (avgFinalValueFee * 0.1) + monthlyAdCost
  
  return zombieCount * savingsPerZombie
}

// Main Summary Card Component
function SummaryCard({ 
  totalListings, 
  totalBreakdown = {}, 
  platformBreakdown = {}, 
  totalZombies, 
  zombieBreakdown = {}, 
  queueCount, 
  totalDeleted, 
  loading, 
  filters = {}, 
  viewMode = 'zombies', 
  onViewModeChange,
  connectedStore = null,
  connectedStoresCount = 1,
  onAnalyze = null,
  onSync = null, // Sync callback
  showFilter = false,
  onToggleFilter = null,
  filterContent = null, // Filter panel to render after Total card
  // API Health Status
  apiConnected = false,
  apiError = null,
  // User subscription and credits
  userPlan = 'FREE',
  planStoreLimit = 3,
  globalStoreLimit = 10,
  userCredits = 0,
  usedCredits = 0
}) {
  const handleCardClick = (mode) => {
    if (onViewModeChange) {
      onViewModeChange(mode)
    }
  }
  
  // Plan colors
  const planColors = {
    BASIC: 'from-cyan-600/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
    PRO: 'from-blue-600/20 to-blue-600/10 border-blue-500/30 text-blue-400',
    'POWER SELLER': 'from-purple-600/20 to-purple-600/10 border-purple-500/30 text-purple-400'
  }
  const planColor = planColors[userPlan] || planColors.PRO

  return (
    <div className="space-y-4 pt-2">
      {/* Compact Status Bar */}
      <div className="flex items-center justify-between gap-3 opacity-0 animate-fade-in" style={{ animationDelay: '50ms' }}>
        {/* Left: Title */}
        <h2 className="text-sm font-semibold text-zinc-400 tracking-wide flex items-center gap-2">
          <span className="w-1 h-4 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full" />
          Store Analytics
        </h2>
        
        {/* Right: Compact Badges */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r ${planColor} border rounded-md text-[10px]`}>
            <span>👑</span>
            <span className="font-bold">{userPlan}</span>
            <span className="opacity-70">({connectedStoresCount}/{planStoreLimit} Stores)</span>
          </div>
          
          <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
            <span className="text-[10px]">💰</span>
            <span className="text-[10px] font-bold text-emerald-400">{(userCredits - usedCredits).toLocaleString()}</span>
            <span className="text-[10px] text-emerald-300/70">Credits</span>
          </div>
          
          {apiConnected ? (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-400">LIVE</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-md">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
              <span className="text-[10px] font-bold text-red-400">{apiError || 'Offline'}</span>
            </div>
          )}
        </div>
      </div>
      
      
      {/* Your Store - Ultra Compact */}
      <div className="opt-card p-2 px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">🏪</span>
            <span className="text-xs font-bold text-white">{connectedStore?.name || 'eBay Store'}</span>
            {connectedStore ? (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Connected
              </span>
            ) : (
              <span className="text-[10px] text-zinc-500">Not connected</span>
            )}
          </div>
          <button 
            onClick={() => {
              const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
              const userId = 'default-user'
              window.location.href = `${apiUrl}/api/ebay/auth/start?user_id=${userId}`
            }}
            className="text-[10px] px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded transition-all"
          >
            + Connect
          </button>
        </div>
      </div>

      {/* Stats Row - 4 Columns: Flow visualization */}
      <div className="grid grid-cols-4 gap-2">
        {/* 1. Active Listings - Click to see all listings */}
        <div 
          onClick={() => handleCardClick('all')}
          className={`opt-card p-3 cursor-pointer transition-all text-center relative hover:bg-zinc-800/50 ${viewMode === 'all' ? 'ring-1 ring-blue-500/50' : ''}`}
        >
          <div className="text-2xl font-black text-white">{loading ? '...' : (totalListings || 0).toLocaleString()}</div>
          <div className="text-[10px] text-zinc-500 uppercase">Active</div>
          {onSync && (
            <button
              onClick={(e) => { e.stopPropagation(); onSync(); }}
              disabled={loading}
              className="absolute top-1 right-1 p-1 text-zinc-500 hover:text-white transition-all"
              title="Sync from eBay"
            >
              <svg className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>

        {/* 2. Zombies - Click to open filter and find zombies */}
        <div 
          onClick={() => { if (onToggleFilter) onToggleFilter(); handleCardClick('zombies'); }}
          className={`opt-card p-3 cursor-pointer transition-all text-center hover:bg-zinc-800/50 ${viewMode === 'zombies' || showFilter ? 'ring-1 ring-red-500/50' : ''} ${totalZombies > 0 ? 'border-red-500/30' : ''}`}
        >
          <div className={`text-2xl font-black ${totalZombies > 0 ? 'text-red-400' : 'text-white'}`}>{totalZombies || 0}</div>
          <div className={`text-[10px] uppercase ${totalZombies > 0 ? 'text-red-400' : 'text-zinc-500'}`}>Zombies</div>
        </div>

        {/* 3. In Queue - Selected for deletion */}
        <div 
          onClick={() => handleCardClick('queue')}
          className={`opt-card p-3 cursor-pointer transition-all text-center hover:bg-zinc-800/50 ${viewMode === 'queue' ? 'ring-1 ring-orange-500/50' : ''}`}
        >
          <div className={`text-2xl font-black ${queueCount > 0 ? 'text-orange-400' : 'text-white'}`}>{queueCount || 0}</div>
          <div className="text-[10px] text-zinc-500 uppercase">Queue</div>
        </div>

        {/* 4. Removed - Final destination */}
        <div 
          onClick={() => handleCardClick('history')}
          className={`opt-card p-3 cursor-pointer transition-all text-center hover:bg-zinc-800/50 ${viewMode === 'history' ? 'ring-1 ring-emerald-500/50' : ''}`}
        >
          <div className={`text-2xl font-black ${totalDeleted > 0 ? 'text-emerald-400' : 'text-white'}`}>{totalDeleted || 0}</div>
          <div className="text-[10px] text-zinc-500 uppercase">Removed</div>
        </div>
      </div>

      {/* Filter Panel Slot */}
      {filterContent}
    </div>
  )
}

export default SummaryCard
