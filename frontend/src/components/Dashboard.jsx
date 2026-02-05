import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { apiClient, API_BASE_URL } from '../lib/api'
import { useStore } from '../contexts/StoreContext'
import { useAuth } from '../contexts/AuthContext'
import { useAccount } from '../contexts/AccountContext'
import Toast from './Toast'
import { Loader2 } from 'lucide-react'

// API_BASE_URL is imported from api.js
// Use apiClient for requests requiring JWT authentication, use axios for requests without auth (e.g., health check)

// Demo Mode - Set to true to use dummy data (false for production with real API)
// Test mode: true = dummy data, false = real API
// Force redeploy: 2024-12-11 - Changed to false for real eBay testing
const DEMO_MODE = false

// Cache removed - fetch only when user explicitly triggers

// Dummy data for demo/testing
// Generate 100 dummy listings
const PRODUCT_TITLES = [
  'Wireless Bluetooth Headphones', 'LED Desk Lamp', 'Phone Charger Power Bank', 'Kitchen Knife Set',
  'Yoga Mat Non-Slip', 'Wireless Mouse Ergonomic', 'Smart Watch Fitness', 'Camping Tent Waterproof',
  'Coffee Maker Programmable', 'Bluetooth Speaker', 'Electric Toothbrush', 'Air Fryer Digital',
  'Gaming Keyboard RGB', 'Laptop Stand Adjustable', 'Webcam HD 1080p', 'USB Hub 7-Port',
  'Portable Monitor 15.6', 'Wireless Earbuds TWS', 'Smart Plug WiFi', 'LED Strip Lights',
  'Car Phone Mount', 'Dash Cam 4K', 'Tire Inflator Portable', 'Jump Starter Battery',
  'Vacuum Cleaner Cordless', 'Robot Vacuum Smart', 'Steam Mop Floor Cleaner', 'Air Purifier HEPA',
  'Humidifier Ultrasonic', 'Space Heater Ceramic', 'Electric Blanket Heated', 'Weighted Blanket 15lb',
  'Memory Foam Pillow', 'Mattress Topper Gel', 'Bed Sheets Egyptian', 'Blackout Curtains',
  'Smart Light Bulb', 'Security Camera WiFi', 'Video Doorbell HD', 'Smart Lock Keyless'
]
const SUPPLIERS = ['Amazon', 'Walmart', 'Home Depot', 'AliExpress', 'Costway', 'CJ Dropshipping', 'Banggood']

const generateDummyListings = (count) => {
  return Array.from({ length: count }, (_, i) => {
    const isZombie = Math.random() > 0.7 // 30% are zombies
    const supplier = SUPPLIERS[Math.floor(Math.random() * SUPPLIERS.length)]
    const sales = isZombie ? 0 : Math.floor(Math.random() * 50)
    const watches = isZombie ? Math.floor(Math.random() * 3) : Math.floor(Math.random() * 20)
    const views = isZombie ? Math.floor(Math.random() * 10) : Math.floor(Math.random() * 500)
    const daysListed = Math.floor(Math.random() * 90) + 7
    const zombieScore = isZombie ? Math.floor(Math.random() * 40) : Math.floor(Math.random() * 40) + 60
    
    // Determine if product goes through Shopify (30% chance)
    const goesThroughShopify = Math.random() < 0.3
    
    // Generate SKU based on supplier
    const skuPrefix = supplier === 'Amazon' ? 'B0' : supplier === 'Walmart' ? 'WM' : supplier === 'AliExpress' ? 'AE' : supplier === 'Home Depot' ? 'HD' : 'XX'
    const sku = `${skuPrefix}${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`
    
    return {
      id: String(i + 1),
      item_id: `eBay-${100000000 + i}`,
      title: `${PRODUCT_TITLES[i % PRODUCT_TITLES.length]} - Model ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) + 1}`,
      sku,
      price: Math.round((Math.random() * 150 + 10) * 100) / 100,
      supplier,
      supplier_name: supplier,
      total_sales: sales,
      watch_count: watches,
      impressions: Math.floor(Math.random() * 200),
      views,
      days_listed: daysListed,
      is_zombie: isZombie,
      zombie_score: zombieScore,
      recommendation: zombieScore <= 20 ? 'DELETE' : zombieScore <= 40 ? 'DELETE' : zombieScore <= 60 ? 'OPTIMIZE' : 'MONITOR',
      global_winner: Math.random() > 0.9,
      active_elsewhere: Math.random() > 0.8,
      // Add Shopify routing information
      management_hub: goesThroughShopify ? 'Shopify' : null,
      metrics: {
        sales,
        views,
        price: Math.round((Math.random() * 150 + 10) * 100) / 100,
        management_hub: goesThroughShopify ? 'Shopify' : undefined
      },
      analysis_meta: {
        management_hub: goesThroughShopify ? 'Shopify' : undefined
      },
      raw_data: {
        management_hub: goesThroughShopify ? 'Shopify' : undefined
      }
    }
  })
}

const DUMMY_ALL_LISTINGS = generateDummyListings(100)
const DUMMY_ZOMBIES = DUMMY_ALL_LISTINGS.filter(item => item.is_zombie)

const DUMMY_STORE = {
  id: 'store-1',
  name: 'My eBay Store',
  email: 'seller@ebay.com',
  platform: 'eBay'
}

function Dashboard() {
  const { selectedStore } = useStore()
  const { user } = useAuth()
  const { credits, refreshCredits } = useAccount()  // Use global credits from AccountContext
  const [searchParams] = useSearchParams()
  const viewParam = searchParams.get('view')
  
  // Get actual user ID from auth context - CRITICAL: No fallback to 'default-user'
  // If user is not logged in, API calls will fail with proper error messages
  const currentUserId = user?.id
  // Client state only
  // NOTE: Dashboard does not maintain product list state (only manages card numbers)
  const [isStoreConnected, setIsStoreConnected] = useState(false)
  // allListings, zombies removed from Dashboard (only managed in results screen)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [queue, setQueue] = useState([]) // Queue maintained as local state
  const [viewMode, setViewModeRaw] = useState('total')
  
  const setViewMode = setViewModeRaw
  const [historyLogs, setHistoryLogs] = useState(DEMO_MODE ? [
    { id: '1', title: 'Wireless Earbuds TWS - Model X1', sku: 'B012345678', supplier: 'Amazon', price: 29.99, deleted_at: '2024-12-05T10:30:00Z', reason: 'Zero sales in 30 days' },
    { id: '2', title: 'LED Strip Lights RGB', sku: 'WM87654321', supplier: 'Walmart', price: 15.99, deleted_at: '2024-12-05T09:15:00Z', reason: 'Low impressions' },
    { id: '3', title: 'Phone Case Clear', sku: 'AE11223344', supplier: 'AliExpress', price: 8.99, deleted_at: '2024-12-04T16:45:00Z', reason: 'Zero sales in 30 days' },
    { id: '4', title: 'USB-C Cable Fast Charge', sku: 'B098765432', supplier: 'Amazon', price: 12.99, deleted_at: '2024-12-04T14:20:00Z', reason: 'No watches' },
    { id: '5', title: 'Bluetooth Speaker Mini', sku: 'HD55667788', supplier: 'Home Depot', price: 24.99, deleted_at: '2024-12-03T11:00:00Z', reason: 'Zero sales in 30 days' },
    { id: '6', title: 'Yoga Mat Premium', sku: 'CW99887766', supplier: 'Costway', price: 35.99, deleted_at: '2024-12-03T09:30:00Z', reason: 'Low views' },
    { id: '7', title: 'Kitchen Timer Digital', sku: 'B055443322', supplier: 'Amazon', price: 9.99, deleted_at: '2024-12-02T15:10:00Z', reason: 'Zero sales in 30 days' },
    { id: '8', title: 'Desk Organizer Wood', sku: 'WM33221100', supplier: 'Walmart', price: 19.99, deleted_at: '2024-12-02T13:45:00Z', reason: 'Low impressions' },
    { id: '9', title: 'Laptop Stand Adjustable', sku: 'AE77889900', supplier: 'AliExpress', price: 22.99, deleted_at: '2024-12-01T10:20:00Z', reason: 'No watches' },
    { id: '10', title: 'Mouse Pad Large Gaming', sku: 'BG44556677', supplier: 'Banggood', price: 14.99, deleted_at: '2024-12-01T08:55:00Z', reason: 'Zero sales in 30 days' },
  ] : [])
  const [totalDeleted, setTotalDeleted] = useState(0) // Start at 0, updates from history
  const [showFilter, setShowFilter] = useState(false) // Default: filter collapsed
  
  // Summary statistics state (for Dashboard initial loading)
  const [summaryStats, setSummaryStats] = useState({
    activeCount: 0,
    lowPerformingCount: 0,
    queueCount: 0,
    lastSyncAt: null
  })
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [isSyncingListings, setIsSyncingListings] = useState(false) // Sync in progress state

  // Diagnosis zone: filter criteria and results
  const [criteria, setCriteria] = useState({
    periodDays: 7,
    maxViews: 0,
    maxWatches: 0
  })
  const [listings, setListings] = useState([])
  const [lowPerformingCount, setLowPerformingCount] = useState(null) // null = not analyzed yet
  const [lowPerformingItems, setLowPerformingItems] = useState([]) // filtered items for CSV export
  const [showDiagnosisResult, setShowDiagnosisResult] = useState(false)
  const [isAnalyzingListings, setIsAnalyzingListings] = useState(false)
  const [isDownloadingShopifyCSV, setIsDownloadingShopifyCSV] = useState(false)
  
  // Result display flag (only shown when Find button is clicked)
  const [showResults, setShowResults] = useState(false)
  const [resultsMode, setResultsMode] = useState('low') // 'all' or 'low'
  const [resultsFilters, setResultsFilters] = useState(null)
  
  // Analysis result state
  const [analysisResult, setAnalysisResult] = useState(null) // { count, items, requestId, filters }
  
  // Confirm Modal state (credit consumption confirmation)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [pendingAnalysisFilters, setPendingAnalysisFilters] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [requiredCredits, setRequiredCredits] = useState(1)  // Value received from quote
  const [isFetchingQuote, setIsFetchingQuote] = useState(false)  // Flag for quote call in progress
  
  // OAuth callback verification guard - prevent multiple simultaneous verifications
  const isVerifyingConnection = useRef(false)
  const verificationAttemptCount = useRef(0)
  // Sync-in-progress ref so guard works before state updates (prevents double sync/OAuth re-fire)
  const syncInProgressRef = useRef(false)
  const MAX_VERIFICATION_ATTEMPTS = 6
  const VERIFICATION_BACKOFF_MS = [500, 1000, 1500, 2000, 2500, 3000] // Progressive backoff
  
  // API Health Check State
  const [apiConnected, setApiConnected] = useState(false)
  const [apiError, setApiError] = useState(null)
  
  // Error Modal State
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorModalMessage, setErrorModalMessage] = useState('')
  
  // Toast Notification State
  const [toast, setToast] = useState(null) // { message, type: 'error' | 'success' | 'warning' }
  
  // Platform Select Modal State
  const [showPlatformModal, setShowPlatformModal] = useState(false)
  const [isExportingCSV, setIsExportingCSV] = useState(false)
  
  // Error message generation function by error type
  const getErrorMessage = (err) => {
    if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
      return 'Network error. Please try again.'
    }
    if (err.response?.status === 401 || err.response?.status === 403) {
      return 'Please reconnect your eBay account.'
    }
    if (err.response?.status === 402) {
      // Insufficient credits
      const errorData = err.response?.data?.detail || {}
      return errorData.message || 'Insufficient credits. Please purchase more credits.'
    }
    if (err.response?.status >= 500) {
      return 'Server error. Try again later.'
    }
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return 'Request timeout. Please try again.'
    }
    return err.response?.data?.detail?.message || err.response?.data?.error || err.message || 'An error occurred. Please try again.'
  }
  
  // Toast display function
  const showToast = (message, type = 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000) // Auto remove after 5 seconds
  }
  
  // Filtering Modal State (legacy - maintain if needed)
  const [showFilteringModal, setShowFilteringModal] = useState(false)
  const [isFiltering, setIsFiltering] = useState(false)
  const [pendingFiltersForModal, setPendingFiltersForModal] = useState(null)
  
  // User Credits & Plan State (from AccountContext)
  const [usedCredits, setUsedCredits] = useState(0)
  const [userPlan, setUserPlan] = useState('FREE')
  const [connectedStoresCount, setConnectedStoresCount] = useState(1)
  
  const [filters, setFilters] = useState({
    marketplace_filter: 'eBay',
    analytics_period_days: 7,
    min_days: 7,
    max_sales: 0,
    max_watches: 0,
    max_watch_count: 0,
    max_impressions: 100,
    max_views: 10,
    supplier_filter: 'All'
  })

  // Derived values only (using summaryStats)
  // Dashboard does not use allListings/zombies, only uses summaryStats
  const totalListings = useMemo(() => summaryStats.activeCount || 0, [summaryStats.activeCount])
  // LOW-PERFORMING card number: analysisResult?.count ?? summaryStats.lowPerformingCount
  const totalZombies = useMemo(() => {
    return analysisResult?.count ?? summaryStats.lowPerformingCount ?? 0
  }, [analysisResult?.count, summaryStats.lowPerformingCount])
  
  // Breakdown not provided by summary API, so use empty object
  const totalBreakdown = useMemo(() => ({}), [])
  const platformBreakdown = useMemo(() => ({ eBay: totalListings }), [totalListings])
  const zombieBreakdown = useMemo(() => ({}), [])
  
  // API Health Check - Check connection on mount
  // Health check does not require authentication, so use axios
  const checkApiHealth = async () => {
    try {
      // Health check does not require authentication, so use axios (but timeout increased to 60 seconds)
      const response = await axios.get(`${API_BASE_URL}/api/health`, { 
        timeout: 60000,
        headers: {
            'Content-Type': 'application/json',
          },
        })
      if (response.status === 200) {
        setApiConnected(true)
        setApiError(null)
        return true
      }
    } catch (err) {
      // Handle all errors: 502 Bad Gateway, network errors, CORS errors, etc.
      if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED') {
        console.warn('API Health Check failed: Server may be down or unreachable')
      } else {
        console.error('API Health Check failed:', err)
      }
      setApiConnected(false)
      // More specific message for 502 errors
      if (err.response?.status === 502) {
        setApiError('Backend server error (502) - Please check Railway server')
      } else if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED') {
        setApiError('Network error - Cannot connect to server')
      } else if (err.response?.status === 0 || err.message?.includes('CORS')) {
        setApiError('CORS error - Please redeploy backend server')
      } else {
        setApiError(`Connection error: ${err.message || 'Unknown error'}`)
      }
      return false
    }
    return false
  }
  
  // Credits are now managed by AccountContext - no local fetchUserCredits needed

  // Sync eBay listings (automatically called after OAuth connection)
  const syncEbayListings = async () => {
    // CRITICAL: No sync if user is not logged in
    if (!currentUserId) {
      console.error('❌ [SYNC] Cannot sync: user is not logged in')
      showToast('Please log in to sync listings', 'error')
      return
    }
    
    // Prevent duplicate sync: use ref so guard works before state updates (prevents OAuth re-fire loop)
    if (syncInProgressRef.current) {
      console.log('🔄 [SYNC] Sync already in progress, skipping duplicate trigger')
      return
    }
    syncInProgressRef.current = true
    
    // Set timeout for syncing state (60 seconds)
    let syncTimeout = null
    let syncAccepted202 = false // When true, do NOT clear isSyncingListings in finally (polling owns it)
    
    try {
      setIsSyncingListings(true)
      
      // Set timeout for syncing state (60 seconds)
      syncTimeout = setTimeout(() => {
        console.warn('⚠️ [SYNC] Sync is taking longer than expected (>60s)')
        showToast('Sync is taking longer than expected. Please refresh in a moment.', 'warning')
        syncInProgressRef.current = false
        setIsSyncingListings(false)
      }, 60000) // 60 second timeout
      console.log('🔄 [SYNC] Starting eBay listings sync...')
      console.log('   user_id:', currentUserId)
      
          // Use apiClient for requests requiring JWT authentication (Authorization header automatically added)
          // Fire and Forget pattern: Immediately receive 202 Accepted and sync in background
          // Use 60 second timeout (should receive 202 response within 1-2 seconds, but allow buffer for network issues)
          const response = await apiClient.post(`/api/ebay/listings/sync`, null, {
            timeout: 60000 // 60 second timeout (should receive 202 response quickly, but allow buffer for network issues)
          })
      
      // Handle 202 Accepted response (background job started) — keep SYNCING state until polling completes
      // Distinguish between 202 (background job) and other success codes (200, 201)
      if (response.status === 202) {
        syncAccepted202 = true
        showToast('Sync in progress... This may take a minute.', 'info')
        sessionStorage.setItem('last_sync_response', JSON.stringify(response.data))
        
        // ✅ Smooth UI Polling: Poll every 5 seconds until sync completes or timeout
        const MAX_POLL_ATTEMPTS = 24 // 24 attempts * 5 seconds = 120 seconds max
        let pollAttempts = 0
        let syncCompleted = false
        
        const pollForCompletion = async () => {
          if (pollAttempts >= MAX_POLL_ATTEMPTS) {
            showToast('Sync is taking longer than expected. Use "Manual Refresh" button to check status.', 'warning')
            syncInProgressRef.current = false
            setIsSyncingListings(false)
            try {
              await fetchSummaryStats()
            } catch (err) {
              console.error('❌ [SYNC] Final fetch failed:', err)
            }
            return
          }
          
          pollAttempts++
          console.log(`🔄 [SYNC] Polling attempt ${pollAttempts}/${MAX_POLL_ATTEMPTS}...`)
          
          try {
            // Poll summary stats to check if sync completed
            // Increased timeout to 120 seconds to prevent ECONNABORTED errors
            const summaryResponse = await apiClient.get(`/api/ebay/summary`, {
              params: {
                filters: JSON.stringify(filters)
              },
              timeout: 120000,  // 120 seconds timeout (2 minutes)
            })
            
            if (summaryResponse.data && summaryResponse.data.success) {
              const activeCount = summaryResponse.data.active_count || 0
              const lowPerformingCount = summaryResponse.data.low_performing_count || 0
              const queueCount = summaryResponse.data.queue_count || 0
              const lastSyncAt = summaryResponse.data.last_sync_at || null
              
              // Update state
              setSummaryStats({
                activeCount: activeCount,
                lowPerformingCount: lowPerformingCount,
                queueCount: queueCount,
                lastSyncAt: lastSyncAt
              })
              
              // Check if sync completed (REAL count > 0 - this is the critical check)
              if (activeCount > 0) {
                showToast(`Sync completed: ${activeCount} active listings`, 'success')
                syncCompleted = true
                syncInProgressRef.current = false
                setIsSyncingListings(false)
                // Final refresh
                await fetchSummaryStats()
                return
              } else {
                // Still syncing (count is still 0), continue polling
                console.log(`ℹ️ [SYNC] Sync in progress... (activeCount: ${activeCount}, attempt ${pollAttempts})`)
                // Keep syncing state active until count > 0
                setTimeout(pollForCompletion, 5000) // Poll again in 5 seconds
              }
            } else {
              setTimeout(pollForCompletion, 5000)
            }
          } catch (pollErr) {
            // Handle ECONNABORTED and other errors gracefully
            const isTimeout = pollErr.code === 'ECONNABORTED' || pollErr.message?.includes('timeout')
            const isNetworkError = pollErr.message?.includes('Network Error') || !pollErr.response
            
            if (isTimeout || isNetworkError) {
              if (pollAttempts < MAX_POLL_ATTEMPTS) {
                setTimeout(pollForCompletion, 5000)
              } else {
                // Max attempts reached
                console.error('❌ [SYNC] Max polling attempts reached after timeout/network errors')
                showToast('Sync status check timed out. Use "Manual Refresh" button to check status.', 'warning')
                syncInProgressRef.current = false
                setIsSyncingListings(false)
                try {
                  await fetchSummaryStats()
                } catch (err) {
                  console.error('❌ [SYNC] Final fetch failed:', err)
                }
              }
            } else {
              // Other errors (4xx, 5xx)
              console.error(`❌ [SYNC] Polling error (attempt ${pollAttempts}):`, pollErr)
              if (pollAttempts < MAX_POLL_ATTEMPTS) {
                setTimeout(pollForCompletion, 5000)
              } else {
                console.error('❌ [SYNC] Max polling attempts reached')
                showToast('Sync status check failed. Use "Manual Refresh" button.', 'error')
                syncInProgressRef.current = false
                setIsSyncingListings(false)
                try {
                  await fetchSummaryStats()
                } catch (err) {
                  console.error('❌ [SYNC] Final fetch failed:', err)
                }
              }
            }
          }
        }
        
        // Start polling after initial 5 second delay
        setTimeout(pollForCompletion, 5000)
        
        // Note: fetched and upserted are not available in 202 response
        // They will be available after background sync completes
      } else if (response.status >= 200 && response.status < 300) {
        // Handle other success codes (200, 201) - immediate completion
        showToast('Sync completed successfully', 'success')
        // Refresh summary stats immediately for non-202 responses
        await fetchSummaryStats()
      } else {
        // Handle error responses (4xx, 5xx)
        throw new Error(response.data?.message || `Sync failed with status ${response.status}`)
      }
    } catch (err) {
      syncInProgressRef.current = false
      console.error('❌ [SYNC] Sync error:', err)
      
      // ✅ 2. eBay data collection issue resolution: Show clear message on token error
      let errorMessage = err.response?.data?.detail?.message || err.response?.data?.message || err.message || 'Failed to sync listings'
      
      // Show reconnection message for 401/403 errors
      if (err.response?.status === 401 || err.response?.status === 403) {
        errorMessage = 'eBay connection expired. Please click "Connect eBay" button to reconnect.'
        console.error('❌ [SYNC] Token expired or invalid - Reconnection required')
      }
      // Check for token-related error messages
      else if (errorMessage.toLowerCase().includes('token') || 
               errorMessage.toLowerCase().includes('expired') || 
               errorMessage.toLowerCase().includes('reconnect')) {
        errorMessage = 'eBay connection expired. Please click "Connect eBay" button to reconnect.'
        console.error('❌ [SYNC] Token-related error detected - Reconnection required')
      }
      
      showToast(`Sync failed: ${errorMessage}`, 'error')
      
      // Fetch summary stats even if sync fails (to show existing data)
      fetchSummaryStats().catch(fetchErr => {
        console.error('Failed to fetch summary stats after sync error:', fetchErr)
      })
    } finally {
      if (syncTimeout) {
        clearTimeout(syncTimeout)
      }
      // Only clear SYNCING when we did NOT receive 202 (polling owns state for 202)
      if (!syncAccepted202) {
        syncInProgressRef.current = false
        setIsSyncingListings(false)
      }
    }
  }

  // Fetch summary statistics (lightweight stats only)
  const fetchSummaryStats = async () => {
    // CRITICAL: No fetch if user is not logged in
    if (!currentUserId) {
      console.warn('⚠️ [SUMMARY] Cannot fetch: user is not logged in')
      setSummaryStats({
        activeCount: 0,
        lowPerformingCount: 0,
        queueCount: 0,
        lastSyncAt: null
      })
      return
    }
    
    try {
      setSummaryLoading(true)
      console.log('📊 [SUMMARY] Fetching summary statistics...')
      console.log('   user_id:', currentUserId)
      console.log('   API URL:', `${API_BASE_URL}/api/ebay/summary`)
      
      if (DEMO_MODE) {
        // Use dummy data in demo mode
        setSummaryStats({
          activeCount: DUMMY_ALL_LISTINGS.length,
          lowPerformingCount: DUMMY_ZOMBIES.length,
          queueCount: queue.length,
          lastSyncAt: new Date().toISOString()
        })
        setSummaryLoading(false)
        return
      }
      
      // ✅ 3. Filter matching verification: Log filters sent from frontend
      console.log('📊 [SUMMARY] Sending filters to backend:')
      console.log('   - filters object:', filters)
      console.log('   - filters JSON stringified:', JSON.stringify(filters))
      
      // Use apiClient for requests requiring JWT authentication (Authorization header automatically added)
      // Increased timeout to 120 seconds to prevent ECONNABORTED errors during sync
      const response = await apiClient.get(`/api/ebay/summary`, {
        params: {
          filters: JSON.stringify(filters) // Pass filter parameters
        },
        timeout: 120000,  // 120 seconds timeout (2 minutes) - prevent timeout during background sync
      })
      
      // 🔍 STEP 3: Summary aggregation logic check - verify query conditions and results
      console.log('='.repeat(60))
      console.log('📊 [SUMMARY] /api/ebay/summary response JSON:')
      console.log(JSON.stringify(response.data, null, 2))
      console.log('='.repeat(60))
      
      // Case branch: upserted>0 but active_count=0
      if (response.data && response.data.success) {
        const { active_count, user_id, low_performing_count } = response.data
        
        console.log('🔍 [SUMMARY STEP 3] Summary Query Result:')
        console.log(`   - Active count (DB query result): ${active_count}`)
        console.log(`   - Query user_id: ${user_id}`)
        console.log(`   - Current user_id (should match): ${currentUserId}`)
        console.log(`   - Query platform: eBay (assumed)`)
        console.log(`   - Low-performing count: ${low_performing_count}`)
        
        // ✅ FIX: Define syncData first before using
        const lastSyncResponse = sessionStorage.getItem('last_sync_response')
        let syncData = null
        let syncUpserted = 0
        if (lastSyncResponse) {
          try {
            syncData = JSON.parse(lastSyncResponse)
            syncUpserted = syncData.upserted || 0
          } catch (parseErr) {
            console.warn('⚠️ [SUMMARY] Failed to parse last sync response:', parseErr)
          }
        }
        
        console.log('🔍 [SUMMARY] Sync vs Summary comparison:')
        console.log(`   - eBay API Fetch Count: ${syncData?.fetched || 0}`)
        console.log(`   - DB Upsert Count: ${syncData?.upserted || 0}`)
        console.log(`   - Summary active_count: ${active_count}`)
        console.log(`   - Summary user_id: ${user_id}`)
        console.log(`   - Summary platform: eBay (assumed)`)
        
        // Comparison analysis
        if (syncUpserted > 0 && active_count === 0) {
          console.error('❌ [COMPARISON] MISMATCH DETECTED:')
          console.error(`   - ${syncUpserted} items saved to DB but summary query returns 0`)
          console.error('   Possible causes:')
          console.error('   1. user_id mismatch (sync: ' + currentUserId + ', summary: ' + user_id + ')')
          console.error('   2. platform field mismatch (sync: eBay, summary query: eBay)')
          console.error('   3. Query condition issue (status filtering, etc.)')
        } else if (syncUpserted === active_count && syncUpserted > 0) {
          console.log('✅ [COMPARISON] Match: DB upsert count and summary count are identical')
        }
        
        // Auto-call debug endpoint if upserted>0 but active_count=0
        if (lastSyncResponse && syncData) {
          console.log(`   - Last sync upserted: ${syncUpserted}`)
          
          if (syncUpserted > 0 && active_count === 0) {
            console.warn('⚠️ [SUMMARY] MISMATCH: upserted>0 but active_count=0')
            console.warn('   Calling debug endpoint to check DB state...')
            
            // Call debug endpoint
            try {
              // Use apiClient for requests requiring JWT authentication (Authorization header automatically added)
              const debugResponse = await apiClient.get(`/api/debug/listings`, {
                params: {
                  platform: 'eBay'
                },
                timeout: 30000
              })
              
              console.log('='.repeat(60))
              console.log('🔍 [DEBUG] /api/debug/listings response JSON:')
              console.log(JSON.stringify(debugResponse.data, null, 2))
              console.log('='.repeat(60))
              
              if (debugResponse.data && debugResponse.data.count > 0) {
                console.warn('⚠️ [DEBUG] Listings exist in DB but summary query returns 0')
                console.warn('   Possible query key mismatch - keys_match:', debugResponse.data.keys_match)
              } else {
                console.warn('⚠️ [DEBUG] No listings in DB either - sync upsert may not have actually saved')
              }
            } catch (debugErr) {
              console.error('❌ [DEBUG] Debug endpoint call failed:', debugErr)
            }
          }
        }
        
        console.log('✅ [SUMMARY] Successfully fetched summary:', response.data)
        
        // ✅ 3. UI Sync: Always update screen numbers if summary API response data exists
        const activeCount = response.data.active_count || 0
        const lowPerformingCount = response.data.low_performing_count || 0
        const queueCount = response.data.queue_count || 0
        const lastSyncAt = response.data.last_sync_at || null
        
        // Always update state if response data exists (update even if 0)
        setSummaryStats({
          activeCount: activeCount,
          lowPerformingCount: lowPerformingCount,
          queueCount: queueCount,
          lastSyncAt: lastSyncAt
        })
        console.log(`✅ [SUMMARY] UI updated: activeCount=${activeCount}, lowPerformingCount=${lowPerformingCount}`)
      } else {
        console.warn('⚠️ fetchSummaryStats: Unexpected response format:', response.data)
        // Try to update even if response format differs from expected, as long as active_count exists
        if (response.data && typeof response.data.active_count === 'number') {
          setSummaryStats({
            activeCount: response.data.active_count || 0,
            lowPerformingCount: response.data.low_performing_count || 0,
            queueCount: response.data.queue_count || 0,
            lastSyncAt: response.data.last_sync_at || null
          })
          console.log(`✅ [SUMMARY] UI updated from partial response: activeCount=${response.data.active_count}`)
        }
      }
    } catch (err) {
      console.error('❌ fetchSummaryStats error:', err)
      if (err.response?.status === 401) {
        console.warn('⚠️ Not authenticated - summary stats not available')
        setSummaryStats({
          activeCount: 0,
          lowPerformingCount: 0,
          queueCount: 0,
          lastSyncAt: null
        })
      } else {
        // Set default values even on error
        setSummaryStats({
          activeCount: 0,
          lowPerformingCount: 0,
          queueCount: 0,
          lastSyncAt: null
        })
      }
    } finally {
      setSummaryLoading(false)
    }
  }

  // Auto-detect supplier function (returns both supplier_name and supplier_id)
  // Priority: Automation tool > Supplier
  const extractSupplierInfo = (title, sku = '', imageUrl = '') => {
    if (!title && !sku) return { supplier_name: 'Unknown', supplier_id: null }
    
    const text = `${title} ${sku}`.toLowerCase()
    const skuUpper = sku.toUpperCase()
    const titleLower = (title || '').toLowerCase()
    const imageUrlLower = (imageUrl || '').toLowerCase()
    
    // Split SKU by hyphen(-) or underscore(_) for analysis
    const skuParts = skuUpper.split(/[-_]/)
    
    // ============================================
    // Automation tool detection (high priority)
    // ============================================
    
    // AutoDS detection
    if (
      skuUpper.startsWith('AUTODS') ||
      skuUpper.startsWith('ADS') ||
      skuUpper.startsWith('AD-') ||
      skuUpper.includes('AUTODS') ||
      text.includes('autods') ||
      imageUrlLower.includes('autods')
    ) {
      // Try to extract actual supplier from AutoDS SKU (e.g., "AUTODS-AMZ-B08ABC1234" → "B08ABC1234")
      let remainingSku = null
      if (skuUpper.startsWith('AUTODS')) {
        remainingSku = skuUpper.replace('AUTODS', '').replace(/^[-_]/, '').trim()
      } else if (skuUpper.startsWith('ADS')) {
        remainingSku = skuUpper.replace('ADS', '').replace(/^[-_]/, '').trim()
      } else if (skuUpper.startsWith('AD-')) {
        remainingSku = skuUpper.replace('AD-', '').trim()
      }
      
      // Extract actual supplier ID from remaining SKU (recursive parsing)
      let supplierId = null
      if (remainingSku) {
        const remainingParts = remainingSku.split(/[-_]/)
        
        // Find Amazon ASIN pattern (10 characters starting with B0)
        const amazonAsinPattern = /B0[0-9A-Z]{8}/
        const asinMatch = remainingSku.match(amazonAsinPattern)
        if (asinMatch) {
          supplierId = asinMatch[0]
        }
        // Find ASIN after removing AMZ prefix
        else if (remainingParts[0] === 'AMZ' && remainingParts.length > 1) {
          // "AMZ-B08ABC1234" → "B08ABC1234"
          for (let i = 1; i < remainingParts.length; i++) {
            if (amazonAsinPattern.test(remainingParts[i])) {
              supplierId = remainingParts[i]
              break
            }
          }
          if (!supplierId) {
            // If no ASIN pattern found, use remaining parts as ID
            supplierId = remainingParts.slice(1).join('-') || null
          }
        }
        // Walmart pattern (remove WM prefix)
        else if (remainingParts[0] === 'WM' || remainingParts[0] === 'WMT' || remainingParts[0] === 'WALMART') {
          // "WM-123456" → "123456"
          supplierId = remainingParts.slice(1).join('-') || null
        }
        // AliExpress pattern (remove AE, ALI prefix)
        else if (remainingParts[0] === 'AE' || remainingParts[0] === 'ALI' || remainingParts[0] === 'ALIEXPRESS') {
          // "AE-789012" → "789012"
          supplierId = remainingParts.slice(1).join('-') || null
        }
        // Other supplier patterns
        else if (['CJ', 'HD', 'WF', 'CO', 'CW', 'BG'].includes(remainingParts[0])) {
          // "CJ-345678" → "345678"
          supplierId = remainingParts.slice(1).join('-') || null
        }
        else {
          // If no pattern found, use entire string as ID (except AutoDS prefix)
          supplierId = remainingSku || null
        }
      }
      
      return { supplier_name: 'AutoDS', supplier_id: supplierId }
    }
    
    // Yaballe detection
    if (
      skuUpper.startsWith('YABALLE') ||
      skuUpper.startsWith('YAB-') ||
      skuUpper.startsWith('YB-') ||
      skuUpper.includes('YABALLE') ||
      text.includes('yaballe') ||
      imageUrlLower.includes('yaballe')
    ) {
      // Try to extract actual supplier from Yaballe SKU (e.g., "YABALLE-AMZ-B08ABC1234" → "B08ABC1234")
      let remainingSku = null
      if (skuUpper.startsWith('YABALLE')) {
        remainingSku = skuUpper.replace('YABALLE', '').replace(/^[-_]/, '').trim()
      } else if (skuUpper.startsWith('YAB-')) {
        remainingSku = skuUpper.replace('YAB-', '').trim()
      } else if (skuUpper.startsWith('YB-')) {
        remainingSku = skuUpper.replace('YB-', '').trim()
      } else if (skuUpper.startsWith('YAB')) {
        remainingSku = skuUpper.replace('YAB', '').replace(/^[-_]/, '').trim()
      } else if (skuUpper.startsWith('YB')) {
        remainingSku = skuUpper.replace('YB', '').replace(/^[-_]/, '').trim()
      }
      
      // Extract actual supplier ID from remaining SKU (recursive parsing)
      let supplierId = null
      if (remainingSku) {
        const remainingParts = remainingSku.split(/[-_]/)
        
        // Find Amazon ASIN pattern (10 characters starting with B0)
        const amazonAsinPattern = /B0[0-9A-Z]{8}/
        const asinMatch = remainingSku.match(amazonAsinPattern)
        if (asinMatch) {
          supplierId = asinMatch[0]
        }
        // Find ASIN after removing AMZ prefix
        else if (remainingParts[0] === 'AMZ' && remainingParts.length > 1) {
          // "AMZ-B08ABC1234" → "B08ABC1234"
          for (let i = 1; i < remainingParts.length; i++) {
            if (amazonAsinPattern.test(remainingParts[i])) {
              supplierId = remainingParts[i]
              break
            }
          }
          if (!supplierId) {
            // If no ASIN pattern found, use remaining parts as ID
            supplierId = remainingParts.slice(1).join('-') || null
          }
        }
        // Walmart pattern (remove WM prefix)
        else if (remainingParts[0] === 'WM' || remainingParts[0] === 'WMT' || remainingParts[0] === 'WALMART') {
          // "WM-123456" → "123456"
          supplierId = remainingParts.slice(1).join('-') || null
        }
        // AliExpress pattern (remove AE, ALI prefix)
        else if (remainingParts[0] === 'AE' || remainingParts[0] === 'ALI' || remainingParts[0] === 'ALIEXPRESS') {
          // "AE-789012" → "789012"
          supplierId = remainingParts.slice(1).join('-') || null
        }
        // Other supplier patterns
        else if (['CJ', 'HD', 'WF', 'CO', 'CW', 'BG'].includes(remainingParts[0])) {
          // "CJ-345678" → "345678"
          supplierId = remainingParts.slice(1).join('-') || null
        }
        else {
          // If no pattern found, use entire string as ID (except Yaballe prefix)
          supplierId = remainingSku || null
        }
      }
      
      return { supplier_name: 'Yaballe', supplier_id: supplierId }
    }
    
    // Wholesale2B detection
    if (
      skuUpper.startsWith('W2B') ||
      skuUpper.startsWith('WHOLESALE2B') ||
      skuUpper.includes('W2B') ||
      skuUpper.includes('WHOLESALE2B') ||
      text.includes('wholesale2b') ||
      imageUrlLower.includes('wholesale2b')
    ) {
      const supplierId = skuUpper.startsWith('W2B') 
        ? skuUpper.replace('W2B', '').replace(/^[-_]/, '').trim() || null
        : null
      return { supplier_name: 'Wholesale2B', supplier_id: supplierId }
    }
    
    // ============================================
    // Supplier detection (SKU pattern first, then title/image)
    // ============================================
    
    // Amazon detection (ASIN pattern starting with B0)
    const amazonAsinPattern = /B0[0-9A-Z]{8}/i
    if (amazonAsinPattern.test(sku) || text.includes('amazon') || text.includes('amz-') || 
        imageUrlLower.includes('amazon') || imageUrlLower.includes('ssl-images-amazon')) {
      // Extract ASIN
      const asinMatch = sku.match(amazonAsinPattern)
      const supplierId = asinMatch ? asinMatch[0] : (skuUpper.startsWith('AMZ') ? skuUpper.replace('AMZ', '').replace(/^[-_]/, '').trim() || null : null)
      return { supplier_name: 'Amazon', supplier_id: supplierId }
    }
    
    // AliExpress detection
    if (/^ae\d/i.test(sku) || text.includes('aliexpress') || text.includes('ali-') || text.includes('alibaba') ||
        imageUrlLower.includes('alicdn') || imageUrlLower.includes('aliexpress')) {
      const supplierId = /^ae(\d+)/i.test(sku) ? sku.match(/^ae(\d+)/i)[1] : (skuUpper.startsWith('AE') ? skuUpper.replace('AE', '').replace(/^[-_]/, '').trim() || null : null)
      return { supplier_name: 'AliExpress', supplier_id: supplierId }
    }
    
    // Walmart detection
    if (skuUpper.startsWith('WM') || skuUpper.startsWith('WMT') || text.includes('walmart') || text.includes('wmt-') ||
        imageUrlLower.includes('walmartimages') || imageUrlLower.includes('walmart.com')) {
      const supplierId = (skuUpper.startsWith('WM') || skuUpper.startsWith('WMT'))
        ? skuUpper.replace(/^(WM|WMT)/, '').replace(/^[-_]/, '').trim() || null
        : null
      return { supplier_name: 'Walmart', supplier_id: supplierId }
    }
    
    // Home Depot detection
    if (skuUpper.startsWith('HD') || text.includes('home depot') || text.includes('homedepot') || text.includes('hd-') ||
        imageUrlLower.includes('homedepot')) {
      const supplierId = skuUpper.startsWith('HD') 
        ? skuUpper.replace('HD', '').replace(/^[-_]/, '').trim() || null
        : null
      return { supplier_name: 'Home Depot', supplier_id: supplierId }
    }
    
    // CJ Dropshipping detection
    if (/^cj\d/i.test(sku) || text.includes('cj drop') || text.includes('cjdrop') || text.includes('cjdropshipping') ||
        imageUrlLower.includes('cjdropshipping')) {
      const supplierId = /^cj(\d+)/i.test(sku) ? sku.match(/^cj(\d+)/i)[1] : (skuUpper.startsWith('CJ') ? skuUpper.replace('CJ', '').replace(/^[-_]/, '').trim() || null : null)
      return { supplier_name: 'CJ Dropshipping', supplier_id: supplierId }
    }
    
    // Costway detection
    if (skuUpper.startsWith('CW') || text.includes('costway') || imageUrlLower.includes('costway')) {
      const supplierId = skuUpper.startsWith('CW') 
        ? skuUpper.replace('CW', '').replace(/^[-_]/, '').trim() || null
        : null
      return { supplier_name: 'Costway', supplier_id: supplierId }
    }
    
    // Banggood detection
    if (skuUpper.startsWith('BG') || text.includes('banggood') || text.includes('bg-') || imageUrlLower.includes('banggood')) {
      const supplierId = skuUpper.startsWith('BG') 
        ? skuUpper.replace('BG', '').replace(/^[-_]/, '').trim() || null
        : null
      return { supplier_name: 'Banggood', supplier_id: supplierId }
    }
    
    // Doba detection
    if (skuUpper.startsWith('DOBA') || text.includes('doba') || imageUrlLower.includes('doba')) {
      const supplierId = skuUpper.startsWith('DOBA') 
        ? skuUpper.replace('DOBA', '').replace(/^[-_]/, '').trim() || null
        : null
      return { supplier_name: 'Doba', supplier_id: supplierId }
    }
    
    // DSers detection
    if (skuUpper.startsWith('DSERS') || text.includes('dsers') || imageUrlLower.includes('dsers')) {
      const supplierId = skuUpper.startsWith('DSERS') 
        ? skuUpper.replace('DSERS', '').replace(/^[-_]/, '').trim() || null
        : null
      return { supplier_name: 'DSers', supplier_id: supplierId }
    }
    
    // Spocket detection
    if (skuUpper.startsWith('SPK') || text.includes('spocket') || imageUrlLower.includes('spocket')) {
      const supplierId = skuUpper.startsWith('SPK') 
        ? skuUpper.replace('SPK', '').replace(/^[-_]/, '').trim() || null
        : null
      return { supplier_name: 'Spocket', supplier_id: supplierId }
    }
    
    // Common pattern: SKU starting with D (e.g., D0102HEVLYJ-KS Z1 BPNK)
    // Classify these as "Unverified"
    if (skuUpper.startsWith('D') && /^D\d/.test(skuUpper)) {
      return { supplier_name: 'Unverified', supplier_id: null }
    }
    
    return { supplier_name: 'Unknown', supplier_id: null }
  }
  
  // Legacy function (backward compatibility)
  const detectSupplier = (title, sku = '') => {
    const result = extractSupplierInfo(title, sku)
    return result.supplier_name
  }

  // Performance Score calculation function (lower score = lower performance)
  const calculateZombieScore = (listing, filterParams) => {
    let score = 100 // Start with perfect score
    const daysListed = listing.days_listed || 0
    const sales = listing.quantity_sold || 0
    const watches = listing.watch_count || 0
    const views = listing.view_count || 0
    
    // Score decreases as listing period increases
    if (daysListed >= 60) score -= 30
    else if (daysListed >= 30) score -= 20
    else if (daysListed >= 14) score -= 10
    
    // Score decreases if no sales
    if (sales === 0) score -= 30
    
    // Score decreases if no watches
    if (watches === 0) score -= 20
    else if (watches <= 2) score -= 10
    
    // Score decreases if views are low
    if (views <= 5) score -= 20
    else if (views <= 10) score -= 10
    
    return Math.max(0, Math.min(score, 100))
  }

  // NOTE: applyLocalFilter removed from Dashboard
  // Filtering is performed server-side in LowPerformingResults component on /listings page

  // Handle store connection change
  // Flag to prevent duplicate calls
  const handleStoreConnectionInProgress = useRef(false)
  
  const handleStoreConnection = (connected, forceLoad = false) => {
    // Prevent duplicate calls - check if state is already set
    if (connected === isStoreConnected && !forceLoad) {
      console.log('⚠️ handleStoreConnection: State already matches, skipping')
      return
    }
    
    // Prevent duplicate execution
    if (handleStoreConnectionInProgress.current) {
      console.warn('⚠️ handleStoreConnection already in progress, skipping duplicate call')
      return
    }
    
    console.log('🔄 handleStoreConnection:', { connected, forceLoad, currentState: isStoreConnected })
    handleStoreConnectionInProgress.current = true
    setIsStoreConnected(connected)
    
    // Clear data when disconnected
    if (!connected) {
      setViewMode('total')
      setShowFilter(false)
      setSummaryStats({
        activeCount: 0,
        lowPerformingCount: 0,
        queueCount: 0,
        lastSyncAt: null
      })
      handleStoreConnectionInProgress.current = false
    } else {
      // When connected, fetch summary stats only (not full listings)
      if (DEMO_MODE) {
        setSummaryStats({
          activeCount: DUMMY_ALL_LISTINGS.length,
          lowPerformingCount: DUMMY_ZOMBIES.length,
          queueCount: queue.length,
          lastSyncAt: new Date().toISOString()
        })
        handleStoreConnectionInProgress.current = false
      } else if (forceLoad) {
        // Even if forceLoad is true, only fetch summary stats
        console.log('📦 handleStoreConnection: forceLoad=true, calling fetchSummaryStats() only')
        setTimeout(() => {
          fetchSummaryStats().then(() => {
            handleStoreConnectionInProgress.current = false
          }).catch(err => {
            console.error('Failed to fetch summary stats after connection:', err)
            handleStoreConnectionInProgress.current = false
          })
        }, 200)
      } else {
        // If forceLoad is false, only fetch summary stats
        fetchSummaryStats().then(() => {
          handleStoreConnectionInProgress.current = false
        }).catch(err => {
          console.error('Failed to fetch summary stats:', err)
          handleStoreConnectionInProgress.current = false
        })
      }
    }
  }

  // NOTE: Dashboard never loads product list
  // fetchAllListings function is used in LowPerformingResults component on /listings page

  const fetchHistory = async () => {
    try {
      // Don't set loading to true here to avoid blocking other operations
      // Use apiClient for requests requiring JWT authentication (Authorization header automatically added)
      const response = await apiClient.get(`/api/history`, {
        params: {
          skip: 0,
          limit: 10000
        }
      })
      setHistoryLogs(response.data.logs || [])
      setTotalDeleted(response.data.total_count || 0)
    } catch (err) {
      // Don't set global error, just log it
      console.error('Failed to fetch deletion history:', err)
      setHistoryLogs([])
      setTotalDeleted(0)
    }
  }

  const openAllListingsView = () => {
    setViewMode('all')
    setShowFilter(true)
    setSelectedIds([])
  }

  const handleViewModeChange = (mode) => {
    // Card click disabled - no action
    // Not called anymore since SummaryCard no longer passes onViewModeChange
    console.log('⚠️ handleViewModeChange called but cards are now non-interactive:', mode)
  }

  const handleToggleFilter = () => {
    setShowFilter(!showFilter)
  }

  // Handle filter confirmation from modal (legacy - maintain if needed)
  const handleConfirmFiltering = async () => {
    if (!pendingFiltersForModal) return
    
    try {
      console.log('🔍 handleConfirmFiltering: Applying filters and showing results...')
      setIsFiltering(true)
      
      // Confirm filter state
      setFilters(pendingFiltersForModal)
      setResultsFilters(pendingFiltersForModal)
      setSelectedIds([])
      
      // Small delay to show the filtering state
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Show results in Dashboard
      setResultsMode('low')
      setShowResults(true)
      
      // Scroll to results section
      setTimeout(() => {
        const resultsSection = document.getElementById('results-section')
        if (resultsSection) {
          resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
      
    } catch (err) {
      console.error('Failed to apply filters:', err)
      // Save filter state even on error
      setFilters(pendingFiltersForModal)
      setResultsFilters(pendingFiltersForModal)
      setSelectedIds([])
    } finally {
      setIsFiltering(false)
      setShowFilteringModal(false)
      setPendingFiltersForModal(null)
    }
  }

  // Apply filter - Show Confirm modal
  const handleApplyFilter = async (newFilters) => {
    console.log('🔍 handleApplyFilter: Fetching quote...')
    console.log('📋 Request details:', {
      url: `${API_BASE_URL}/api/analysis/low-performing/quote`,
      method: 'POST',
      user_id: currentUserId,
      filters: {
        days: newFilters.analytics_period_days || newFilters.min_days || 7,
        sales_lte: newFilters.max_sales || 0,
        watch_lte: newFilters.max_watches || newFilters.max_watch_count || 0,
        imp_lte: newFilters.max_impressions || 100,
        views_lte: newFilters.max_views || 10,
      },
      store_id: selectedStore?.id || null
    })
    
    setIsFetchingQuote(true)
    setPendingAnalysisFilters(newFilters)
    
    try {
      // Step 1: Call Quote (preflight) - calculate requiredCredits
      const requestBody = {
        days: newFilters.analytics_period_days || newFilters.min_days || 7,
        sales_lte: newFilters.max_sales || 0,
        watch_lte: newFilters.max_watches || newFilters.max_watch_count || 0,
        imp_lte: newFilters.max_impressions || 100,
        views_lte: newFilters.max_views || 10,
      }
      
      // Use apiClient for requests requiring JWT authentication (Authorization header automatically added)
      const quoteResponse = await apiClient.post(`/api/analysis/low-performing/quote`, requestBody, {
        params: {
          store_id: selectedStore?.id || null
        },
        timeout: 30000
      })
      
      console.log('✅ Quote response received:', quoteResponse.data)
      
      if (quoteResponse.data) {
        const { estimatedCandidates, requiredCredits: quoteRequiredCredits, remainingCredits } = quoteResponse.data
        
        console.log(`📊 Quote received: estimatedCandidates=${estimatedCandidates}, requiredCredits=${quoteRequiredCredits}, remainingCredits=${remainingCredits}`)
        
        // Set requiredCredits (display in modal)
        setRequiredCredits(quoteRequiredCredits)
        
        // Credits updated via AccountContext refreshCredits() after operations
        
        // Step 2: Show Confirm modal
        setShowConfirmModal(true)
      } else {
        throw new Error('Invalid quote response')
      }
    } catch (err) {
      console.error('❌ Quote fetch failed:', {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        message: err.message,
        request: {
          url: err.config?.url,
          method: err.config?.method,
          params: err.config?.params,
          data: err.config?.data
        }
      })
      
      let errorMessage = 'Failed to calculate required credits. Please try again.'
      
      if (err.response?.status === 401 || err.response?.status === 403) {
        errorMessage = 'Authentication failed. Please log in again.'
      } else if (err.response?.status === 400) {
        const errorData = err.response?.data?.detail || err.response?.data || {}
        errorMessage = errorData.message || 'Invalid request. Please check your filter settings.'
      } else if (err.response?.status === 402) {
        const errorData = err.response?.data?.detail || {}
        errorMessage = errorData.message || 'Insufficient credits. Please purchase more credits.'
      } else if (err.response?.status === 500) {
        const errorData = err.response?.data?.detail || {}
        errorMessage = errorData.message || 'Server error. Please try again later.'
      } else if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED') {
        errorMessage = 'Network error. Please check your connection and try again.'
      }
      
      showToast(errorMessage, 'error')
      setPendingAnalysisFilters(null)
    } finally {
      setIsFetchingQuote(false)
    }
  }
  
  // Execute actual analysis when Confirm modal is clicked
  const handleConfirmAnalysis = async () => {
    if (!pendingAnalysisFilters || isAnalyzing) return
    
    // Generate Idempotency-Key (used in execute)
    const idempotencyKey = `execute_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    try {
      setIsAnalyzing(true)
      setShowConfirmModal(false)
      
      console.log(`📊 [${idempotencyKey}] Starting Low-Performing analysis execution...`, pendingAnalysisFilters)
      
      // Step 3: Call Execute - deduct credits + perform analysis
      // Use apiClient for requests requiring JWT authentication (Authorization header automatically added)
      const response = await apiClient.post(`/api/analysis/low-performing/execute`, {
        days: pendingAnalysisFilters.analytics_period_days || pendingAnalysisFilters.min_days || 7,
        sales_lte: pendingAnalysisFilters.max_sales || 0,
        watch_lte: pendingAnalysisFilters.max_watches || pendingAnalysisFilters.max_watch_count || 0,
        imp_lte: pendingAnalysisFilters.max_impressions || 100,
        views_lte: pendingAnalysisFilters.max_views || 10,
        idempotency_key: idempotencyKey
      }, {
        headers: {
          'Idempotency-Key': idempotencyKey  // Also include in header (standard practice)
        },
        timeout: 120000
      })
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Analysis failed')
      }
      
      const { count, items, remainingCredits, chargedCredits, requestId: returnedRequestId, filters: returnedFilters } = response.data
      
      console.log(`✅ [${idempotencyKey}] Analysis completed: count=${count}, chargedCredits=${chargedCredits}, remainingCredits=${remainingCredits}`)
      
      // Save analysis results
      setAnalysisResult({
        count,
        items,
        requestId: returnedRequestId || idempotencyKey,
        filters: returnedFilters || pendingAnalysisFilters
      })
      
      // Confirm filter state
      setFilters(pendingAnalysisFilters)
      setResultsFilters(pendingAnalysisFilters)
      setSelectedIds([])
      
      // Credits updated via AccountContext refreshCredits() after operations
      
      // Show results in Dashboard
      setResultsMode('low')
      setShowResults(true)
      
      // Scroll to results section
      setTimeout(() => {
        const resultsSection = document.getElementById('results-section')
        if (resultsSection) {
          resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
      
      setPendingAnalysisFilters(null)
      
    } catch (err) {
      console.error(`❌ [${idempotencyKey}] Analysis execution failed:`, err)
      
      let errorMessage = 'Analysis failed. Please try again.'
      let showRetry = true
      
      if (err.response?.status === 402) {
        // Insufficient credits
        const errorData = err.response?.data?.detail || {}
        errorMessage = errorData.message || 'Insufficient credits. Please purchase more credits.'
        showRetry = false
        // Credits will be refreshed via AccountContext after error handling
      } else if (err.response?.status === 500) {
        errorMessage = err.response?.data?.detail?.message || 'Server error. Please try again later.'
      } else if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please try again.'
      } else if (err.code === 'ERR_NETWORK') {
        errorMessage = 'Network error. Please check your connection.'
      }
      
      setErrorModalMessage(errorMessage)
      setShowErrorModal(true)
      
      // Only maintain pendingAnalysisFilters if not insufficient credits (allows retry)
      if (!showRetry) {
        setPendingAnalysisFilters(null)
      }
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSelect = (id, checked) => {
    if (checked) {
      setSelectedIds([...selectedIds, id])
    } else {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id))
    }
  }

  const handleSelectAll = (checkedOrIds) => {
    // Support both boolean (legacy) and array (new pagination mode)
    // NOTE: Dashboard has no listings, so only process queue
    if (Array.isArray(checkedOrIds)) {
      setSelectedIds(checkedOrIds)
    } else {
      const currentData = viewMode === 'queue' ? queue : []
      if (checkedOrIds) {
        setSelectedIds(currentData.map(item => item.id))
      } else {
        setSelectedIds([])
      }
    }
  }

  // NOTE: handleAddToQueue, handleMoveToZombies are implemented on /listings page
  // Dashboard only manages queue

  const handleRemoveFromQueueBulk = () => {
    // Remove selected items from queue
    // NOTE: Dashboard does not manage zombies, so only remove from queue
    if (viewMode !== 'queue') return
    
    // Remove from queue
    setQueue(queue.filter(q => !selectedIds.includes(q.id)))
    setSelectedIds([])
  }

  const handleRemoveFromQueue = (id) => {
    setQueue(queue.filter(item => item.id !== id))
  }

  // Connect eBay: start OAuth and redirect
  const handleConnectEbay = async () => {
    if (!currentUserId) {
      showToast('Please log in first.', 'error')
      return
    }
    try {
      const response = await apiClient.post('/api/ebay/auth/start', {})
      const authUrl = response.data?.url
      if (!authUrl) {
        showToast('No authorization URL received.', 'error')
        return
      }
      window.location.assign(authUrl)
    } catch (err) {
      const msg = err.response?.data?.detail?.message || err.message || 'Failed to start eBay connection.'
      showToast(msg, 'error')
    }
  }

  // Fetch all active listings for diagnosis (paginate if needed)
  const fetchListings = async () => {
    if (!currentUserId) return []
    try {
      const limit = 5000
      const response = await apiClient.get('/api/listings', { params: { skip: 0, limit } })
      const list = response.data?.listings || []
      setListings(list)
      return list
    } catch (err) {
      console.error('Failed to fetch listings:', err)
      showToast(getErrorMessage(err), 'error')
      return []
    }
  }

  // Analyze listings: filter by (today - last_updated <= days) AND (views <= max_views) AND (watches <= max_watches)
  const handleAnalyze = async () => {
    setIsAnalyzingListings(true)
    setShowDiagnosisResult(false)
    try {
      let list = listings
      if (list.length === 0) {
        list = await fetchListings()
      }
      const { periodDays, maxViews, maxWatches } = criteria
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const low = list.filter((l) => {
        const lastUpdated = l.last_updated ? new Date(l.last_updated) : null
        if (!lastUpdated) return false
        const diffMs = today - lastUpdated
        const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))
        if (diffDays > periodDays) return false
        const views = Number(l.view_count) ?? 0
        const watches = Number(l.watch_count) ?? 0
        if (views > maxViews) return false
        if (watches > maxWatches) return false
        return true
      })
      setLowPerformingItems(low)
      setLowPerformingCount(low.length)
      setShowDiagnosisResult(true)
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setIsAnalyzingListings(false)
    }
  }

  // Generate Shopify bulk CSV from low-performing items and trigger download
  const handleDownloadShopifyCSV = () => {
    if (!lowPerformingItems || lowPerformingItems.length === 0) {
      showToast('No items to export.', 'warning')
      return
    }
    setIsDownloadingShopifyCSV(true)
    try {
      const slug = (s) => (s || '')
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
      const escapeCsv = (v) => {
        const str = v == null ? '' : String(v)
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str
      }
      const header = ['Handle', 'Title', 'Vendor', 'Type', 'Variant SKU', 'Variant Price', 'Tags']
      const rows = lowPerformingItems.map((l) => {
        const title = l.title || ''
        const itemId = l.item_id || l.ebay_item_id || l.id || ''
        const handle = `${slug(title)}${itemId ? '-' + String(itemId).replace(/\s+/g, '-') : ''}`.replace(/^-|-$/g, '') || 'listing'
        const sku = l.sku || itemId || ''
        const price = l.price != null ? l.price : ''
        return [handle, title, 'eBay Import', 'Low Performance', sku, price, 'Low Performance, Delete Candidate'].map(escapeCsv)
      })
      const csvContent = [header.join(','), ...rows.map((r) => r.join(','))].join('\n')
      const dateStr = new Date().toISOString().slice(0, 10)
      const filename = `shopify_bulk_update_${dateStr}.csv`
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      showToast(`Downloaded ${filename}`, 'success')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setIsDownloadingShopifyCSV(false)
    }
  }

  // Sync: summary stats + history (Dashboard never loads product list)
  const handleSync = async () => {
    try {
      console.log('🔄 handleSync: Starting eBay listings sync...')
      setLoading(true)
      
      // ✅ Force sync: Fetch data from eBay API and save to DB
      await syncEbayListings()
      
      // Refresh summary stats and history after sync completes
      await Promise.all([
        fetchSummaryStats(),
        fetchHistory().catch(err => console.error('History fetch error:', err))
      ])
      console.log('✅ handleSync: Successfully synced and refreshed summary stats')
    } catch (err) {
      console.error('❌ Sync failed:', err)
      showToast('Sync failed. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSourceChange = async (itemId, newSupplier) => {
    try {
      // Step 1: Update in backend database
      await axios.patch(`${API_BASE_URL}/api/listing/${itemId}`, {
        supplier: newSupplier
      })

      // Step 2: Update in queue (Dashboard only manages queue)
      const updateItemInList = (list) => {
        return list.map(item => 
          item.id === itemId ? { ...item, supplier: newSupplier, supplier_name: newSupplier } : item
        )
      }

      // Only update in queue (Dashboard only maintains queue)
      const itemInQueue = queue.find(item => item.id === itemId)
      if (itemInQueue) {
        setQueue(updateItemInList(queue))
        // Note: QueueReviewPanel automatically regroups by supplier, so the item will move to the correct group
        showToast('Source updated successfully', 'success')
      }

    } catch (err) {
      console.error('Failed to update source:', err)
      showToast(getErrorMessage(err), 'error')
    }
  }

  // Check URL parameters after OAuth callback and force update connection status
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const paymentStatus = urlParams.get('payment')
    
    // Handle payment success/cancel redirects
    if (paymentStatus === 'success') {
      // Refetch credits to show updated balance
      refreshCredits()
      // Clean up URL parameter
      urlParams.delete('payment')
      const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : '')
      window.history.replaceState({}, '', newUrl)
    } else if (paymentStatus === 'cancel') {
      // User cancelled payment, just clean up URL
      urlParams.delete('payment')
      const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : '')
      window.history.replaceState({}, '', newUrl)
    }
    
    const ebayConnected = urlParams.get('ebay_connected')
    const ebayError = urlParams.get('ebay_error')
    const code = urlParams.get('code')
    const state = urlParams.get('state')
    
    // Prevent multiple executions - check if already processed
    const processedKey = 'ebay_oauth_processed'
    const processed = sessionStorage.getItem(processedKey)
    
    // Log current state for debugging
    console.log('🔍 OAuth callback handler:', {
      hasCode: !!code,
      ebayConnected,
      ebayError,
      processed,
      currentUrl: window.location.href
    })
    
    // If we have ebay_connected=true or ebay_error, we should process it
    // Only skip if we're in the middle of redirecting (to prevent loops)
    if (processed === 'redirecting' && !ebayConnected && !ebayError && code) {
      // We're already redirecting, skip to prevent infinite loops
      console.log('⚠️ Already redirecting to backend, skipping duplicate redirect')
      return
    }
    
    // If we have success or error flags, we should process them even if marked as processed
    // But if we have a code and no success/error yet, we need to redirect to backend
    
    // Important: If eBay redirected directly to frontend (code parameter exists)
    // Redirect to backend callback endpoint
    if (code && !ebayConnected && !ebayError) {
      // Check if we're already processing this redirect (only check for 'redirecting', not 'connected')
      const redirecting = sessionStorage.getItem(processedKey)
      if (redirecting === 'redirecting') {
        console.log('⚠️ Already redirecting to backend, skipping duplicate redirect')
        return
      }
      
      console.log('🔄 eBay OAuth code detected - redirecting to backend')
      console.log('   Code:', code.substring(0, 20) + '...')
      console.log('   State:', state)
      
      // Mark as processing to prevent multiple redirects
      sessionStorage.setItem(processedKey, 'redirecting')
      
      // Redirect to backend callback endpoint (pass all parameters)
      const callbackUrl = `${API_BASE_URL}/api/ebay/auth/callback?${urlParams.toString()}`
      console.log('   Redirecting to backend callback:', callbackUrl)
      
      // Use replace instead of href to prevent back button issues
      window.location.replace(callbackUrl)
      return // Stop execution after redirect
    }
    
    // If we have ebay_connected=true, process it (even if previously marked as processed)
    // This ensures successful connections are handled even after page reload
    
    if (ebayConnected === 'true') {
      // Prevent multiple simultaneous verifications
      if (isVerifyingConnection.current) {
        console.log('⚠️ Verification already in progress, skipping duplicate verification')
        return
      }
      
      console.log('✅ OAuth callback success detected - verifying connection with backend')
      console.log('📋 OAuth callback details:', {
        user_id: currentUserId,
        ebayConnected,
        url: window.location.href
      })
      
      // Clean URL FIRST to prevent re-triggering on re-render
      // This must happen before any async operations to prevent useEffect re-execution
      window.history.replaceState({}, '', window.location.pathname)
      
      // Mark as processing immediately to prevent re-entry
      sessionStorage.setItem(processedKey, 'processing')
      isVerifyingConnection.current = true
      verificationAttemptCount.current = 0
      
      // CRITICAL: Do NOT set connected state yet - wait for backend verification
      setIsStoreConnected(false)
      
      // Verify connection status from backend with polling support
      const verifyConnectionWithPolling = async (attempt = 0) => {
        if (attempt >= MAX_VERIFICATION_ATTEMPTS) {
          console.warn('⚠️ Max verification attempts reached, giving up')
          isVerifyingConnection.current = false
          sessionStorage.removeItem(processedKey)
          showToast('Connection verification timeout. Please refresh the page.', 'error')
          return
        }
        
        verificationAttemptCount.current = attempt + 1
        console.log(`🔍 Verifying connection status from backend... (attempt ${verificationAttemptCount.current}/${MAX_VERIFICATION_ATTEMPTS})`)
        
        try {
          // Use apiClient for requests requiring JWT authentication (Authorization header automatically added)
          const response = await apiClient.get(`/api/ebay/auth/status`, {
            timeout: 30000
          })
          
          const isConnected = response.data?.connected === true && 
                             response.data?.token_status?.has_valid_token !== false &&
                             !response.data?.is_expired
          
          console.log('📊 Backend connection status:', {
            connected: response.data?.connected,
            hasValidToken: response.data?.token_status?.has_valid_token,
            isExpired: response.data?.is_expired,
            finalDecision: isConnected,
            attempt: verificationAttemptCount.current
          })
          
          if (isConnected) {
            console.log('✅ Connection verified - setting state and syncing listings')
            // Mark as processed AFTER successful verification
            sessionStorage.setItem(processedKey, 'connected')
            isVerifyingConnection.current = false
            verificationAttemptCount.current = 0
            setIsStoreConnected(true)
            
            // Performance mark: OAuth callback completion point
            if (typeof performance !== 'undefined' && performance.mark) {
              performance.mark('oauth_callback_complete')
            }
            
            // CRITICAL: Automatically execute listings sync immediately after OAuth callback success (only if not already syncing)
            if (!syncInProgressRef.current) {
              console.log('🔄 Starting eBay listings sync after OAuth connection...')
              syncEbayListings().catch(err => {
                console.error('Failed to sync eBay listings after OAuth:', err)
                fetchSummaryStats().catch(fetchErr => {
                  console.error('Failed to fetch summary stats after sync error:', fetchErr)
                })
              })
            } else {
              console.log('🔄 Sync already in progress, skipping post-OAuth sync trigger')
            }
            
            // Clear the processed flag after delay to allow for future connections
            setTimeout(() => {
              sessionStorage.removeItem(processedKey)
            }, 10000)
          } else {
            // Backend reports not connected - do NOT set connected state
            console.warn('⚠️ Backend reports not connected:', {
              connected: response.data?.connected,
              hasValidToken: response.data?.token_status?.has_valid_token,
              isExpired: response.data?.is_expired,
              user_id: currentUserId
            })
            
            // Connection not ready yet, poll with backoff
            if (attempt < MAX_VERIFICATION_ATTEMPTS - 1) {
              const backoffMs = VERIFICATION_BACKOFF_MS[attempt] || 3000
              console.log(`⏳ Connection not ready yet, retrying in ${backoffMs}ms...`)
              setTimeout(() => {
                verifyConnectionWithPolling(attempt + 1)
              }, backoffMs)
            } else {
              // Max attempts reached - backend confirmed not connected
              console.warn('⚠️ Backend confirmed not connected after all attempts')
              isVerifyingConnection.current = false
              sessionStorage.removeItem(processedKey)
              setIsStoreConnected(false)  // CRITICAL: Set to false based on backend status
              showToast('Connection verification failed. Please reconnect your eBay account.', 'error')
            }
          }
        } catch (err) {
          console.error(`❌ Failed to verify connection status (attempt ${verificationAttemptCount.current}):`, err)
          
          // Retry on network errors with backoff
          if (attempt < MAX_VERIFICATION_ATTEMPTS - 1 && 
              (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED' || err.response?.status >= 500)) {
            const backoffMs = VERIFICATION_BACKOFF_MS[attempt] || 3000
            console.log(`⏳ Network error, retrying in ${backoffMs}ms...`)
            setTimeout(() => {
              verifyConnectionWithPolling(attempt + 1)
            }, backoffMs)
          } else {
            // Max attempts or non-retryable error
            // CRITICAL: Do NOT set connected state if backend verification failed
            console.warn('⚠️ Verification failed after all attempts - backend status takes precedence')
            isVerifyingConnection.current = false
            sessionStorage.removeItem(processedKey)
            setIsStoreConnected(false)  // CRITICAL: Set to false - backend verification failed
            showToast('Connection verification failed. Please reconnect your eBay account.', 'error')
          }
        }
      }
      
      // Start verification with polling
      verifyConnectionWithPolling(0)
    } else if (ebayError) {
      console.error('❌ OAuth callback error:', ebayError)
      const errorMessage = urlParams.get('message') || 'Failed to connect to eBay'
      
      // Remove URL parameters FIRST to prevent re-triggering
      window.history.replaceState({}, '', window.location.pathname)
      
      // Clear all flags
      sessionStorage.removeItem(processedKey)
      isVerifyingConnection.current = false
      verificationAttemptCount.current = 0
      setIsStoreConnected(false)
      
      // Show error toast
      showToast(`eBay connection failed: ${errorMessage}`, 'error')
    } else if (!code && !ebayConnected && !ebayError && processed === 'connected') {
      // If we're marked as connected but URL doesn't show it, clear the flag
      // This can happen if connection failed but flag wasn't cleared
      console.log('⚠️ Session marked as connected but URL shows disconnected, clearing flag')
      sessionStorage.removeItem(processedKey)
      isVerifyingConnection.current = false
      verificationAttemptCount.current = 0
    }
  }, []) // Keep empty dependency array - only run on mount
  
  // Initial Load - Check API health, eBay connection status, and fetch data (execute only once)
  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        const isHealthy = await checkApiHealth()
        if (isHealthy) {
          refreshCredits()
          fetchHistory().catch(err => {
            console.error('History fetch error on mount:', err)
          })
          
          // Check eBay connection status on mount (only if not already verifying from OAuth callback)
          // Skip this check if OAuth verification is in progress to avoid duplicate calls
          if (!isVerifyingConnection.current) {
            try {
              // CRITICAL: No status check if user is not logged in
              if (!currentUserId) {
                console.warn('⚠️ [STATUS] Cannot check on mount: user is not logged in')
                return
              }
              
              console.log('🔍 Checking eBay connection status on mount...')
              // Use apiClient for requests requiring JWT authentication (Authorization header automatically added)
              const response = await apiClient.get(`/api/ebay/auth/status`, {
                timeout: 30000
              })
              
              // CRITICAL: Only trust backend status
              const backendConnected = response.data?.connected === true
              const hasValidToken = response.data?.token_status?.has_valid_token === true
              const isExpired = response.data?.is_expired === true
              const isConnected = backendConnected && hasValidToken && !isExpired
              
              console.log('📊 Mount connection check:', {
                backendConnected,
                hasValidToken,
                isExpired,
                finalDecision: isConnected,
                user_id: currentUserId
              })
              
              if (isConnected) {
                console.log('✅ eBay is already connected - fetching summary stats...')
                setIsStoreConnected(true)
                // If connected, only fetch summary stats (do not fetch full listings)
                fetchSummaryStats().catch(err => {
                  console.error('Failed to fetch summary stats:', err)
                })
              } else {
                console.log('ℹ️ eBay is not connected yet (backend confirmed)')
                setIsStoreConnected(false)  // CRITICAL: Set to false based on backend status
              }
            } catch (ebayStatusErr) {
              console.warn('Failed to check eBay connection status on mount:', ebayStatusErr)
              // Don't set connection state on error - let user manually connect
            }
          } else {
            console.log('⏸️ Skipping mount connection check - OAuth verification in progress')
          }
        }
      } catch (err) {
        console.warn('API Health Check failed (non-critical):', err)
        refreshCredits()
        fetchHistory().catch(err => {
          console.error('History fetch error on mount:', err)
        })
      }
    }
    
    initializeDashboard()
  }, [])
  
  // Handle URL query param for view mode
  useEffect(() => {
    if (viewParam === 'history') {
      setViewMode('history')
      fetchHistory()
    }
  }, [viewParam])

  const handleExport = async (mode, itemsToExport = null) => {
    // Use provided items or default to full queue
    const items = itemsToExport || queue
    
    if (items.length === 0) {
      showToast('No items to export. Please add items to the queue first.', 'warning')
      return
    }

    // Prevent concurrent requests
    if (loading) {
      console.warn('Export already in progress')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Step 1: Log deletion to history BEFORE exporting
      try {
        // Use apiClient for requests requiring JWT authentication (Authorization header automatically added)
        await apiClient.post(`/api/log-deletion`, {
          items: items
        }, {
          timeout: 30000 // Increased from 10s to 30s
        })
        // Refresh total deleted count
        // Use apiClient for requests requiring JWT authentication (Authorization header automatically added)
        const historyResponse = await apiClient.get(`/api/history`, {
          params: { skip: 0, limit: 1 },
          timeout: 30000 // Increased from 10s to 30s
        })
        setTotalDeleted(historyResponse.data.total_count || 0)
      } catch (logErr) {
        console.error('Failed to log deletion:', logErr)
        // Continue with export even if logging fails
      }

      // Step 2: Export CSV
      const response = await axios.post(
        `${API_BASE_URL}/api/export-queue`,
        {
          items: items,
          export_mode: mode,
          target_tool: mode // Use mode as target_tool for backward compatibility
        },
        {
          responseType: 'blob',
          timeout: 30000 // Added 30s timeout
        }
      )

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      
      // Determine filename based on supplier and mode
      // Use source field if available, otherwise use supplier_name or supplier (safely handled)
      const getSource = (item) => {
        if (!item) return "unknown"
        return item.source || item.supplier_name || item.supplier || "unknown"
      }
      // Safely define and validate source variable
      let source = 'all'
      if (items && items.length > 0) {
        const sourceValue = getSource(items[0])
        if (sourceValue && typeof sourceValue === 'string') {
          source = sourceValue.toLowerCase().replace(/\s+/g, '_')
        }
      }
      
      // Verify source is valid before using
      if (!source || source === '') {
        source = 'all'
      }
      
      const filenameMap = {
        autods: `${source}_delete.csv`,
        yaballe: `${source}_delete_yaballe.csv`,
        ebay: `${source}_delete_ebay.csv`
      }
      
      link.setAttribute('download', filenameMap[mode] || `${source}_delete.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url) // Prevent memory leak

      // Step 3: Remove exported items from queue if they were in queue
      if (itemsToExport === null) {
        const exportedIds = items.map(item => item.id)
        setQueue(queue.filter(item => !exportedIds.includes(item.id)))
      }
    } catch (err) {
      let errorMessage = 'An error occurred while extracting CSV.'
      
      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please try again.'
      } else if (err.response) {
        errorMessage = `Server error: ${err.response.status} - ${err.response.statusText || err.response.data?.detail || 'Unknown error'}`
      } else if (err.request) {
        errorMessage = 'Unable to connect to server. Please check your network connection.'
      } else {
        errorMessage = `CSV extraction failed: ${err.message || 'Unknown error'}`
      }
      
      setError(errorMessage)
      showToast(getErrorMessage(err), 'error')
      console.error('Export error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Handle Export CSV from Low-Performing card
  const handleExportCSV = () => {
    // Show platform selection modal
    setShowPlatformModal(true)
  }

  // Handle platform selection and export
  const handlePlatformSelect = async (platform) => {
    if (!analysisResult || !analysisResult.items || analysisResult.items.length === 0) {
      showToast('No items to export.', 'warning')
      setShowPlatformModal(false)
      return
    }

    setIsExportingCSV(true)
    setShowPlatformModal(false)

    try {
      // Get items from analysis result
      const itemsToExport = analysisResult.items

      // Map platform to target_tool
      // platform: 'shopify' -> target_tool: 'shopify_matrixify'
      // platform: 'bigcommerce' -> target_tool: 'bigcommerce' (or appropriate format)
      const targetToolMap = {
        'shopify': 'shopify_matrixify',
        'bigcommerce': 'bigcommerce'
      }
      
      const targetTool = targetToolMap[platform] || platform

      console.log(`📤 [EXPORT] Exporting ${itemsToExport.length} items to ${platform} (${targetTool})...`)

      // Call export API
      // Use apiClient for requests requiring JWT authentication (Authorization header automatically added)
      const response = await apiClient.post(
        `/api/export-queue`,
        {
          items: itemsToExport,
          target_tool: targetTool,
          platform: platform,  // Also pass platform parameter
          mode: 'delete_list'
        },
        {
          responseType: 'blob',
          timeout: 30000
        }
      )

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      
      // Determine filename based on platform
      const filenameMap = {
        'shopify': 'low_performing_shopify.csv',
        'bigcommerce': 'low_performing_bigcommerce.csv'
      }
      
      link.setAttribute('download', filenameMap[platform] || `low_performing_${platform}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      showToast(`CSV exported in ${platform.toUpperCase()} format.`, 'success')
    } catch (err) {
      console.error('Export CSV error:', err)
      let errorMessage = 'An error occurred while exporting CSV.'
      
      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please try again.'
      } else if (err.response) {
        errorMessage = `Server error: ${err.response.status} - ${err.response.statusText || err.response.data?.detail || 'Unknown error'}`
      } else if (err.request) {
        errorMessage = 'Cannot connect to server. Please check your network connection.'
      } else {
        errorMessage = `CSV export failed: ${err.message || 'Unknown error'}`
      }
      
      showToast(errorMessage, 'error')
    } finally {
      setIsExportingCSV(false)
    }
  }

  // Handle supplier-specific export from Product Journey section
  const handleSupplierExport = async (items, targetTool, supplierName) => {
    if (!items || items.length === 0) {
      showToast(`No items to export for ${supplierName}`, 'warning')
      return
    }

    // Prevent concurrent requests
    if (loading) {
      console.warn('Export already in progress')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Step 1: Log deletion to history BEFORE exporting
      try {
        // Use apiClient for requests requiring JWT authentication (Authorization header automatically added)
        await apiClient.post(`/api/log-deletion`, {
          items: items
        }, {
          timeout: 30000 // Increased from 10s to 30s
        })
        // Refresh total deleted count
        // Use apiClient for requests requiring JWT authentication (Authorization header automatically added)
        const historyResponse = await apiClient.get(`/api/history`, {
          params: { skip: 0, limit: 1 },
          timeout: 30000 // Increased from 10s to 30s
        })
        setTotalDeleted(historyResponse.data.total_count || 0)
      } catch (logErr) {
        console.error('Failed to log deletion:', logErr)
        // Continue with export even if logging fails
      }

      // Step 2: Export CSV with supplier-specific target tool
      const response = await axios.post(
        `${API_BASE_URL}/api/export-queue`,
        {
          items: items,
          target_tool: targetTool,
          export_mode: targetTool // For backward compatibility
        },
        {
          responseType: 'blob',
          timeout: 30000 // Added 30s timeout
        }
      )

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      
      // Filename based on supplier and tool
      const supplierSlug = supplierName.toLowerCase().replace(/\s+/g, '_')
      link.setAttribute('download', `${supplierSlug}_${targetTool}_delete.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url) // Prevent memory leak
    } catch (err) {
      let errorMessage = `An error occurred while extracting CSV.`
      
      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please try again.'
      } else if (err.response) {
        errorMessage = `Server error: ${err.response.status} - ${err.response.statusText || err.response.data?.detail || 'Unknown error'}`
      } else if (err.request) {
        errorMessage = 'Unable to connect to server. Please check your network connection.'
      } else {
        errorMessage = `CSV extraction failed: ${err.message || 'Unknown error'}`
      }
      
      setError(errorMessage)
      showToast(`Failed to export CSV for ${supplierName}: ${getErrorMessage(err)}`, 'error')
      console.error('Export error:', err)
    } finally {
      setLoading(false)
    }
  }


  const showConnectEbay = !isStoreConnected || totalListings === 0

  return (
    <div className="font-sans bg-black dark:bg-black min-h-full">
      <div className="px-6 pt-4 flex flex-col items-center justify-center min-h-[60vh]">
        {isSyncingListings && (
          <div className="mb-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <span className="text-blue-400 font-medium">Syncing eBay listings...</span>
            </div>
          </div>
        )}

        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-12 flex flex-col items-center justify-center text-center">
          {summaryLoading && !summaryStats.activeCount && !isStoreConnected ? (
            <p className="text-zinc-500 text-lg">Loading...</p>
          ) : showConnectEbay ? (
            <>
              <p className="text-zinc-600 text-lg mb-8">Connect your eBay account to see active listings.</p>
              <button
                type="button"
                onClick={handleConnectEbay}
                className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-emerald-500/30 transition-all"
              >
                Connect eBay
              </button>
            </>
          ) : (
            <>
              <p className="text-zinc-600 text-sm font-medium uppercase tracking-wider mb-2">Total Active Listings</p>
              <p className="text-zinc-900 font-bold" style={{ fontSize: '6rem', lineHeight: 1 }}>
                {totalListings}
              </p>
            </>
          )}
        </div>

        {/* Diagnosis Zone - only when connected and has listings */}
        {!showConnectEbay && (
          <div className="w-full max-w-2xl mt-8 bg-white rounded-2xl shadow-xl p-8">
            <h3 className="text-lg font-semibold text-zinc-900 mb-4">Diagnosis</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Period (Days)</label>
                <input
                  type="number"
                  min={1}
                  value={criteria.periodDays}
                  onChange={(e) => setCriteria((c) => ({ ...c, periodDays: Number(e.target.value) || 7 }))}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Max Views</label>
                <input
                  type="number"
                  min={0}
                  value={criteria.maxViews}
                  onChange={(e) => setCriteria((c) => ({ ...c, maxViews: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Max Watches</label>
                <input
                  type="number"
                  min={0}
                  value={criteria.maxWatches}
                  onChange={(e) => setCriteria((c) => ({ ...c, maxWatches: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-zinc-900"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzingListings}
              className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {isAnalyzingListings && <Loader2 className="w-5 h-5 animate-spin" aria-hidden />}
              {isAnalyzingListings ? 'Analyzing...' : 'Analyze Listings'}
            </button>

            {/* Results - shown after Analyze, smooth appearance */}
            {showDiagnosisResult && (
              <div className="mt-6 pt-6 border-t border-zinc-200 transition-opacity duration-300 ease-out opacity-100">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-red-600 font-bold text-lg">Low Performing Items: {lowPerformingCount}</p>
                  {lowPerformingCount > 0 && (
                    <button
                      type="button"
                      onClick={handleDownloadShopifyCSV}
                      disabled={isDownloadingShopifyCSV}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2"
                    >
                      {isDownloadingShopifyCSV && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
                      {isDownloadingShopifyCSV ? 'Preparing...' : 'Download Shopify CSV'}
                    </button>
                  )}
                </div>
                <p className="text-sm text-zinc-500 mt-1">Ready to export for Shopify.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}

export default Dashboard

