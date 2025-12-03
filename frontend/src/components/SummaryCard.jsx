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
    <div className="space-y-6 pt-2">
      {/* Header Status Bar - Subscription, Credits, Store Limits */}
      <div className="flex flex-wrap items-center justify-between gap-4 opacity-0 animate-fade-in" style={{ animationDelay: '50ms' }}>
        {/* Left: Title */}
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-gradient-to-b from-white to-zinc-600 rounded-full" />
          <h2 className="text-lg font-semibold text-zinc-300 tracking-wide">
            Store Analytics
          </h2>
        </div>
        
        {/* Right: Status Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Subscription Plan Badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r ${planColor} border rounded-lg`}>
            <span className="text-sm">👑</span>
            <span className="text-xs font-bold">{userPlan}</span>
            <span className="text-xs opacity-70">({connectedStoresCount}/{planStoreLimit} Stores)</span>
          </div>
          
          {/* Global Store Limit Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-600/20 to-amber-600/10 border border-amber-500/30 rounded-lg">
            <span className="text-sm">🏪</span>
            <span className="text-xs font-bold text-amber-400">Global Limit</span>
            <span className="text-xs text-amber-300">{globalStoreLimit}</span>
          </div>
          
          {/* Credits Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-600/20 to-emerald-600/10 border border-emerald-500/30 rounded-lg">
            <span className="text-sm">💰</span>
            <span className="text-xs font-bold text-emerald-400">{(userCredits - usedCredits).toLocaleString()}</span>
            <span className="text-xs text-emerald-300/70">Credits</span>
          </div>
          
          {/* API Health Badge - Dynamic based on connection status */}
          {apiConnected ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-600/20 to-emerald-600/10 border border-emerald-500/30 rounded-lg">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold text-emerald-400">LIVE</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-red-600/20 to-red-600/10 border border-red-500/30 rounded-lg">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <span className="text-xs font-bold text-red-400">{apiError || 'Connection Error'}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Your Store - Full Width Card with Dropdown */}
      <div className="opt-card p-6 opacity-0 animate-fade-in" style={{ animationDelay: '80ms' }}>
        <div className="flex items-center justify-between">
          {/* Left: Store Info */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">🏪</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Your Store</span>
              {connectedStore ? (
                <>
                  <span className="text-xl font-bold text-white">{connectedStore.name || 'eBay Store'}</span>
                  <span className="text-xs text-zinc-500">{connectedStore.email || 'user@ebay.com'}</span>
                </>
              ) : (
                <span className="text-lg font-semibold text-zinc-400">No Store Selected</span>
              )}
            </div>
          </div>

          {/* Center: Store Selector Dropdown */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <select 
                className="appearance-none bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 pr-10 text-white font-medium cursor-pointer hover:border-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all min-w-[200px]"
                defaultValue={connectedStore?.id || ''}
              >
                {connectedStore && (
                  <option value={connectedStore.id}>
                    {connectedStore.name || 'eBay Store'}
                  </option>
                )}
                <option value="store-2">Amazon Store</option>
                <option value="store-3">Shopify Store</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Add New Store Button */}
            <button className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all hover:scale-105 shadow-lg shadow-blue-500/20">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Store</span>
            </button>
          </div>

          {/* Right: Connection Status */}
          <div className="flex items-center gap-3">
            {connectedStore ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-emerald-400">Connected</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-zinc-700/50 border border-zinc-600 rounded-xl">
                <div className="w-2.5 h-2.5 bg-zinc-500 rounded-full" />
                <span className="text-sm font-semibold text-zinc-400">Disconnected</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Primary Metric Card - Total Listings */}
      <div 
        onClick={() => onToggleFilter ? onToggleFilter() : handleCardClick('all')}
        className={`
          opt-card p-8 cursor-pointer select-none relative overflow-hidden
          opacity-0 animate-fade-in-up
          ${showFilter ? 'opt-card-active ring-2 ring-blue-500/50' : ''}
        `}
        style={{ animationDelay: '100ms' }}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }} />
        </div>
        
        <div className="relative z-10 text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 border border-zinc-600 mb-5 shadow-lg">
            <span className="text-3xl">📦</span>
          </div>
          
          {/* Value */}
          <div className="text-7xl font-black text-white mb-3 tracking-tighter">
            <AnimatedNumber value={totalListings || 0} loading={loading} />
          </div>
          
          {/* Label */}
          <div className="text-sm font-bold text-zinc-400 tracking-widest uppercase mb-4">
            Total Active Listings
          </div>
          
          {/* Click Hint */}
          <div className="text-xs text-zinc-500 mb-4">
            {showFilter ? '✅ Filters open ↓' : '👆 Click to open filters'}
          </div>
          
          {/* Platform Breakdown */}
          {!loading && totalListings > 0 && (
            <div className="flex gap-3 justify-center flex-wrap">
              {Object.entries(platformBreakdown).map(([platform, count]) => (
                count > 0 && (
                  <div 
                    key={platform}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800/50 rounded-xl border border-zinc-700/50"
                  >
                    <span className="text-lg">
                      {platform === 'eBay' ? '🏷️' : platform === 'Shopify' ? '🛒' : '📊'}
                    </span>
                    <span className="text-sm font-semibold text-zinc-300">
                      {platform}
                    </span>
                    <span className="text-sm font-bold text-white data-value">
                      {count.toLocaleString()}
                    </span>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filter Panel Slot - Between Total Card and Secondary Metrics */}
      {filterContent}

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Low Interest Card */}
        <StatCard
          icon="📉"
          value={totalZombies}
          label="Low Interest"
          sublabel="Needs Attention"
          breakdown={zombieBreakdown}
          loading={loading}
          isActive={viewMode === 'zombies'}
          isDanger={true}
          hasPulse={totalZombies > 0}
          onClick={() => handleCardClick('zombies')}
          delay={200}
        />

        {/* Queue Card */}
        <StatCard
          icon="🗑️"
          value={queueCount || 0}
          label="In Queue"
          sublabel="Ready for Export"
          loading={false}
          isActive={viewMode === 'queue'}
          onClick={() => handleCardClick('queue')}
          delay={300}
        />

        {/* History Card */}
        <StatCard
          icon="💀"
          value={totalDeleted || 0}
          label="Removed"
          sublabel="Total Cleaned"
          loading={loading}
          isActive={viewMode === 'history'}
          isSuccess={totalDeleted > 0}
          onClick={() => handleCardClick('history')}
          delay={400}
        />

        {/* Fee Savings Card */}
        <div 
          className="opt-card p-6 text-center opacity-0 animate-fade-in-up opt-card-success"
          style={{ animationDelay: '500ms' }}
        >
          <div className="text-4xl mb-3">💰</div>
          <div className="text-3xl font-extrabold text-emerald-500 mb-2 data-value">
            {loading ? '...' : `$${estimatedSavings.toFixed(2)}`}
          </div>
          <div className="text-xs font-bold text-zinc-500 tracking-widest uppercase">
            Est. Monthly Savings
          </div>
          <div className="text-xs text-zinc-600 mt-1">
            from removing zombies
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      {!loading && totalListings > 0 && (
        <div 
          className="opt-card p-4 opacity-0 animate-fade-in-up"
          style={{ animationDelay: '500ms' }}
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Health Score */}
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                totalZombies === 0 
                  ? 'bg-emerald-500/20 border border-emerald-500/30' 
                  : totalZombies < 10 
                    ? 'bg-yellow-500/20 border border-yellow-500/30'
                    : 'bg-red-500/20 border border-red-500/30'
              }`}>
                <span className="text-xl">
                  {totalZombies === 0 ? '✅' : totalZombies < 10 ? '⚠️' : '🔥'}
                </span>
              </div>
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Health</div>
                <div className={`text-sm font-bold ${
                  totalZombies === 0 
                    ? 'text-emerald-500' 
                    : totalZombies < 10 
                      ? 'text-yellow-500'
                      : 'text-red-500'
                }`}>
                  {totalZombies === 0 
                    ? 'Excellent' 
                    : totalZombies < 10 
                      ? 'Good'
                      : 'Needs Work'}
                </div>
              </div>
            </div>

            {/* Conversion Rate */}
            <div className="flex items-center gap-3">
              <div className="text-xs text-zinc-500 uppercase tracking-wider">
                Low Interest Rate
              </div>
              <div className="text-lg font-bold text-white data-value">
                {totalListings > 0 
                  ? ((totalZombies / totalListings) * 100).toFixed(1) 
                  : 0}%
              </div>
            </div>

            {/* Queue Progress */}
            {queueCount > 0 && (
              <div className="flex items-center gap-3">
                <div className="text-xs text-zinc-500 uppercase tracking-wider">
                  Queue Progress
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((queueCount / Math.max(totalZombies, 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-white data-value">
                    {queueCount}/{totalZombies}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SummaryCard
