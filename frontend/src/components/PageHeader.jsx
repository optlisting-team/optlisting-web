import { useState } from 'react'
import { ChevronDown, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import BrandLogo from './BrandLogo'

function PageHeader() {
  const { user, isAuthenticated, signOut } = useAuth()
  const [showAuthMenu, setShowAuthMenu] = useState(false)

  const handleLogout = async () => {
    await signOut()
    setShowAuthMenu(false)
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[#172B55] bg-brand-navy py-3 text-white">
      <div className="flex items-center justify-between px-4 sm:px-6">
        <BrandLogo to="/" size="sm" className="transition-opacity hover:opacity-90" />
        {isAuthenticated && (
          <div className="relative">
            <button onClick={() => setShowAuthMenu(!showAuthMenu)} className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 transition-colors hover:bg-white/10">
              <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg bg-brand-mint/20">
                {user?.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="h-4 w-4 text-white" />}
              </div>
              <span className="hidden text-sm font-medium text-white md:block">{user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}</span>
              <ChevronDown className="h-4 w-4 text-slate-300" />
            </button>
            {showAuthMenu && (
              <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="border-b border-slate-100 p-3"><p className="text-sm font-medium text-brand-navy">{user?.user_metadata?.full_name || 'User'}</p><p className="text-xs text-slate-500">{user?.email}</p></div>
                <button onClick={handleLogout} className="w-full px-4 py-3 text-left text-sm text-red-600 transition-colors hover:bg-red-50">Sign Out</button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}

export default PageHeader
