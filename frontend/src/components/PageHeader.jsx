import { useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Bell, Search, RefreshCw, User, ChevronDown, Zap, CreditCard, ChevronRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAccount } from '../contexts/AccountContext'

function PageHeader() {
  const location = useLocation()
  const { user, isAuthenticated, signOut } = useAuth()
  const { credits, plan, setShowPlanModal, setShowCreditModal } = useAccount()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showAuthMenu, setShowAuthMenu] = useState(false)

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
          subtitle: 'Welcome back',
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
    // Dashboard에 강제 새로고침 신호 전달
    window.dispatchEvent(new CustomEvent('forceRefresh'))
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  const handleLogout = async () => {
    await signOut()
    setShowAuthMenu(false)
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
                  {getGreeting()}, {user?.user_metadata?.full_name?.split(' ')[0] || 'CEO'}
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
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center border-2 border-zinc-950">
                3
              </span>
            </button>

            {/* My Credits */}
            {isAuthenticated && (
              <button
                onClick={() => setShowCreditModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 hover:border-amber-500/30 transition-all"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div className="text-left hidden md:block">
                  <div className="text-xs text-zinc-500 text-[10px] uppercase tracking-wider">My Credits</div>
                  <div className="text-sm font-bold text-white">
                    {credits !== null ? credits.toLocaleString() : '...'}
                  </div>
                </div>
              </button>
            )}

            {/* My Plan */}
            {isAuthenticated && (
              <button
                onClick={() => setShowPlanModal(true)}
                className={`flex items-center gap-2 px-3 py-2 border rounded-xl hover:scale-[1.02] transition-all hidden md:flex ${
                  plan === 'PRO' 
                    ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20 hover:border-amber-500/40' 
                    : plan === 'BUSINESS'
                      ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20 hover:border-purple-500/40'
                      : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <span className="text-lg">
                  {plan === 'PRO' ? '👑' : plan === 'BUSINESS' ? '🚀' : '📦'}
                </span>
                <div className="text-left">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">My Plan</div>
                  <div className={`text-sm font-bold ${
                    plan === 'PRO' 
                      ? 'text-amber-400' 
                      : plan === 'BUSINESS'
                        ? 'text-purple-400'
                        : 'text-zinc-300'
                  }`}>
                    {plan}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              </button>
            )}

            {/* User Menu */}
            {isAuthenticated && (
              <div className="relative">
                <button
                  onClick={() => setShowAuthMenu(!showAuthMenu)}
                  className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 hover:border-zinc-700 transition-all"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    {user?.user_metadata?.avatar_url ? (
                      <img src={user.user_metadata.avatar_url} alt="" className="w-full h-full rounded-lg object-cover" />
                    ) : (
                      <User className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-white hidden md:block">
                    {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-zinc-500" />
                </button>

                {/* Dropdown Menu */}
                {showAuthMenu && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50">
                    <div className="p-3 border-b border-zinc-800">
                      <p className="text-sm font-medium text-white">{user?.user_metadata?.full_name || 'User'}</p>
                      <p className="text-xs text-zinc-500">{user?.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                          GOOGLE
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-zinc-800 transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}

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
