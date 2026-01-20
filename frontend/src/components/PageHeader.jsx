import { useLocation } from 'react-router-dom'
import { useState } from 'react'
import { Bell, RefreshCw, User, ChevronDown, Zap } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAccount } from '../contexts/AccountContext'
import apiClient from '../lib/api'

function PageHeader() {
  const location = useLocation()
  const { user, isAuthenticated, signOut } = useAuth()
  const { credits, setShowCreditModal, refreshCredits } = useAccount()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showAuthMenu, setShowAuthMenu] = useState(false)
  const [isGrantingTestCredits, setIsGrantingTestCredits] = useState(false)

  // Get page info based on route
  const getPageInfo = () => {
    const path = location.pathname
    switch (path) {
      case '/dashboard':
        return {
          title: 'Dashboard',
          subtitle: '', // ✅ 제거: 설명 문구 삭제
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

  const handleRefresh = () => {
    setIsRefreshing(true)
    // Send force refresh signal to Dashboard
    window.dispatchEvent(new CustomEvent('forceRefresh'))
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  const handleLogout = async () => {
    await signOut()
    setShowAuthMenu(false)
  }

  return (
    <div className="bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50 py-4 sticky top-0 z-20">
      <div className="px-6">
        <div className="flex items-center justify-between">
          {/* Left: Title & Subtitle */}
          <div className="flex items-center gap-4">
            {/* Icon Badge */}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/50 flex items-center justify-center shadow-lg opacity-0 animate-fade-in" style={{ animationDelay: '50ms' }}>
              <span className="text-2xl">{pageInfo.icon}</span>
            </div>
            
            <div className="opacity-0 animate-fade-in" style={{ animationDelay: '100ms' }}>
              {/* Title */}
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {pageInfo.title}
              </h1>
            </div>
          </div>


          {/* Right: Actions */}
          <div className="flex items-center gap-3 opacity-0 animate-fade-in" style={{ animationDelay: '150ms' }}>
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
              <div className="flex items-center gap-2">
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
                
                {/* Grant Test Credits Button (Dev-only) - Only visible when VITE_ENABLE_TEST_CREDITS === 'true' */}
                {import.meta.env.VITE_ENABLE_TEST_CREDITS === 'true' && (
                  <button
                    onClick={async () => {
                      if (isGrantingTestCredits || !user?.id) return
                      
                      setIsGrantingTestCredits(true)
                      try {
                        const adminKey = import.meta.env.VITE_ADMIN_API_KEY || ''
                        const response = await apiClient.post(
                          '/api/admin/credits/grant',
                          {
                            user_id: user.id,
                            amount: 1000,
                            description: 'Test credits grant (dev-only)'
                          },
                          {
                            params: {
                              admin_key: adminKey
                            },
                            timeout: 30000
                          }
                        )
                        
                        if (response.data.success) {
                          const { totalCredits, addedAmount } = response.data
                          console.log(`Test credits granted: +${addedAmount} credits (Total: ${totalCredits})`)
                          // Refresh credit information from AccountContext
                          refreshCredits()
                        } else {
                          throw new Error(response.data.message || 'Grant failed')
                        }
                      } catch (err) {
                        console.error('Test credits grant failed:', err)
                        if (err.response?.status === 403) {
                          console.error('Test credits grant is not available. Check admin key configuration.')
                        }
                      } finally {
                        setIsGrantingTestCredits(false)
                      }
                    }}
                    disabled={isGrantingTestCredits}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed text-white text-xs font-medium rounded-xl transition-colors"
                    title="Grant 1000 test credits (Dev-only)"
                  >
                    {isGrantingTestCredits ? 'Granting...' : '🧪 +1000'}
                  </button>
                )}
              </div>
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

        {/* Breadcrumb / Subtitle - 제거: subtitle이 있을 때만 표시 */}
        {pageInfo.subtitle && (
          <div className="mt-2 opacity-0 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <p className="text-sm text-zinc-500">
              {pageInfo.subtitle}
            </p>
          </div>
        )}
      </div>

    </div>
  )
}

export default PageHeader
