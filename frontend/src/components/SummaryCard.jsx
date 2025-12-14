import { useEffect, useState, useRef } from 'react'
import { ChevronDown, Plus, Check, Unplug } from 'lucide-react'
import axios from 'axios'

// Demo stores for testing - initial state
const INITIAL_STORES = [
  { id: 'store-1', name: 'eBay Store', platform: 'eBay', connected: false },
  { id: 'store-2', name: 'Amazon Store', platform: 'Amazon', connected: false },
  { id: 'store-3', name: 'Shopify Store', platform: 'Shopify', connected: false },
]

// Railway URL이 변경되었을 수 있으므로 환경 변수 우선 사용
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://optlisting-production.up.railway.app'
const CURRENT_USER_ID = 'default-user'

// Store Selector Component
function StoreSelector({ connectedStore, apiConnected, onConnectionChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [stores, setStores] = useState(INITIAL_STORES)
  const [selectedStore, setSelectedStore] = useState(stores[0])
  const [connecting, setConnecting] = useState(false)
  const [checkingConnection, setCheckingConnection] = useState(false) // 🔥 초기값 false로 변경 - 버튼 클릭 시에만 확인
  const [ebayUserId, setEbayUserId] = useState(null) // eBay User ID 상태 추가
  const dropdownRef = useRef(null)

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

  // 🔥 eBay 토큰 상태 확인 함수 (수동 호출만 가능)
  const checkEbayTokenStatus = async () => {
    if (selectedStore?.platform !== 'eBay') {
      setCheckingConnection(false)
      return
    }

    try {
      setCheckingConnection(true)
      // 경량화된 토큰 상태 확인
      const response = await axios.get(`${API_BASE_URL}/api/ebay/auth/status`, {
        params: { user_id: CURRENT_USER_ID },
        timeout: 5000
      })
      
      // 유효한 토큰이 있는지 확인
      const hasValidToken = response.data?.connected === true && 
                           response.data?.token_status?.has_valid_token !== false &&
                           !response.data?.is_expired
      
      // eBay User ID 가져오기
      const userId = response.data?.ebay_user_id || response.data?.user_id || null
      setEbayUserId(userId)
      
      // 🔥 현재 상태와 동일하면 콜백 호출하지 않음 (불필요한 재실행 방지)
      const currentConnected = selectedStore?.connected || false
      if (hasValidToken === currentConnected) {
        console.log('✅ eBay 연결 상태 변경 없음 - 콜백 호출 스킵')
        setCheckingConnection(false)
        return
      }
      
      console.log('eBay 토큰 상태 확인:', {
        connected: response.data?.connected,
        hasValidToken,
        isExpired: response.data?.is_expired,
        needsRefresh: response.data?.needs_refresh,
        tokenStatus: response.data?.token_status,
        ebayUserId: userId,
        previousState: currentConnected,
        newState: hasValidToken
      })
      
      // eBay 스토어 연결 상태 업데이트
      setStores(prev => prev.map(s => 
        s.platform === 'eBay' ? { ...s, connected: hasValidToken } : s
      ))
      
      if (selectedStore?.platform === 'eBay') {
        setSelectedStore(prev => ({ ...prev, connected: hasValidToken }))
      }
      
      // 🔥 상태가 변경되었을 때만 부모 컴포넌트에 알림
      if (onConnectionChange) {
        onConnectionChange(hasValidToken)
      }
    } catch (err) {
      console.error('eBay 토큰 상태 확인 실패:', err)
      
      // 🔥 현재 상태가 이미 false면 콜백 호출하지 않음
      const currentConnected = selectedStore?.connected || false
      if (!currentConnected) {
        setCheckingConnection(false)
        return
      }
      
      // 에러 시 연결 안 됨으로 처리 (상태가 변경된 경우에만)
      setStores(prev => prev.map(s => 
        s.platform === 'eBay' ? { ...s, connected: false } : s
      ))
      if (selectedStore?.platform === 'eBay') {
        setSelectedStore(prev => ({ ...prev, connected: false }))
      }
      setEbayUserId(null)
      
      // 🔥 상태가 변경되었을 때만 부모 컴포넌트에 알림
      if (onConnectionChange) {
        onConnectionChange(false)
      }
    } finally {
      setCheckingConnection(false)
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

  // Demo: Disconnect store
  const handleDisconnect = () => {
    if (!selectedStore || !selectedStore.connected) return
    
    if (confirm(`Disconnect ${selectedStore.name}?`)) {
      setStores(prev => prev.map(s => 
        s.id === selectedStore.id ? { ...s, connected: false } : s
      ))
      setSelectedStore(prev => ({ ...prev, connected: false }))
      // Notify parent
      if (onConnectionChange) onConnectionChange(false)
    }
  }

  // Real API connect (for production)
  const handleRealConnect = (e) => {
    // 이벤트 전파 방지
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    // API URL 우선순위: 환경 변수 > 하드코딩된 프로덕션 URL > localhost
    const apiUrl = import.meta.env.VITE_API_URL || 
                   'https://web-production-3dc73.up.railway.app' || 
                   'http://localhost:8000'
    const userId = 'default-user'
    const oauthUrl = `${apiUrl}/api/ebay/auth/start?user_id=${userId}`
    
    console.log('🔗 eBay OAuth 연결 시도')
    console.log('API URL:', apiUrl)
    console.log('OAuth URL:', oauthUrl)
    console.log('User ID:', userId)
    console.log('VITE_API_URL env:', import.meta.env.VITE_API_URL)
    
    // 즉시 리다이렉트 (동기적으로)
    console.log('리다이렉트 시작...')
    console.log('oauthUrl:', oauthUrl)
    
    // window.location.replace를 직접 사용 (가장 확실)
    window.location.replace(oauthUrl)
    
    // 만약 replace가 작동하지 않으면 href 사용
    setTimeout(() => {
      console.warn('replace가 작동하지 않음, href로 재시도')
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

        {/* Connect / Disconnect Button */}
        {selectedStore?.connected ? (
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
            onClick={async (e) => {
              e.preventDefault()
              e.stopPropagation()
              
              // 🔥 연결 버튼 클릭 시 토큰 상태 확인
              await checkEbayTokenStatus()
              
              // 🔥 이미 연결되어 있으면 제품 조회 및 표시 (OAuth 시작하지 않음)
              if (selectedStore?.connected) {
                console.log('✅ 이미 eBay에 연결되어 있습니다 - 제품 조회 시작')
                // 부모 컴포넌트에 연결 상태 알림 (강제 제품 조회 트리거)
                if (onConnectionChange) {
                  // forceLoad 플래그를 전달할 수 없으므로, 콜백을 두 번 호출하여 강제 로드
                  // 첫 번째 호출로 상태 확인, 두 번째 호출로 강제 로드
                  onConnectionChange(true, true) // forceLoad = true
                }
                return
              }
              
              // 연결되어 있지 않으면 OAuth 시작
              const oauthUrl = `${API_BASE_URL}/api/ebay/auth/start?user_id=${CURRENT_USER_ID}`
              console.log('🔗 Connect 버튼 클릭 - OAuth 시작')
              window.location.href = oauthUrl
            }}
            className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold rounded-lg transition-all flex items-center gap-2 text-base shadow-lg hover:shadow-emerald-500/40 transform hover:scale-105 active:scale-95 cursor-pointer border-2 border-emerald-500/50"
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
  zombies = []
}) {
  const handleCardClick = (mode) => {
    if (onViewModeChange) {
      onViewModeChange(mode)
    }
  }
  
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
      />

      {/* Stats Row - 3 Columns: Flow visualization */}
      <div className="grid grid-cols-3 gap-4">
        {/* 1. Active Listings - Click to see all listings */}
        <div 
          onClick={() => handleCardClick('all')}
          className={`opt-card p-6 cursor-pointer transition-all text-center relative hover:bg-zinc-800/50 ${viewMode === 'all' ? 'ring-2 ring-blue-500/50' : ''}`}
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

        {/* 2. Zombies - Click to view low-performing SKUs */}
        <div 
          onClick={() => handleCardClick('zombies')}
          className={`opt-card p-6 cursor-pointer transition-all text-center group hover:bg-zinc-800/50 ${viewMode === 'zombies' ? 'ring-2 ring-red-500/50' : ''} ${totalZombies > 0 ? 'border-red-500/30' : ''} hover:ring-2 hover:ring-red-500/30 hover:border-red-500/20`}
          title="현재 설정된 필터 기준으로 감지된 저성과(삭제 대상) SKU 개수입니다."
        >
          <div className={`text-4xl font-black group-hover:opacity-90 transition-opacity ${totalZombies > 0 ? 'text-red-400' : 'text-white'}`}>{totalZombies || 0}</div>
          <div className={`text-sm uppercase mt-1 group-hover:opacity-90 transition-opacity ${totalZombies > 0 ? 'text-red-400' : 'text-zinc-500'}`}>Low-Performing</div>
            </div>

        {/* 3. CSV Export - Selected for export */}
        <div 
          onClick={() => handleCardClick('queue')}
          className={`opt-card p-6 cursor-pointer transition-all text-center group hover:bg-zinc-800/50 ${viewMode === 'queue' ? 'ring-2 ring-orange-500/50' : ''} hover:ring-2 hover:ring-orange-500/30 hover:border-orange-500/20`}
          title="클릭 시, 분석된 저성과 SKU에 대한 맞춤형 근원 제거용 CSV를 다운로드합니다."
        >
          <div className={`text-4xl font-black group-hover:opacity-90 transition-opacity ${queueCount > 0 ? 'text-orange-400' : 'text-white'}`}>{queueCount || 0}</div>
          <div className="text-sm text-zinc-500 uppercase mt-1 group-hover:text-zinc-400 transition-colors">CSV Export</div>
            </div>
          </div>


      {/* Filter Panel Slot */}
      {filterContent}
    </div>
  )
}

export default SummaryCard
