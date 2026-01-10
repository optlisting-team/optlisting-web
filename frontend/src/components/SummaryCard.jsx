import { useEffect, useState, useRef } from 'react'
import { ChevronDown, Plus, Check, Unplug, Loader2, RefreshCw } from 'lucide-react'
import axios from 'axios'

// Demo stores for testing - initial state
const INITIAL_STORES = [
  { id: 'store-1', name: 'eBay Store', platform: 'eBay', connected: false },
  { id: 'store-2', name: 'Amazon Store', platform: 'Amazon', connected: false },
  { id: 'store-3', name: 'Shopify Store', platform: 'Shopify', connected: false },
]

// Use environment variable for Railway URL, fallback based on environment
// In local development, use empty string to leverage Vite proxy (localhost:8000)
// In production, use Railway URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? '' : 'https://optlisting-production.up.railway.app')
const CURRENT_USER_ID = 'default-user'

// Store Selector Component
function StoreSelector({ connectedStore, apiConnected, onConnectionChange, onError, loading = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const [stores, setStores] = useState(INITIAL_STORES)
  const [selectedStore, setSelectedStore] = useState(stores[0])
  const [connecting, setConnecting] = useState(false)
  const [checkingConnection, setCheckingConnection] = useState(false) // Changed default to false - only check on button click
  const [ebayUserId, setEbayUserId] = useState(null) // Add eBay User ID state
  const dropdownRef = useRef(null)
  
  // 중복 클릭 방지를 위한 플래그 및 debounce
  const connectButtonInProgress = useRef(false)
  const connectButtonDebounceTimer = useRef(null)

  // Ensure dropdown is closed on mount
  useEffect(() => {
    setIsOpen(false)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // eBay token status check function (manual call only)
  // Returns: { isConnected: boolean, userId: string | null }
  const checkEbayTokenStatus = async () => {
    if (selectedStore?.platform !== 'eBay') {
      setCheckingConnection(false)
      return { isConnected: false, userId: null }
    }

    try {
      setCheckingConnection(true)
      // Lightweight token status check
      const response = await axios.get(`${API_BASE_URL}/api/ebay/auth/status`, {
        params: { user_id: CURRENT_USER_ID },
        timeout: 30000 // Increased from 5s to 30s
      })
      
      // Check if valid token exists
      const hasValidToken = response.data?.connected === true && 
                           response.data?.token_status?.has_valid_token !== false &&
                           !response.data?.is_expired
      
      // Get eBay User ID
      const userId = response.data?.ebay_user_id || response.data?.user_id || null
      setEbayUserId(userId)
      
      // Do not call callback if same as current state (prevent unnecessary repetition)
      const currentConnected = selectedStore?.connected || false
      if (hasValidToken === currentConnected) {
        // Skip if state is the same (minimize logs)
        setCheckingConnection(false)
        return { isConnected: hasValidToken, userId }
      }
      
      // Output log only when state changes (prevent repeated logs)
      console.log('🔄 eBay connection status changed:', {
        previousState: currentConnected,
        newState: hasValidToken,
        ebayUserId: userId,
        isExpired: response.data?.is_expired
      })
      
      // Update eBay store connection status
      setStores(prev => prev.map(s => 
        s.platform === 'eBay' ? { ...s, connected: hasValidToken } : s
      ))
      
      if (selectedStore?.platform === 'eBay') {
        setSelectedStore(prev => ({ ...prev, connected: hasValidToken }))
      }
      
      // Don't call onConnectionChange here - let the caller decide when to notify parent
      // This prevents duplicate calls and allows caller to pass forceLoad flag
      
      setCheckingConnection(false)
      return { isConnected: hasValidToken, userId }
    } catch (err) {
      // Handle timeout errors
      const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout')
      let errorMessage = 'Connection check failed. Please try again.'
      
      if (isTimeout) {
        console.warn('⏱️ eBay connection status check timeout (server response may be delayed)')
        errorMessage = 'Server response is delayed. Please try again later.'
      } else {
        console.error('Failed to check eBay token status:', err)
        // Show user-friendly error message
        if (err.response?.status === 0 || err.code === 'ERR_NETWORK') {
          errorMessage = 'Network error. Please check your internet connection.'
        } else if (err.response?.status === 401 || err.response?.status === 403) {
          errorMessage = 'Please reconnect your eBay account.'
        } else if (err.response?.status >= 500) {
          errorMessage = 'Server error. Try again later.'
        } else {
          errorMessage = 'Connection check failed. Please try again.'
        }
      }
      
      // Call onError callback if provided
      if (onError) {
        onError(errorMessage, err)
      }
      
      // Maintain existing connection state even if error occurs (preserve data)
      // Do not disconnect as network/server errors may be temporary
      const currentConnected = selectedStore?.connected || false
      
      // Only handle 401 (Unauthorized) errors as disconnection
      if (err.response?.status === 401) {
        console.log('⚠️ 401 error - Handling eBay disconnection')
        if (currentConnected) {
          setStores(prev => prev.map(s => 
            s.platform === 'eBay' ? { ...s, connected: false } : s
          ))
          if (selectedStore?.platform === 'eBay') {
            setSelectedStore(prev => ({ ...prev, connected: false }))
          }
          setEbayUserId(null)
          if (onConnectionChange) {
            onConnectionChange(false)
          }
        }
      } else {
        // Maintain connection state for network/other errors (preserve data)
        // Minimize logs for timeout errors to prevent console spam
        if (!isTimeout) {
          console.log('⚠️ Network/Server error - Maintaining connection state (preserve data)', {
            error: err.message,
            status: err.response?.status,
            currentConnected
          })
        }
        // Maintain connection state and do not call callback
      }
      
      setCheckingConnection(false)
      return { isConnected: false, userId: null }
    }
  }

  const getPlatformIcon = (platform) => {
    switch (platform) {
      case 'eBay': return '🏪'
      case 'Amazon': return '📦'
      case 'Shopify': return '🛍️'
      default: return '🏬'
    }
  }

  // Demo: Connect store (simulates OAuth flow)
  const handleConnect = () => {
    if (!selectedStore || selectedStore.connected) return
    
    setConnecting(true)
    // Simulate connection delay
    setTimeout(() => {
      setStores(prev => prev.map(s => 
        s.id === selectedStore.id ? { ...s, connected: true } : s
      ))
      setSelectedStore(prev => ({ ...prev, connected: true }))
      setConnecting(false)
      // Notify parent
      if (onConnectionChange) onConnectionChange(true)
    }, 1500)
  }

  // Demo: Disconnect store (removed confirm - direct disconnect)
  const handleDisconnect = () => {
    if (!selectedStore || !selectedStore.connected) return
    
    // Direct disconnect without confirmation (Demo mode only)
    setStores(prev => prev.map(s => 
      s.id === selectedStore.id ? { ...s, connected: false } : s
    ))
    setSelectedStore(prev => ({ ...prev, connected: false }))
    // Notify parent
    if (onConnectionChange) onConnectionChange(false)
  }

  // Real API connect (for production)
  const handleRealConnect = (e) => {
    // Prevent event propagation
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    // API URL priority: Environment variable > Environment-based fallback
    // In local development, use empty string to leverage Vite proxy (localhost:8000)
    // In production, use Railway URL
    const apiUrl = import.meta.env.VITE_API_URL || 
      (import.meta.env.DEV ? '' : 'https://optlisting-production.up.railway.app')
    const userId = 'default-user'
    const oauthUrl = `${apiUrl}/api/ebay/auth/start?user_id=${userId}`
    
    console.log('🔗 Attempting eBay OAuth connection')
    console.log('API URL:', apiUrl)
    console.log('OAuth URL:', oauthUrl)
    console.log('User ID:', userId)
    console.log('VITE_API_URL env:', import.meta.env.VITE_API_URL)
    
    // Redirect immediately (synchronously)
    console.log('Starting redirect...')
    console.log('oauthUrl:', oauthUrl)
    
    // Use window.location.replace directly (most reliable)
    window.location.replace(oauthUrl)
    
    // If replace doesn't work, use href
    setTimeout(() => {
      console.warn('Replace not working, retrying with href')
      window.location.href = oauthUrl
    }, 100)
  }

  return (
    <div className="opt-card p-4 px-6 relative z-50" ref={dropdownRef}>
      <div className="flex items-center gap-3">
        {/* Minimized Store Button */}
        <div className="relative" style={{ zIndex: 9999 }}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 rounded-lg transition-all"
          >
            <span className="text-lg">{getPlatformIcon(selectedStore?.platform)}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{selectedStore?.name || 'Select Store'}</span>
              {selectedStore?.platform === 'eBay' && ebayUserId && (
                <span className="text-xs text-zinc-400 font-mono">({ebayUserId})</span>
              )}
            </div>
            <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsOpen(false)}
              ></div>
              <div className="absolute top-full left-0 mt-1 w-72 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden" style={{ zIndex: 99999 }}>
                <div className="p-2 border-b border-zinc-800">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Your Stores</p>
                </div>
                
                {stores.map((store) => (
                  <div
                    key={store.id}
                    className={`flex items-center gap-3 px-3 py-2 hover:bg-zinc-800/50 transition-all ${
                      selectedStore?.id === store.id ? 'bg-zinc-800/50' : ''
                    }`}
                  >
                    <button
                      onClick={() => {
                        setSelectedStore(store)
                        setIsOpen(false)
                      }}
                      className="flex items-center gap-3 flex-1"
                    >
                      <span className="text-sm">{getPlatformIcon(store.platform)}</span>
                      <div className="flex-1 text-left">
                        <p className="text-xs font-semibold text-white">{store.name}</p>
                        <p className="text-[10px] text-zinc-500">{store.platform}</p>
                      </div>
                      {store.connected ? (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                          Live
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-600">Offline</span>
                      )}
                      {selectedStore?.id === store.id && (
                        <Check className="w-3 h-3 text-emerald-400" />
                      )}
                    </button>
                  </div>
                ))}

                {/* Add New Store */}
                <div className="p-2 border-t border-zinc-800">
                  <button
                    onClick={handleRealConnect}
                    className="w-full flex items-center gap-2 px-3 py-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-xs font-semibold">Connect New Store (Real API)</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Connect / Disconnect / Connecting Button */}
        {checkingConnection || loading ? (
          <button 
            disabled
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-lg border-2 border-blue-500/50 transition-all flex items-center gap-2 text-base shadow-lg animate-pulse cursor-not-allowed"
          >
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{loading ? 'Loading...' : 'Connecting...'}</span>
          </button>
        ) : selectedStore?.connected ? (
          <button 
            onClick={handleDisconnect}
            className="px-5 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-bold rounded-lg border-2 border-red-600/30 transition-all flex items-center gap-2 text-base shadow-lg hover:shadow-red-500/20"
          >
            <Unplug className="w-5 h-5" />
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            disabled={connectButtonInProgress.current || checkingConnection}
            onClick={async (e) => {
              e.preventDefault()
              e.stopPropagation()
              
              // 중복 클릭 방지
              if (connectButtonInProgress.current) {
                console.warn('⚠️ Connect button already in progress, ignoring click')
                return
              }
              
              // Debounce: 이전 타이머가 있으면 취소
              if (connectButtonDebounceTimer.current) {
                clearTimeout(connectButtonDebounceTimer.current)
              }
              
              // Debounce 적용 (500ms)
              connectButtonDebounceTimer.current = setTimeout(async () => {
                connectButtonInProgress.current = true
                
                // Performance mark 시작
                if (typeof performance !== 'undefined' && performance.mark) {
                  performance.mark('connect_ebay_start')
                }
                
                // requestId 생성
                const requestId = `connect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                
                // Clear any stale sessionStorage flags to ensure clean OAuth flow
                const processedKey = 'ebay_oauth_processed'
                sessionStorage.removeItem(processedKey)
                
                // Set loading state immediately when button is clicked
                setCheckingConnection(true)
                
                try {
                  console.log(`🔘 Connect eBay button clicked [${requestId}]`)
                  console.log(`   API_BASE_URL: ${API_BASE_URL}`)
                  console.log(`   CURRENT_USER_ID: ${CURRENT_USER_ID}`)
                  console.log(`   Cleared sessionStorage flag for fresh OAuth flow`)
                  
                  // Check token status when connect button is clicked
                  console.log(`   [${requestId}] Checking eBay connection status...`)
                  const statusResult = await checkEbayTokenStatus()
                  console.log(`   [${requestId}] Status check result:`, statusResult)
                  
                  // Use the result from API call instead of state (which may not be updated yet)
                  if (statusResult?.isConnected) {
                    console.log(`✅ [${requestId}] Already connected to eBay - starting product query`)
                    // Performance mark
                    if (typeof performance !== 'undefined' && performance.mark && performance.measure) {
                      performance.mark('connect_ebay_end')
                      performance.measure('connect_ebay_duration', 'connect_ebay_start', 'connect_ebay_end')
                      const measure = performance.getEntriesByName('connect_ebay_duration')[0]
                      console.log(`⏱️ [${requestId}] Connect eBay completed in ${measure.duration.toFixed(2)}ms`)
                    }
                    
                    // Notify parent component of connection status (trigger forced product query)
                    if (onConnectionChange) {
                      onConnectionChange(true, true) // forceLoad = true
                    }
                    setCheckingConnection(false)
                    connectButtonInProgress.current = false
                    return
                  }
                  
                  // Start OAuth if not connected
                  const oauthUrl = `${API_BASE_URL}/api/ebay/auth/start?user_id=${CURRENT_USER_ID}`
                  console.log(`🔗 [${requestId}] Starting OAuth flow...`)
                  console.log(`   OAuth URL: ${oauthUrl}`)
                  console.log(`   Redirecting to eBay login page...`)
                  
                  // Performance mark: OAuth 시작
                  if (typeof performance !== 'undefined' && performance.mark) {
                    performance.mark('oauth_redirect_start')
                  }
                  
                  // Use window.location.replace to avoid adding to history
                  // This prevents back button issues
                  window.location.replace(oauthUrl)
                } catch (err) {
                  console.error(`❌ [${requestId}] Error in connect button handler:`, err)
                  console.error(`   Error details [${requestId}]:`, {
                    message: err.message,
                    status: err.response?.status,
                    data: err.response?.data,
                    requestId: requestId
                  })
                  setCheckingConnection(false)
                  connectButtonInProgress.current = false
                  
                  // Show user-friendly error via callback
                  const errorMsg = err.code === 'ERR_NETWORK' 
                    ? 'Network error. Please check your connection.'
                    : err.response?.status === 401 || err.response?.status === 403
                    ? 'Please reconnect your eBay account.'
                    : err.response?.status >= 500
                    ? 'Server error. Try again later.'
                    : err.code === 'ECONNABORTED'
                    ? 'Request timeout. Please try again.'
                    : `Connection check failed: ${err.message || 'Unknown error'}. Please try again.`
                  
                  if (onError) {
                    onError(errorMsg, err)
                  }
                }
              }, 300) // 300ms debounce
            }}
            className={`px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold rounded-lg transition-all flex items-center gap-2 text-base shadow-lg hover:shadow-emerald-500/40 transform hover:scale-105 active:scale-95 border-2 border-emerald-500/50 ${
              connectButtonInProgress.current || checkingConnection 
                ? 'opacity-50 cursor-not-allowed' 
                : 'cursor-pointer'
            }`}
          >
            <Plus className="w-5 h-5 font-bold" strokeWidth={3} />
            <span>Connect eBay</span>
          </button>
        )}

      </div>
    </div>
  )
}

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
function SummaryCard({ onError, 
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
  onSync = null, // Sync callback
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
  usedCredits = 0,
  // Store connection callback
  onConnectionChange = null,
  // Supplier export callback
  onSupplierExport = null,
  // Low-Performing items data for Product Journey analysis
  zombies = [],
  // Summary stats and analysis result (for filtered badge)
  summaryStats = null,
  analysisResult = null,
  // Error callback
  onError = null
}) {
  // Plan colors
  const planColors = {
    BASIC: 'from-cyan-600/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
    PRO: 'from-blue-600/20 to-blue-600/10 border-blue-500/30 text-blue-400',
    'POWER SELLER': 'from-purple-600/20 to-purple-600/10 border-purple-500/30 text-purple-400'
  }
  const planColor = planColors[userPlan] || planColors.PRO

  return (
    <div className="space-y-4 pt-2">
      {/* Your Store - With Dropdown */}
      <StoreSelector 
        connectedStore={connectedStore}
        apiConnected={apiConnected}
        onConnectionChange={onConnectionChange}
        onError={onError}
        loading={loading}
      />

      {/* Stats Row - 3 Columns: Display only (non-interactive) */}
      <div className="grid grid-cols-3 gap-4">
        {/* 1. Active Listings - Display only */}
        <div 
          className="opt-card p-6 text-center relative"
        >
          <div className="text-4xl font-black text-white">{loading ? '...' : (totalListings || 0).toLocaleString()}</div>
          <div className="text-sm text-zinc-500 uppercase mt-1">Active</div>
          {onSync && (
            <button
              onClick={(e) => { e.stopPropagation(); onSync(); }}
              disabled={loading}
              className="absolute top-2 right-2 p-2.5 text-zinc-500 hover:text-white transition-all hover:bg-zinc-800/50 rounded-lg"
              title="Sync from eBay"
            >
              <svg className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
      </div>

        {/* 2. Low-Performing - Display only */}
        <div 
          className={`opt-card p-6 text-center relative ${totalZombies > 0 ? 'border-red-500/30' : ''}`}
          title="Number of low-performing (deletion target) SKUs detected based on current filter settings."
        >
          <div className={`text-4xl font-black ${totalZombies > 0 ? 'text-red-400' : 'text-white'}`}>{totalZombies || 0}</div>
          <div className={`text-sm uppercase mt-1 ${totalZombies > 0 ? 'text-red-400' : 'text-zinc-500'}`}>Low-Performing</div>
          {/* Filtered 배지 (분석 결과가 있을 때) */}
          {totalZombies > 0 && analysisResult && (
            <div className="absolute top-2 right-2 px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-xs font-medium">
              Filtered
            </div>
          )}
            </div>

        {/* 3. CSV Export - Display only */}
        <div 
          className="opt-card p-6 text-center"
          title="Selected items for CSV export."
        >
          <div className={`text-4xl font-black ${queueCount > 0 ? 'text-orange-400' : 'text-white'}`}>{queueCount || 0}</div>
          <div className="text-sm text-zinc-500 uppercase mt-1">CSV Export</div>
            </div>
          </div>

    </div>
  )
}

export default SummaryCard
