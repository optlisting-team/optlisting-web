import { useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Bell, Search, RefreshCw, LogIn, User, ChevronDown } from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function PageHeader() {
  const location = useLocation()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showAuthMenu, setShowAuthMenu] = useState(false)
  const [user, setUser] = useState(null)

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  // Check auth status on mount
  useEffect(() => {
    // TODO: Implement actual auth check with Supabase
    const checkAuth = async () => {
      try {
        // Placeholder: Check localStorage for demo
        const storedUser = localStorage.getItem('optlisting_user')
        if (storedUser) {
          setUser(JSON.parse(storedUser))
          setIsLoggedIn(true)
        }
      } catch (err) {
        console.error('Auth check failed:', err)
      }
    }
    checkAuth()
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
    window.location.reload()
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  // OAuth Handlers
  const handleGoogleLogin = () => {
    // TODO: Implement actual Google OAuth with Supabase
    console.log('Google OAuth initiated')
    // Demo: Set mock user
    const mockUser = {
      id: 'google-user-123',
      email: 'user@gmail.com',
      name: 'Demo User',
      provider: 'google',
      avatar: null
    }
    localStorage.setItem('optlisting_user', JSON.stringify(mockUser))
    setUser(mockUser)
    setIsLoggedIn(true)
    setShowAuthMenu(false)
  }

  const handleGitHubLogin = () => {
    // TODO: Implement actual GitHub OAuth with Supabase
    console.log('GitHub OAuth initiated')
    // Demo: Set mock user
    const mockUser = {
      id: 'github-user-456',
      email: 'user@github.com',
      name: 'GitHub User',
      provider: 'github',
      avatar: null
    }
    localStorage.setItem('optlisting_user', JSON.stringify(mockUser))
    setUser(mockUser)
    setIsLoggedIn(true)
    setShowAuthMenu(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('optlisting_user')
    setUser(null)
    setIsLoggedIn(false)
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
                  {getGreeting()}, {user?.name || 'CEO'}
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

          {/* Center: OAuth Buttons (when not logged in) */}
          {!isLoggedIn && (
            <div className="hidden md:flex items-center gap-3 opacity-0 animate-fade-in" style={{ animationDelay: '120ms' }}>
              <button
                onClick={handleGoogleLogin}
                className="flex items-center gap-2 px-4 py-2.5 bg-white text-zinc-900 font-medium rounded-xl hover:bg-zinc-100 transition-all shadow-lg shadow-white/10"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Connect Google</span>
              </button>
              
              <button
                onClick={handleGitHubLogin}
                className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 text-white font-medium rounded-xl border border-zinc-700 hover:bg-zinc-700 transition-all"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                </svg>
                <span>Connect GitHub</span>
              </button>
            </div>
          )}

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

            {/* User Menu / Login */}
            {isLoggedIn ? (
              <div className="relative">
                <button
                  onClick={() => setShowAuthMenu(!showAuthMenu)}
                  className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 hover:border-zinc-700 transition-all"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    {user?.avatar ? (
                      <img src={user.avatar} alt="" className="w-full h-full rounded-lg object-cover" />
                    ) : (
                      <User className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-white hidden md:block">
                    {user?.name || user?.email?.split('@')[0] || 'User'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-zinc-500" />
                </button>

                {/* Dropdown Menu */}
                {showAuthMenu && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50">
                    <div className="p-3 border-b border-zinc-800">
                      <p className="text-sm font-medium text-white">{user?.name || 'User'}</p>
                      <p className="text-xs text-zinc-500">{user?.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          user?.provider === 'google' 
                            ? 'bg-blue-500/20 text-blue-400' 
                            : 'bg-zinc-700 text-zinc-300'
                        }`}>
                          {user?.provider?.toUpperCase()}
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
            ) : (
              <button
                onClick={() => setShowAuthMenu(!showAuthMenu)}
                className="md:hidden flex items-center gap-2 px-4 py-2.5 bg-white text-zinc-900 font-medium rounded-xl hover:bg-zinc-100 transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>Login</span>
              </button>
            )}

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

      {/* Mobile Auth Menu */}
      {!isLoggedIn && showAuthMenu && (
        <div className="md:hidden absolute left-0 right-0 top-full bg-zinc-900 border-b border-zinc-800 p-4 space-y-3 z-50">
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-zinc-900 font-medium rounded-xl"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>Connect with Google</span>
          </button>
          <button
            onClick={handleGitHubLogin}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 text-white font-medium rounded-xl border border-zinc-700"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
            </svg>
            <span>Connect with GitHub</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default PageHeader
