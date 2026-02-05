import { Link } from 'react-router-dom'
import { useState } from 'react'
import { User, ChevronDown } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

function PageHeader() {
  const { user, isAuthenticated, signOut } = useAuth()
  const [showAuthMenu, setShowAuthMenu] = useState(false)

  const handleLogout = async () => {
    await signOut()
    setShowAuthMenu(false)
  }

  return (
    <div className="bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50 py-4 sticky top-0 z-30">
      <div className="px-6">
        <div className="flex items-center justify-between">
          {/* Left: Logo */}
          <Link
            to="/"
            className="text-xl font-bold text-white tracking-tight hover:text-zinc-200 transition-colors"
          >
            OptListing
          </Link>

          {/* Right: User Profile / Logout */}
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

              {showAuthMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50">
                  <div className="p-3 border-b border-zinc-800">
                    <p className="text-sm font-medium text-white">{user?.user_metadata?.full_name || 'User'}</p>
                    <p className="text-xs text-zinc-500">{user?.email}</p>
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
    </div>
  )
}

export default PageHeader
