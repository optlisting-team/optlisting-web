import { useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Bell, Search, RefreshCw } from 'lucide-react'

function PageHeader() {
  const location = useLocation()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  // Get page info based on route
  const getPageInfo = () => {
    const path = location.pathname
    switch (path) {
      case '/dashboard':
        return {
          title: 'Dashboard',
          subtitle: 'Monitor your store health and performance',
          icon: '📊'
        }
      case '/listings':
        return {
          title: 'Listings',
          subtitle: 'Manage your product inventory',
          icon: '📦'
        }
      case '/history':
        return {
          title: 'History',
          subtitle: 'View deletion and export history',
          icon: '📜'
        }
      case '/settings':
        return {
          title: 'Settings',
          subtitle: 'Configure your account preferences',
          icon: '⚙️'
        }
      default:
        return {
          title: 'Dashboard',
          subtitle: 'Welcome back, CEO',
          icon: '🏠'
        }
    }
  }

  const pageInfo = getPageInfo()

  // Format greeting based on time
  const getGreeting = () => {
    const hour = currentTime.getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    // Trigger page refresh or data reload
    window.location.reload()
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  return (
    <div className="bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50 py-5 sticky top-0 z-20">
      <div className="px-6">
        <div className="flex items-center justify-between">
          {/* Left: Title & Subtitle */}
          <div className="flex items-center gap-4">
            {/* Icon Badge */}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/50 flex items-center justify-center shadow-lg opacity-0 animate-fade-in" style={{ animationDelay: '50ms' }}>
              <span className="text-2xl">{pageInfo.icon}</span>
            </div>
            
            <div className="opacity-0 animate-fade-in" style={{ animationDelay: '100ms' }}>
              {/* Greeting + Time */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-zinc-500 font-medium">
                  {getGreeting()}, CEO
                </span>
                <span className="text-zinc-700">•</span>
                <span className="text-xs text-zinc-600 data-value">
                  {currentTime.toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </span>
              </div>
              
              {/* Title */}
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {pageInfo.title}
              </h1>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3 opacity-0 animate-fade-in" style={{ animationDelay: '150ms' }}>
            {/* Search */}
            <div className="relative hidden lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search listings..."
                className="w-64 pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded font-mono">
                ⌘K
              </kbd>
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              className={`
                w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 
                flex items-center justify-center text-zinc-400 
                hover:bg-zinc-800 hover:text-white hover:border-zinc-700
                transition-all duration-200
                ${isRefreshing ? 'animate-spin' : ''}
              `}
              title="Refresh data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Notifications */}
            <button className="relative w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-white hover:border-zinc-700 transition-all duration-200">
              <Bell className="w-4 h-4" />
              {/* Notification Badge */}
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center border-2 border-zinc-950">
                3
              </span>
            </button>

            {/* Live Status Badge */}
            <div className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                Live
              </span>
            </div>
          </div>
        </div>

        {/* Breadcrumb / Subtitle */}
        <div className="mt-2 opacity-0 animate-fade-in" style={{ animationDelay: '200ms' }}>
          <p className="text-sm text-zinc-500">
            {pageInfo.subtitle}
          </p>
        </div>
      </div>
    </div>
  )
}

export default PageHeader
