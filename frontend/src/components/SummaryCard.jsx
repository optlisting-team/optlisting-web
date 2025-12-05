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
  
  // Calculate estimated savings
  const estimatedSavings = calculateFeeSavings(totalZombies)
  
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
      
      {/* 🔥 ZOMBIE ALERT BANNER - Shows when zombies detected */}
      {!loading && totalZombies > 0 && (
        <div 
          onClick={() => handleCardClick('zombies')}
          className="cursor-pointer bg-gradient-to-r from-red-900/40 via-orange-900/30 to-red-900/40 border-2 border-red-500/50 rounded-xl p-4 animate-pulse-glow"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-red-500/20 rounded-xl flex items-center justify-center border border-red-500/30">
                <span className="text-3xl">⚠️</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-red-400">{totalZombies}</span>
                  <span className="text-lg font-bold text-white">Zombie Listings Found!</span>
                </div>
                <div className="text-sm text-zinc-400">
                  Estimated monthly loss: <span className="text-red-400 font-bold">${estimatedSavings.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <button className="px-6 py-3 bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl transition-all hover:scale-105 shadow-lg shadow-red-500/30">
              Clean Up Now →
            </button>
          </div>
        </div>
      )}
      
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

      {/* Primary Metric - Total Listings (Inline with filter toggle) */}
      <div 
        onClick={() => onToggleFilter ? onToggleFilter() : handleCardClick('all')}
        className={`
          opt-card p-3 cursor-pointer select-none transition-all
          ${showFilter ? 'ring-1 ring-blue-500/50 bg-blue-500/5' : 'hover:bg-zinc-800/50'}
        `}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg">📦</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">
                {loading ? '...' : (totalListings || 0).toLocaleString()}
              </span>
              <span className="text-xs text-zinc-500 uppercase">Active Listings</span>
            </div>
            {!loading && Object.entries(platformBreakdown).map(([platform, count]) => (
              count > 0 && (
                <span key={platform} className="text-xs px-2 py-0.5 bg-zinc-800 rounded text-zinc-400">
                  {platform}: {count.toLocaleString()}
                </span>
              )
            ))}
          </div>
          <span className={`text-xs px-2 py-1 rounded ${showFilter ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-500'}`}>
            {showFilter ? '✓ Filters Open' : '⚡ Open Filters'}
          </span>
        </div>
      </div>

      {/* Filter Panel Slot - Between Total Card and Secondary Metrics */}
      {filterContent}

      {/* Quick Action Cards - Compact 3-column */}
      <div className="grid grid-cols-3 gap-3">
        {/* Queue Card */}
        <div 
          onClick={() => handleCardClick('queue')}
          className={`opt-card p-3 cursor-pointer text-center transition-all hover:bg-zinc-800/50 ${viewMode === 'queue' ? 'ring-1 ring-blue-500/50' : ''}`}
        >
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg">🗑️</span>
            <span className="text-xl font-bold text-white">{queueCount || 0}</span>
          </div>
          <div className="text-[10px] text-zinc-500 uppercase mt-1">In Queue</div>
        </div>

        {/* History Card */}
        <div 
          onClick={() => handleCardClick('history')}
          className={`opt-card p-3 cursor-pointer text-center transition-all hover:bg-zinc-800/50 ${viewMode === 'history' ? 'ring-1 ring-blue-500/50' : ''}`}
        >
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg">💀</span>
            <span className={`text-xl font-bold ${totalDeleted > 0 ? 'text-emerald-400' : 'text-white'}`}>{totalDeleted || 0}</span>
          </div>
          <div className="text-[10px] text-zinc-500 uppercase mt-1">Removed</div>
        </div>

        {/* Savings Card */}
        <div className="opt-card p-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg">💰</span>
            <span className="text-xl font-bold text-emerald-400">${estimatedSavings.toFixed(0)}</span>
          </div>
          <div className="text-[10px] text-zinc-500 uppercase mt-1">Est. Savings/mo</div>
        </div>
      </div>

      {/* Health Indicator - Minimal */}
      {!loading && totalListings > 0 && (
        <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
          <div className="flex items-center gap-2">
            <span className={totalZombies === 0 ? 'text-emerald-400' : totalZombies < 10 ? 'text-yellow-400' : 'text-red-400'}>
              {totalZombies === 0 ? '✅ Excellent' : totalZombies < 10 ? '⚠️ Good' : '🔥 Needs Work'}
            </span>
            <span>•</span>
            <span>Zombie Rate: <strong className="text-white">{((totalZombies / totalListings) * 100).toFixed(1)}%</strong></span>
          </div>
          {queueCount > 0 && (
            <span>Queue: <strong className="text-white">{queueCount}/{totalZombies}</strong></span>
          )}
        </div>
      )}
    </div>
  )
}

export default SummaryCard
