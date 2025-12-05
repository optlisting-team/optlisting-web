import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import StoreSwitcher from './StoreSwitcher'
import { useAuth } from '../contexts/AuthContext'
import { LayoutDashboard, List, History, User, Zap, CreditCard, Settings, ChevronRight, LogOut } from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut, isAuthenticated } = useAuth()
  const [credits, setCredits] = useState(null)
  const [plan, setPlan] = useState('FREE')
  const [apiStatus, setApiStatus] = useState('checking')

  // 로그아웃 핸들러
  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  // Fetch credits on mount
  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/credits?user_id=default-user`)
        if (response.ok) {
          const data = await response.json()
          setCredits(data.available_credits)
          setPlan(data.current_plan || 'FREE')
          setApiStatus('connected')
        } else {
          setApiStatus('error')
        }
      } catch (err) {
        console.error('Failed to fetch credits:', err)
        setApiStatus('error')
      }
    }
    
    fetchCredits()
    // Refresh every 30 seconds
    const interval = setInterval(fetchCredits, 30000)
    return () => clearInterval(interval)
  }, [])

  const isActive = (path) => {
    if (path.includes('?')) {
      const [basePath, query] = path.split('?')
      return location.pathname === basePath && location.search === `?${query}`
    }
    return location.pathname === path && !location.search
  }

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { path: '/dashboard?view=history', label: 'History', icon: History, badge: null }
  ]

  return (
    <div className="flex flex-col h-screen bg-zinc-950 border-r border-zinc-800/50 w-64">
      {/* Top Section - Logo & Store */}
      <div className="px-4 py-5 border-b border-zinc-800/50">
        {/* Logo */}
        <Link 
          to="/" 
          className="flex items-center gap-3 mb-5 group"
        >
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-white to-zinc-300 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-white/20 transition-shadow">
              <svg className="w-6 h-6 text-zinc-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-zinc-950" />
          </div>
          <div>
            <span className="text-xl font-bold text-white tracking-tight">OptListing</span>
            <div className="text-[10px] font-medium text-zinc-500 tracking-widest uppercase">
              v1.3.0
            </div>
          </div>
        </Link>

        {/* Store Switcher */}
        <div className="mb-4">
          <StoreSwitcher />
        </div>

        {/* API Status */}
        <div className={`
          flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
          transition-all duration-300
          ${apiStatus === 'connected' 
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
            : apiStatus === 'error'
              ? 'bg-red-500/10 border border-red-500/20 text-red-400'
              : 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-400'
          }
        `}>
          <span className={`
            status-dot
            ${apiStatus === 'connected' 
              ? 'status-dot-success' 
              : apiStatus === 'error'
                ? 'status-dot-danger'
                : 'bg-zinc-500'
            }
          `} />
          <span>
            {apiStatus === 'connected' 
              ? 'API Connected' 
              : apiStatus === 'error'
                ? 'Connection Error'
                : 'Checking...'}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto hide-scrollbar">
        <div className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase px-3 mb-2">
          Main Menu
        </div>
        <div className="space-y-1">
          {navItems.map((item, index) => {
            const Icon = item.icon
            const active = isActive(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl
                  transition-all duration-200 group relative
                  opacity-0 animate-slide-in-left
                  ${active
                    ? 'bg-white text-zinc-900 shadow-lg shadow-white/10'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
                  }
                `}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Icon className={`w-5 h-5 transition-transform ${active ? '' : 'group-hover:scale-110'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-auto px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white">
                    {item.badge}
                  </span>
                )}
                {active && (
                  <ChevronRight className="w-4 h-4 ml-auto" />
                )}
              </Link>
            )
          })}
        </div>

        {/* Divider */}
        <div className="my-4 border-t border-zinc-800/50" />

        {/* Settings Link */}
        <div className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase px-3 mb-2">
          Account
        </div>
        <Link
          to="/settings"
          className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl text-zinc-400 hover:bg-zinc-800/50 hover:text-white transition-all duration-200"
        >
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </Link>
      </nav>

      {/* Credits Card */}
      <div className="px-3 py-3 border-t border-zinc-800/50">
        <div className="opt-card p-4 bg-gradient-to-br from-zinc-900 to-zinc-950">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-zinc-500 uppercase tracking-wider">Credits</div>
              <div className="text-2xl font-bold text-white data-value">
                {credits !== null ? credits.toLocaleString() : '...'}
              </div>
            </div>
          </div>
          
          {/* Credit Bar */}
          <div className="mb-3">
            <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
              <span>Used this month</span>
              <span className="data-value">{credits !== null ? `${Math.max(0, 1000 - credits)} / 1000` : '...'}</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                style={{ width: credits !== null ? `${Math.min(((1000 - credits) / 1000) * 100, 100)}%` : '0%' }}
              />
            </div>
          </div>

          {/* Buy More Button */}
          <button className="w-full py-2 text-xs font-bold text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-500/50 rounded-lg transition-colors flex items-center justify-center gap-2">
            <CreditCard className="w-4 h-4" />
            Buy More Credits
          </button>
        </div>
      </div>

      {/* User Profile & Plan */}
      <div className="px-3 py-3 border-t border-zinc-800/50">
        {/* User Info */}
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="relative">
            {user?.user_metadata?.avatar_url ? (
              <img 
                src={user.user_metadata.avatar_url} 
                alt="Profile" 
                className="w-10 h-10 rounded-xl object-cover border border-zinc-600"
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-zinc-700 to-zinc-800 rounded-xl flex items-center justify-center border border-zinc-600">
                <User className="w-5 h-5 text-zinc-400" />
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-zinc-950" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {user?.user_metadata?.full_name || user?.user_metadata?.name || 'User'}
            </p>
            <p className="text-xs text-zinc-500 truncate">
              {user?.email || 'Not signed in'}
            </p>
          </div>
          {/* Logout Button */}
          <button
            onClick={handleSignOut}
            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Plan Badge */}
        <Link
          to="/#pricing"
          className={`
            flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer
            transition-all hover:scale-[1.02] hover:shadow-lg
            ${plan === 'PRO' 
              ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover:border-amber-500/40' 
              : plan === 'BUSINESS'
                ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 hover:border-purple-500/40'
                : 'bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600/50'
            }
          `}
        >
          <div className="flex items-center gap-2">
            <span className={`text-lg ${
              plan === 'PRO' ? '👑' : plan === 'BUSINESS' ? '🚀' : '📦'
            }`}>
              {plan === 'PRO' ? '👑' : plan === 'BUSINESS' ? '🚀' : '📦'}
            </span>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Current Plan</div>
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
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        </Link>
      </div>
    </div>
  )
}

export default Sidebar
