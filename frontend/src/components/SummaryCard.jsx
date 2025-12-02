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
  onViewModeChange 
}) {
  const handleCardClick = (mode) => {
    if (onViewModeChange) {
      onViewModeChange(mode)
    }
  }
  
  // Calculate estimated savings
  const estimatedSavings = calculateFeeSavings(totalZombies)

  return (
    <div className="space-y-6 pt-2">
      {/* Section Title */}
      <div className="flex items-center justify-between opacity-0 animate-fade-in" style={{ animationDelay: '50ms' }}>
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-gradient-to-b from-white to-zinc-600 rounded-full" />
          <h2 className="text-lg font-semibold text-zinc-300 tracking-wide">
            Store Analytics
          </h2>
        </div>
        <div className="opt-badge opt-badge-success">
          <span className="status-dot status-dot-success" />
          Live Data
        </div>
      </div>

      {/* Primary Metric Card - Total Listings */}
      <div 
        onClick={() => handleCardClick('all')}
        className={`
          opt-card p-8 cursor-pointer select-none relative overflow-hidden
          opacity-0 animate-fade-in-up
          ${viewMode === 'all' ? 'opt-card-active' : ''}
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
