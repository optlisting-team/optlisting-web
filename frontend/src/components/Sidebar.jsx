import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../contexts/AuthContext'
import { useAccount } from '../contexts/AccountContext'
import { LayoutDashboard, List, History, Settings, X, Check, ChevronDown, ChevronRight } from 'lucide-react'

// Credit Pack Options
const CREDIT_PACKS = [
  { id: 'credit-5', price: 5, credits: 1000, perScan: 0.005, discount: 0, label: 'Starter' },
  { id: 'credit-10', price: 10, credits: 2200, perScan: 0.0045, discount: 10, label: 'Popular', popular: true },
  { id: 'credit-15', price: 15, credits: 3400, perScan: 0.0044, discount: 13, label: 'Value' },
  { id: 'credit-20', price: 20, credits: 5600, perScan: 0.0036, discount: 29, label: 'Best', best: true },
  { id: 'credit-25', price: 25, credits: 7200, perScan: 0.0035, discount: 31, label: 'Pro' },
  { id: 'credit-50', price: 50, credits: 16000, perScan: 0.0031, discount: 37, label: 'Business' },
]

function Sidebar() {
  const location = useLocation()
  const { credits, showPlanModal, setShowPlanModal, showCreditModal, setShowCreditModal, refreshCredits } = useAccount()
  const [selectedPack, setSelectedPack] = useState(CREDIT_PACKS[0])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const planModalRef = useRef(null)
  const creditModalRef = useRef(null)

  // Close modals when clicking outside
  useEffect(() => {
    if (!showCreditModal && !showPlanModal) return
    
    const handleClickOutside = (event) => {
      if (planModalRef.current && showPlanModal && !planModalRef.current.contains(event.target)) {
        setShowPlanModal(false)
      }
      if (creditModalRef.current && showCreditModal && !creditModalRef.current.contains(event.target)) {
        setShowCreditModal(false)
        setIsDropdownOpen(false)
      }
    }
    
    // Add slight delay to prevent immediate closing when opening
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)
    
    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCreditModal, showPlanModal])

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
              v1.3.7
            </div>
          </div>
        </Link>
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


      {/* Plan Modal */}
      {showPlanModal && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div 
            ref={planModalRef}
            className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative z-[10000]"
            style={{ zIndex: 10000 }}
          >
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Choose Your Plan</h2>
              <button
                onClick={() => setShowPlanModal(false)}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4">
                {/* BASIC Plan */}
                <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-5 hover:border-cyan-500/30 transition-all">
                  <div className="mb-3">
                    <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Starter</span>
                    <h4 className="text-xl font-bold text-white mt-1">BASIC</h4>
                  </div>
                  <div className="mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-white">$19</span>
                      <span className="text-zinc-400 text-sm">/mo</span>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4 text-xs">
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-cyan-400" />
                      <span className="text-zinc-300">5,000 listings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-cyan-400" />
                      <span className="text-zinc-300">1 Store</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-cyan-400" />
                      <span className="text-zinc-300">CSV Export</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-300">Rollover ✨</span>
                    </div>
                  </div>
                  <a
                    href="https://optlisting.lemonsqueezy.com/checkout/basic"
                    className="block w-full py-2.5 bg-zinc-700 hover:bg-cyan-600 text-white font-bold rounded-xl text-center text-sm transition-all"
                  >
                    Get Started
                  </a>
                </div>

                {/* PRO Plan */}
                <div className="bg-gradient-to-b from-blue-600/20 to-zinc-800/80 border-2 border-blue-500/50 rounded-2xl p-5 shadow-2xl shadow-blue-500/10 relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-bold rounded-full shadow-lg shadow-blue-500/30">
                      ⭐ BEST
                    </span>
                  </div>
                  <div className="mb-3 mt-2">
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Popular</span>
                    <h4 className="text-xl font-bold text-white mt-1">PRO</h4>
                  </div>
                  <div className="mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-white">$49</span>
                      <span className="text-zinc-400 text-sm">/mo</span>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4 text-xs">
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-blue-400" />
                      <span className="text-zinc-300">30,000 listings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-blue-400" />
                      <span className="text-zinc-300">3 Stores</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-blue-400" />
                      <span className="text-zinc-300">CSV Export</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-300">Rollover ✨</span>
                    </div>
                  </div>
                  <a
                    href="https://optlisting.lemonsqueezy.com/checkout/pro"
                    className="block w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-xl text-center text-sm transition-all shadow-lg shadow-blue-500/30"
                  >
                    Best Value →
                  </a>
                </div>

                {/* POWER SELLER Plan */}
                <div className="bg-gradient-to-b from-purple-600/15 to-zinc-800/80 border border-purple-500/30 rounded-2xl p-5 hover:border-purple-500/50 transition-all relative">
                  <div className="absolute -top-3 right-3">
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-bold rounded-full border border-purple-500/30">
                      🚀
                    </span>
                  </div>
                  <div className="mb-3">
                    <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Enterprise</span>
                    <h4 className="text-xl font-bold text-white mt-1">POWER</h4>
                  </div>
                  <div className="mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-white">$99</span>
                      <span className="text-zinc-400 text-sm">/mo</span>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4 text-xs">
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-purple-400" />
                      <span className="text-zinc-300">100,000 listings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-purple-400" />
                      <span className="text-zinc-300">10 Stores</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-purple-400" />
                      <span className="text-zinc-300">CSV Export</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-300">Rollover ✨</span>
                    </div>
                  </div>
                  <a
                    href="https://optlisting.lemonsqueezy.com/checkout/power-seller"
                    className="block w-full py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-bold rounded-xl text-center text-sm transition-all shadow-lg shadow-purple-500/20"
                  >
                    Get Started
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Credit Pack Modal */}
      {showCreditModal && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div 
            ref={creditModalRef}
            className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full relative z-[10000]"
            style={{ zIndex: 10000 }}
          >
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Buy Credits</h2>
              <button
                onClick={() => setShowCreditModal(false)}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            
            <div className="p-6">
              {/* Current Credits Display */}
              <div className="mb-6 p-4 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                      <span className="text-xl">💰</span>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Current Credits</p>
                      <p className="text-2xl font-black text-white mt-0.5">
                        {credits !== null ? credits.toLocaleString() : '---'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-400">Available</p>
                    <p className="text-sm font-semibold text-emerald-400 mt-0.5">Ready to use</p>
                  </div>
                </div>
              </div>

              <div className="text-center mb-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500/20 rounded-full mb-2">
                  <span className="text-sm">💰</span>
                  <span className="text-sm font-bold text-amber-400">BUY MORE CREDITS</span>
                </div>
                <p className="text-zinc-400 text-xs">No subscription • Pay as you go</p>
              </div>

              <div className={`bg-gradient-to-b from-amber-500/10 to-zinc-800/80 border-2 rounded-2xl p-5 shadow-xl ${
                selectedPack.popular || selectedPack.best
                  ? 'border-amber-500/50 shadow-amber-500/10'
                  : 'border-amber-500/40'
              }`}>
                {/* Price Display - Prominently Featured */}
                <div className="text-center mb-4">
                  <div className="mb-2">
                    <span className="text-5xl font-black text-amber-400">${selectedPack.price}</span>
                  </div>
                  {selectedPack.discount > 0 && (
                    <div className="mb-2">
                      <span className="text-emerald-400 text-sm font-bold">-{selectedPack.discount}% OFF</span>
                    </div>
                  )}
                </div>

                {/* Dropdown Selector - Credits Only */}
                <div className="mb-4">
                  <div className="relative">
                    <button
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/80 border border-amber-500/30 rounded-xl text-white font-bold hover:border-amber-500/50 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-amber-400">{selectedPack.credits.toLocaleString()}</span>
                        <span className="text-sm text-zinc-300">Credits</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {isDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
                        {CREDIT_PACKS.map((pack) => (
                          <button
                            key={pack.id}
                            onClick={() => {
                              setSelectedPack(pack)
                              setIsDropdownOpen(false)
                            }}
                            className={`w-full flex items-center justify-between px-4 py-3 hover:bg-amber-500/10 transition-all border-b border-zinc-800 last:border-b-0 text-sm ${
                              selectedPack.id === pack.id ? 'bg-amber-500/15' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-amber-400">{pack.credits.toLocaleString()}</span>
                              <span className="text-zinc-400">Credits</span>
                              {pack.popular && (
                                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-bold rounded">POPULAR</span>
                              )}
                              {pack.best && (
                                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-bold rounded">BEST</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-zinc-500 text-xs">${pack.price}</span>
                              {pack.discount > 0 && (
                                <span className="text-emerald-400 text-xs font-bold">{pack.discount}% OFF</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 1 Credit = 1 Scan Notice */}
                <div className="text-center mb-4 py-2 px-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                  <span className="text-xs text-zinc-400">💡</span>
                  <span className="text-xs font-semibold text-amber-400"> 1 Credit = 1 Scan</span>
                </div>

                {/* Features */}
                <div className="space-y-2 mb-4 text-xs">
                  <div className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-amber-400" />
                    <span className="text-zinc-300">All Stores (We Support)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-300">Never Expires ✨</span>
                  </div>
                </div>

                {/* Purchase Button */}
                <a
                  href={`https://optlisting.lemonsqueezy.com/checkout/${selectedPack.id}`}
                  className={`block w-full py-3 bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white font-bold rounded-xl text-center text-sm transition-all shadow-lg shadow-amber-500/30`}
                >
                  Get Credits — ${selectedPack.price}
                </a>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default Sidebar
