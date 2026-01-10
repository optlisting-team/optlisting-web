import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import axios from 'axios'
import { useStore } from '../contexts/StoreContext'
import SummaryCard from './SummaryCard'
import ZombieTable from './ZombieTable'
import FilterBar from './FilterBar'
import DeleteQueue from './DeleteQueue'
import HistoryTable from './HistoryTable'
import HistoryView from './HistoryView'
import QueueReviewPanel from './QueueReviewPanel'
import FilteringModal from './FilteringModal'
import ConfirmModal from './ConfirmModal'
import LowPerformingResults from './LowPerformingResults'
import Toast from './Toast'
import { Button } from './ui/button'
import { AlertCircle, X } from 'lucide-react'
import { getImageUrlFromListing, normalizeImageUrl } from '../utils/imageUtils'

// Use environment variable for Railway URL, fallback based on environment
// CRITICAL: Production MUST use relative path /api (proxied by vercel.json) to avoid CORS issues
// Only use VITE_API_URL in development if needed, production always uses relative path
const API_BASE_URL = import.meta.env.DEV 
  ? (import.meta.env.VITE_API_URL || '')  // Development: use env var or empty for Vite proxy
  : ''  // Production: ALWAYS use relative path (vercel.json proxy handles routing to Railway)
const CURRENT_USER_ID = "default-user" // Temporary user ID for MVP phase

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
  const [searchParams] = useSearchParams()
  const viewParam = searchParams.get('view')
  // Client state only
  // NOTE: Dashboard에서는 제품 리스트 상태를 유지하지 않음 (카드 숫자만 관리)
  const [isStoreConnected, setIsStoreConnected] = useState(false)
  // allListings, zombies는 Dashboard에서 제거 (결과 화면에서만 관리)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [queue, setQueue] = useState([]) // Queue는 로컬 상태로 유지
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
  
  // Summary statistics state (Dashboard 초기 로딩용)
  const [summaryStats, setSummaryStats] = useState({
    activeCount: 0,
    lowPerformingCount: 0,
    queueCount: 0,
    lastSyncAt: null
  })
  const [summaryLoading, setSummaryLoading] = useState(false)
  
  // 결과 표시 여부 (Find 버튼 클릭 시에만 표시)
  const [showResults, setShowResults] = useState(false)
  const [resultsMode, setResultsMode] = useState('low') // 'all' or 'low'
  const [resultsFilters, setResultsFilters] = useState(null)
  
  // 분석 결과 상태
  const [analysisResult, setAnalysisResult] = useState(null) // { count, items, requestId, filters }
  
  // Confirm Modal 상태 (크레딧 소비 확인)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [pendingAnalysisFilters, setPendingAnalysisFilters] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [requiredCredits, setRequiredCredits] = useState(1)  // quote에서 받아온 값
  const [isFetchingQuote, setIsFetchingQuote] = useState(false)  // quote 호출 중 플래그
  const [isToppingUp, setIsToppingUp] = useState(false)  // Dev top-up 진행 중 플래그
  
  // API Health Check State
  const [apiConnected, setApiConnected] = useState(false)
  const [apiError, setApiError] = useState(null)
  
  // Error Modal State
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorModalMessage, setErrorModalMessage] = useState('')
  
  // Toast Notification State
  const [toast, setToast] = useState(null) // { message, type: 'error' | 'success' | 'warning' }
  
  // 에러 유형별 메시지 생성 함수
  const getErrorMessage = (err) => {
    if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
      return 'Network error. Please try again.'
    }
    if (err.response?.status === 401 || err.response?.status === 403) {
      return 'Please reconnect your eBay account.'
    }
    if (err.response?.status === 402) {
      // 크레딧 부족
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
  
  // Toast 표시 함수
  const showToast = (message, type = 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000) // 5초 후 자동 제거
  }
  
  // Filtering Modal State (레거시 - 필요시 유지)
  const [showFilteringModal, setShowFilteringModal] = useState(false)
  const [isFiltering, setIsFiltering] = useState(false)
  const [pendingFiltersForModal, setPendingFiltersForModal] = useState(null)
  
  // User Credits & Plan State (from API)
  const [userCredits, setUserCredits] = useState(0)
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

  // Derived values only (summaryStats 사용)
  // Dashboard에서는 allListings/zombies를 사용하지 않으므로 summaryStats만 사용
  const totalListings = useMemo(() => summaryStats.activeCount || 0, [summaryStats.activeCount])
  // LOW-PERFORMING 카드 숫자: analysisResult?.count ?? summaryStats.lowPerformingCount
  const totalZombies = useMemo(() => {
    return analysisResult?.count ?? summaryStats.lowPerformingCount ?? 0
  }, [analysisResult?.count, summaryStats.lowPerformingCount])
  
  // Breakdown은 summary API에서 제공하지 않으므로 빈 객체
  const totalBreakdown = useMemo(() => ({}), [])
  const platformBreakdown = useMemo(() => ({ eBay: totalListings }), [totalListings])
  const zombieBreakdown = useMemo(() => ({}), [])
  
  // API Health Check - Check connection on mount
  const checkApiHealth = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/health`, { 
        timeout: 30000,
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
        setApiError('백엔드 서버 오류 (502) - Railway 서버를 확인하세요')
      } else if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED') {
        setApiError('네트워크 오류 - 서버에 연결할 수 없습니다')
      } else if (err.response?.status === 0 || err.message?.includes('CORS')) {
        setApiError('CORS 오류 - 백엔드 서버를 재배포하세요')
      } else {
        setApiError(`연결 오류: ${err.message || '알 수 없는 오류'}`)
      }
      return false
    }
    return false
  }
  
  // Fetch user credits and plan info
  const fetchUserCredits = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/credits`, {
        params: { user_id: CURRENT_USER_ID },
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (response.data) {
        setUserCredits(response.data.available_credits || 0)
        setUsedCredits(response.data.used_credits || 0)
        setUserPlan(response.data.plan || 'FREE')
      }
    } catch (err) {
      console.error('Failed to fetch credits:', err)
      // Use default values on error
    }
  }

  // Fetch summary statistics (경량화된 통계만 가져오기)
  const fetchSummaryStats = async () => {
    try {
      setSummaryLoading(true)
      console.log('📊 fetchSummaryStats: Fetching summary statistics...')
      
      if (DEMO_MODE) {
        // Demo 모드에서는 더미 데이터 사용
        setSummaryStats({
          activeCount: DUMMY_ALL_LISTINGS.length,
          lowPerformingCount: DUMMY_ZOMBIES.length,
          queueCount: queue.length,
          lastSyncAt: new Date().toISOString()
        })
        setSummaryLoading(false)
        return
      }
      
      const response = await axios.get(`${API_BASE_URL}/api/ebay/summary`, {
        params: {
          user_id: CURRENT_USER_ID,
          filters: JSON.stringify(filters) // 필터 파라미터 전달
        },
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.data && response.data.success) {
        console.log('✅ fetchSummaryStats: Successfully fetched summary:', response.data)
        setSummaryStats({
          activeCount: response.data.active_count || 0,
          lowPerformingCount: response.data.low_performing_count || 0,
          queueCount: response.data.queue_count || 0,
          lastSyncAt: response.data.last_sync_at || null
        })
      } else {
        console.warn('⚠️ fetchSummaryStats: Unexpected response format:', response.data)
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
        // 에러 발생 시에도 기본값 설정
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

  // NOTE: applyLocalFilter는 Dashboard에서 제거됨
  // 필터링은 /listings 페이지의 LowPerformingResults 컴포넌트에서 서버 측에서 수행

  // Handle store connection change
  // 중복 호출 방지를 위한 플래그
  const handleStoreConnectionInProgress = useRef(false)
  
  const handleStoreConnection = (connected, forceLoad = false) => {
    // Prevent duplicate calls - check if state is already set
    if (connected === isStoreConnected && !forceLoad) {
      console.log('⚠️ handleStoreConnection: State already matches, skipping')
      return
    }
    
    // 중복 실행 방지
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
        // forceLoad가 true여도 summary stats만 가져오기
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
        // forceLoad가 false면 summary stats만 가져오기
        fetchSummaryStats().then(() => {
          handleStoreConnectionInProgress.current = false
        }).catch(err => {
          console.error('Failed to fetch summary stats:', err)
          handleStoreConnectionInProgress.current = false
        })
      }
    }
  }

  // NOTE: Dashboard에서는 절대 제품 리스트를 로드하지 않음
  // fetchAllListings 함수는 /listings 페이지의 LowPerformingResults 컴포넌트에서 사용

  const fetchHistory = async () => {
    try {
      // Don't set loading to true here to avoid blocking other operations
      const response = await axios.get(`${API_BASE_URL}/api/history`, {
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
    // 카드 클릭 비활성화 - 아무 동작도 하지 않음
    // 이제 SummaryCard에서 onViewModeChange를 전달하지 않으므로 호출되지 않음
    console.log('⚠️ handleViewModeChange called but cards are now non-interactive:', mode)
  }

  const handleToggleFilter = () => {
    setShowFilter(!showFilter)
  }

  const handleAnalyze = () => {
    // 'Find Low-Performing SKUs' 버튼 클릭 시 Dashboard 내부에 결과 표시
    console.log('🔍 handleAnalyze: Showing results panel in Dashboard')
    setResultsMode('low')
    setResultsFilters(filters)
    setShowResults(true)
    // 결과 섹션으로 스크롤
    setTimeout(() => {
      const resultsSection = document.getElementById('results-section')
      if (resultsSection) {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }

  // Handle filter confirmation from modal (레거시 - 필요시 유지)
  const handleConfirmFiltering = async () => {
    if (!pendingFiltersForModal) return
    
    try {
      console.log('🔍 handleConfirmFiltering: Applying filters and showing results...')
      setIsFiltering(true)
      
      // 필터 상태 확정
      setFilters(pendingFiltersForModal)
      setResultsFilters(pendingFiltersForModal)
      setSelectedIds([])
      
      // Small delay to show the filtering state
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Dashboard 내부에 결과 표시
      setResultsMode('low')
      setShowResults(true)
      
      // 결과 섹션으로 스크롤
      setTimeout(() => {
        const resultsSection = document.getElementById('results-section')
        if (resultsSection) {
          resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
      
    } catch (err) {
      console.error('Failed to apply filters:', err)
      // 에러 발생 시에도 필터 상태는 저장
      setFilters(pendingFiltersForModal)
      setResultsFilters(pendingFiltersForModal)
      setSelectedIds([])
    } finally {
      setIsFiltering(false)
      setShowFilteringModal(false)
      setPendingFiltersForModal(null)
    }
  }

  // Apply filter - Confirm 모달 표시
  const handleApplyFilter = async (newFilters) => {
    console.log('🔍 handleApplyFilter: Fetching quote...')
    
    setIsFetchingQuote(true)
    setPendingAnalysisFilters(newFilters)
    
    try {
      // Step 1: Quote (preflight) 호출 - requiredCredits 계산
      const quoteResponse = await axios.post(`${API_BASE_URL}/api/analysis/low-performing/quote`, {
        days: newFilters.analytics_period_days || newFilters.min_days || 7,
        sales_lte: newFilters.max_sales || 0,
        watch_lte: newFilters.max_watches || newFilters.max_watch_count || 0,
        imp_lte: newFilters.max_impressions || 100,
        views_lte: newFilters.max_views || 10,
      }, {
        params: {
          user_id: CURRENT_USER_ID
        },
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      })
      
      if (quoteResponse.data) {
        const { estimatedCandidates, requiredCredits: quoteRequiredCredits, remainingCredits } = quoteResponse.data
        
        console.log(`📊 Quote received: estimatedCandidates=${estimatedCandidates}, requiredCredits=${quoteRequiredCredits}, remainingCredits=${remainingCredits}`)
        
        // requiredCredits 설정 (모달에 표시)
        setRequiredCredits(quoteRequiredCredits)
        
        // 크레딧 업데이트 (quote에서 받은 최신 값)
        setUserCredits(remainingCredits)
        
        // Step 2: Confirm modal 표시
        setShowConfirmModal(true)
      } else {
        throw new Error('Invalid quote response')
      }
    } catch (err) {
      console.error('❌ Quote fetch failed:', err)
      let errorMessage = 'Failed to calculate required credits. Please try again.'
      
      if (err.response?.status === 402) {
        const errorData = err.response?.data?.detail || {}
        errorMessage = errorData.message || 'Insufficient credits. Please purchase more credits.'
      }
      
      showToast(errorMessage, 'error')
      setPendingAnalysisFilters(null)
    } finally {
      setIsFetchingQuote(false)
    }
  }
  
  // Confirm 모달에서 확인 클릭 시 실제 분석 실행
  const handleConfirmAnalysis = async () => {
    if (!pendingAnalysisFilters || isAnalyzing) return
    
    // Idempotency-Key 생성 (execute에서 사용)
    const idempotencyKey = `execute_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    try {
      setIsAnalyzing(true)
      setShowConfirmModal(false)
      
      console.log(`📊 [${idempotencyKey}] Starting Low-Performing analysis execution...`, pendingAnalysisFilters)
      
      // Step 3: Execute 호출 - 크레딧 차감 + 분석 수행
      const response = await axios.post(`${API_BASE_URL}/api/analysis/low-performing/execute`, {
        days: pendingAnalysisFilters.analytics_period_days || pendingAnalysisFilters.min_days || 7,
        sales_lte: pendingAnalysisFilters.max_sales || 0,
        watch_lte: pendingAnalysisFilters.max_watches || pendingAnalysisFilters.max_watch_count || 0,
        imp_lte: pendingAnalysisFilters.max_impressions || 100,
        views_lte: pendingAnalysisFilters.max_views || 10,
        idempotency_key: idempotencyKey
      }, {
        params: {
          user_id: CURRENT_USER_ID
        },
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey  // 헤더에도 포함 (표준 관행)
        },
        timeout: 120000
      })
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Analysis failed')
      }
      
      const { count, items, remainingCredits, chargedCredits, requestId: returnedRequestId, filters: returnedFilters } = response.data
      
      console.log(`✅ [${idempotencyKey}] Analysis completed: count=${count}, chargedCredits=${chargedCredits}, remainingCredits=${remainingCredits}`)
      
      // 분석 결과 저장
      setAnalysisResult({
        count,
        items,
        requestId: returnedRequestId || idempotencyKey,
        filters: returnedFilters || pendingAnalysisFilters
      })
      
      // 필터 상태 확정
      setFilters(pendingAnalysisFilters)
      setResultsFilters(pendingAnalysisFilters)
      setSelectedIds([])
      
      // 크레딧 업데이트 (execute에서 받은 최신 값)
      setUserCredits(remainingCredits)
      
      // Dashboard 내부에 결과 표시
      setResultsMode('low')
      setShowResults(true)
      
      // 결과 섹션으로 스크롤
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
        // 크레딧 부족
        const errorData = err.response?.data?.detail || {}
        errorMessage = errorData.message || 'Insufficient credits. Please purchase more credits.'
        showRetry = false
        setUserCredits(errorData.available_credits || 0)
      } else if (err.response?.status === 500) {
        errorMessage = err.response?.data?.detail?.message || 'Server error. Please try again later.'
      } else if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please try again.'
      } else if (err.code === 'ERR_NETWORK') {
        errorMessage = 'Network error. Please check your connection.'
      }
      
      setErrorModalMessage(errorMessage)
      setShowErrorModal(true)
      
      // 크레딧 부족이 아닌 경우에만 pendingAnalysisFilters 유지 (retry 가능)
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
    // NOTE: Dashboard에서는 listings가 없으므로 queue만 처리
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

  // NOTE: handleAddToQueue, handleMoveToZombies는 /listings 페이지에서 구현
  // Dashboard에서는 queue만 관리

  const handleRemoveFromQueueBulk = () => {
    // Remove selected items from queue
    // NOTE: Dashboard에서는 zombies를 관리하지 않으므로 queue에서만 제거
    if (viewMode !== 'queue') return
    
    // Remove from queue
    setQueue(queue.filter(q => !selectedIds.includes(q.id)))
    setSelectedIds([])
  }

  const handleRemoveFromQueue = (id) => {
    setQueue(queue.filter(item => item.id !== id))
  }

  // Sync: summary stats + history (Dashboard에서는 제품 리스트를 절대 로드하지 않음)
  const handleSync = async () => {
    try {
      console.log('🔄 handleSync: Refreshing summary stats from eBay API...')
      setLoading(true)
      await Promise.all([
        fetchSummaryStats(),
        fetchHistory().catch(err => console.error('History fetch error:', err))
      ])
      console.log('✅ handleSync: Successfully refreshed summary stats')
      // Dashboard에서는 listings를 로드하지 않음 - 결과 화면에서만 로드
    } catch (err) {
      console.error('❌ Sync failed:', err)
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

      // Step 2: Update in queue (Dashboard에서는 queue만 관리)
      const updateItemInList = (list) => {
        return list.map(item => 
          item.id === itemId ? { ...item, supplier: newSupplier, supplier_name: newSupplier } : item
        )
      }

      // Queue에서만 업데이트 (Dashboard에서는 queue만 유지)
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
      fetchUserCredits()
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
      console.log('✅ OAuth callback success detected - verifying and connecting')
      
      // Clean URL first to prevent re-triggering
      window.history.replaceState({}, '', window.location.pathname)
      
      // Verify connection status from backend before proceeding
      console.log('🔍 Verifying connection status from backend...')
      axios.get(`${API_BASE_URL}/api/ebay/auth/status`, {
        params: { user_id: CURRENT_USER_ID },
        timeout: 30000
      }).then(response => {
        const isConnected = response.data?.connected === true && 
                           response.data?.token_status?.has_valid_token !== false &&
                           !response.data?.is_expired
        
        console.log('📊 Backend connection status:', {
          connected: response.data?.connected,
          hasValidToken: response.data?.token_status?.has_valid_token,
          isExpired: response.data?.is_expired,
          finalDecision: isConnected
        })
        
        if (isConnected) {
          console.log('✅ Connection verified - setting state and fetching listings')
          // Mark as processed AFTER verification
          sessionStorage.setItem(processedKey, 'connected')
          setIsStoreConnected(true)
          
          // Performance mark: OAuth callback 완료 시점
          if (typeof performance !== 'undefined' && performance.mark) {
            performance.mark('oauth_callback_complete')
          }
          
          // OAuth 콜백 성공 시 summary stats만 가져오기 (전체 listings는 가져오지 않음)
          setTimeout(() => {
            console.log('🔄 OAuth callback success - fetching summary stats only...')
            setIsStoreConnected(true)
            fetchSummaryStats().catch(err => {
              console.error('Failed to fetch summary stats after OAuth:', err)
            })
          }, 100)
        } else {
          console.warn('⚠️ Backend reports not connected, clearing session storage and showing error')
          sessionStorage.removeItem(processedKey)
          showToast('Connection verification failed. Please try again.', 'error')
        }
      }).catch(err => {
        console.error('❌ Failed to verify connection status:', err)
        // Still try to connect if URL says so (might be network issue)
        console.log('⚠️ Verification failed, but URL indicates success - proceeding with connection')
        sessionStorage.setItem(processedKey, 'connected')
        setIsStoreConnected(true)
        // Verification 실패 시에도 summary stats만 가져오기
        fetchSummaryStats().catch(fetchErr => {
          console.error('Failed to fetch summary stats:', fetchErr)
          showToast(getErrorMessage(fetchErr), 'error')
        })
      })
      
      // Clear the processed flag after a delay to allow for future connections
      setTimeout(() => {
        sessionStorage.removeItem(processedKey)
      }, 10000) // Increased to 10 seconds
    } else if (ebayError) {
      console.error('❌ OAuth callback error:', ebayError)
      const errorMessage = urlParams.get('message') || 'Failed to connect to eBay'
      showToast(`eBay connection failed: ${errorMessage}`, 'error')
      // Remove URL parameters
      window.history.replaceState({}, '', window.location.pathname)
      // Clear the processed flag and set connection state
      sessionStorage.removeItem(processedKey)
      setIsStoreConnected(false)
    } else if (!code && !ebayConnected && !ebayError && processed === 'connected') {
      // If we're marked as connected but URL doesn't show it, clear the flag
      // This can happen if connection failed but flag wasn't cleared
      console.log('⚠️ Session marked as connected but URL shows disconnected, clearing flag')
      sessionStorage.removeItem(processedKey)
    }
  }, []) // Keep empty dependency array - only run on mount
  
  // Initial Load - Check API health, eBay connection status, and fetch data (execute only once)
  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        const isHealthy = await checkApiHealth()
        if (isHealthy) {
          await fetchUserCredits()
          fetchHistory().catch(err => {
            console.error('History fetch error on mount:', err)
          })
          
          // Check eBay connection status on mount
          try {
            console.log('🔍 Checking eBay connection status on mount...')
            const response = await axios.get(`${API_BASE_URL}/api/ebay/auth/status`, {
              params: { user_id: CURRENT_USER_ID },
              timeout: 30000
            })
            
            const isConnected = response.data?.connected === true && 
                               response.data?.token_status?.has_valid_token !== false &&
                               !response.data?.is_expired
            
            if (isConnected) {
              console.log('✅ eBay is already connected - fetching summary stats...')
              setIsStoreConnected(true)
              // 연결되어 있으면 summary stats만 가져오기 (전체 listings는 가져오지 않음)
              fetchSummaryStats().catch(err => {
                console.error('Failed to fetch summary stats:', err)
              })
            } else {
              console.log('ℹ️ eBay is not connected yet')
              setIsStoreConnected(false)
            }
          } catch (ebayStatusErr) {
            console.warn('Failed to check eBay connection status on mount:', ebayStatusErr)
            // Don't set connection state on error - let user manually connect
          }
        }
      } catch (err) {
        console.warn('API Health Check failed (non-critical):', err)
        await fetchUserCredits()
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
        await axios.post(`${API_BASE_URL}/api/log-deletion`, {
          items: items
        }, {
          timeout: 30000 // Increased from 10s to 30s
        })
        // Refresh total deleted count
        const historyResponse = await axios.get(`${API_BASE_URL}/api/history`, {
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
        await axios.post(`${API_BASE_URL}/api/log-deletion`, {
          items: items
        }, {
          timeout: 30000 // Increased from 10s to 30s
        })
        // Refresh total deleted count
        const historyResponse = await axios.get(`${API_BASE_URL}/api/history`, {
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


  return (
    <div className="font-sans bg-black dark:bg-black min-h-full">
      <div className="px-6">
        {/* Summary Card */}
        <SummaryCard 
          key="summary-card"
          totalListings={totalListings}
          totalBreakdown={totalBreakdown}
          platformBreakdown={platformBreakdown}
          totalZombies={totalZombies}
          zombieBreakdown={zombieBreakdown}
          queueCount={queue.length}
          totalDeleted={totalDeleted}
          loading={loading || summaryLoading}
          filters={filters}
          viewMode={viewMode}
          onViewModeChange={null}
          connectedStore={selectedStore}
          connectedStoresCount={connectedStoresCount}
          onSync={handleSync}
          showFilter={showFilter}
          onToggleFilter={handleToggleFilter}
          // API Health & Credits
          apiConnected={apiConnected}
          apiError={apiError}
          userPlan={userPlan}
          // Low-Performing items for Product Journey analysis (Dashboard에서는 사용하지 않음)
          zombies={[]}
          userCredits={userCredits}
          usedCredits={usedCredits}
          // Store connection callback
          onConnectionChange={handleStoreConnection}
          // Supplier export callback
          onSupplierExport={handleSupplierExport}
          filterContent={null}
          // Summary stats (새로 추가)
          summaryStats={summaryStats}
          // Analysis result (for filtered badge)
          analysisResult={analysisResult}
          // Error callback
          onError={(msg, err) => showToast(getErrorMessage(err || { message: msg }), 'error')}
        />

        {/* Dev-only Top-up Button */}
        {import.meta.env.VITE_ENABLE_DEV_TOPUP === 'true' && (
          <div className="mt-4 mb-4">
            <button
              onClick={async () => {
                if (isToppingUp) return
                
                setIsToppingUp(true)
                try {
                  const response = await axios.post(`${API_BASE_URL}/api/dev/credits/topup`, {}, {
                    params: {
                      user_id: CURRENT_USER_ID,
                      amount: 100
                    },
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    timeout: 30000
                  })
                  
                  if (response.data.success) {
                    const { totalCredits, addedAmount } = response.data
                    setUserCredits(totalCredits)
                    showToast(`Dev top-up successful: +${addedAmount} credits`, 'success')
                    
                    // 크레딧 정보 다시 가져오기
                    fetchUserCredits().catch(err => console.error('Failed to refresh credits:', err))
                  } else {
                    throw new Error(response.data.message || 'Top-up failed')
                  }
                } catch (err) {
                  console.error('Dev top-up failed:', err)
                  
                  if (err.response?.status === 403) {
                    showToast('Dev top-up is not available in this environment', 'error')
                  } else {
                    showToast(getErrorMessage(err), 'error')
                  }
                } finally {
                  setIsToppingUp(false)
                }
              }}
              disabled={isToppingUp}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {isToppingUp ? 'Topping up...' : '🧪 Dev Top-up +100'}
            </button>
          </div>
        )}

        {/* FilterBar - Find Low-Performing SKUs 버튼 */}
        {isStoreConnected && summaryStats.activeCount > 0 && (
          <div className="mt-6">
            <FilterBar 
              onApplyFilter={handleApplyFilter}
              onSync={handleSync}
              loading={loading}
              initialFilters={filters}
            />
          </div>
        )}

        {/* Empty state when not connected (Dashboard에서는 카드만 표시) */}
        {!isStoreConnected || summaryStats.activeCount === 0 ? (
          <div className="bg-zinc-900 dark:bg-zinc-900 border border-zinc-800 dark:border-zinc-800 rounded-lg p-8 mt-8 text-center">
            <p className="text-lg text-zinc-300 dark:text-zinc-300 mb-2">
              📊 <strong className="text-white">Ready to Analyze</strong>
            </p>
            <p className="text-sm text-zinc-400 dark:text-zinc-400 mb-4">
              {!isStoreConnected 
                ? "Connect your eBay account to start analyzing your listings."
                : summaryStats.activeCount === 0
                ? "No listings found. Click 'Sync' to refresh or connect your eBay account."
                : "Use the filter bar below to analyze and find low-performing SKUs."
              }
            </p>
          </div>
        ) : null}

        {/* History View - Full Page */}
        {viewMode === 'history' && (
          <HistoryView 
            historyLogs={historyLogs}
            loading={loading}
            onBack={() => setViewMode('all')}
          />
        )}

        {/* Results Section - Find 버튼 클릭 시에만 표시 */}
        {showResults && (
          <div id="results-section" className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">
                {resultsMode === 'low' ? '📉 Low-Performing SKUs' : '📋 All Listings'}
              </h2>
              <button
                onClick={() => {
                  setShowResults(false)
                  setResultsFilters(null)
                }}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                ✕ 닫기
              </button>
            </div>
            <LowPerformingResults 
              mode={resultsMode}
              initialFilters={resultsFilters}
              initialItems={analysisResult?.items}
              onClose={() => {
                setShowResults(false)
                setResultsFilters(null)
              }}
              onError={(msg, err) => showToast(getErrorMessage(err || { message: msg }), 'error')}
            />
          </div>
        )}
        
        {/* Queue View는 Dashboard에서 유지 (로컬 상태만 사용) */}
        {viewMode === 'queue' && queue.length > 0 && (
          <div className="mt-8">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-zinc-400">
                ✅ <strong className="text-white">Full-Screen Final Review Mode</strong> - Review all items grouped by source. Each section has its own download button.
              </p>
            </div>
            <QueueReviewPanel
              queue={queue}
              onRemove={handleRemoveFromQueue}
              onSourceChange={handleSourceChange}
              onExportComplete={(exportedIds) => {
                setQueue(queue.filter(item => !exportedIds.includes(item.id)))
              }}
              onHistoryUpdate={() => {
                fetchHistory().catch(err => console.error('History fetch error:', err))
              }}
              onError={(msg, err) => showToast(getErrorMessage(err || { message: msg }), err ? 'error' : 'success')}
            />
          </div>
        )}
      </div>

      {/* Confirm Modal - 크레딧 소비 확인 */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => {
          if (!isAnalyzing) {
            setShowConfirmModal(false)
            setPendingAnalysisFilters(null)
          }
        }}
        onConfirm={handleConfirmAnalysis}
        creditsRequired={requiredCredits}
        currentCredits={userCredits}
        isProcessing={isAnalyzing || isFetchingQuote}
      />

      {/* Filtering Modal (레거시 - 필요시 유지) */}
      <FilteringModal
        isOpen={showFilteringModal}
        onClose={() => {
          // Don't allow closing during filtering
          if (!isFiltering) {
            setShowFilteringModal(false)
            setPendingFiltersForModal(null)
          }
        }}
        onConfirm={handleConfirmFiltering}
        creditsRequired={summaryStats.activeCount || 0}
        currentCredits={userCredits}
        listingCount={summaryStats.activeCount || 0}
        isFiltering={isFiltering}
      />

      {/* Error Modal */}
      {showErrorModal && createPortal(
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setShowErrorModal(false)}
        >
          <div 
            className="bg-zinc-900 border border-red-500/50 rounded-lg max-w-md w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-zinc-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                  <h3 className="text-xl font-bold text-white">Error</h3>
                </div>
                <button
                  onClick={() => setShowErrorModal(false)}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <p className="text-sm text-zinc-300 mb-6 leading-relaxed">
                {errorModalMessage}
              </p>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowErrorModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  Close
                </button>
                  <button
                    onClick={() => {
                      setShowErrorModal(false)
                      // Dashboard에서는 listings를 로드하지 않으므로 summary stats만 다시 가져오기
                      fetchSummaryStats().catch(err => {
                        console.error('Failed to retry summary stats:', err)
                        showToast(getErrorMessage(err), 'error')
                      })
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Retry
                  </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Toast Notification */}
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

