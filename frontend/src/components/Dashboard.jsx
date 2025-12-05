import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { useStore } from '../contexts/StoreContext'
import SummaryCard from './SummaryCard'
import ZombieTable from './ZombieTable'
import FilterBar from './FilterBar'
import DeleteQueue from './DeleteQueue'
import HistoryTable from './HistoryTable'
import HistoryView from './HistoryView'
import QueueReviewPanel from './QueueReviewPanel'
import { Button } from './ui/button'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const CURRENT_USER_ID = "default-user" // Temporary user ID for MVP phase

// Demo Mode - Set to true to use dummy data (false for production with real API)
// 🧪 테스트용: true = 더미 데이터, false = 실제 API
// Force redeploy: 2024-12-04
const DEMO_MODE = true

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
    const zombieScore = isZombie ? Math.floor(Math.random() * 50) + 50 : Math.floor(Math.random() * 40)
    
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
      recommendation: zombieScore >= 70 ? 'DELETE' : zombieScore >= 50 ? 'OPTIMIZE' : 'MONITOR',
      global_winner: Math.random() > 0.9,
      active_elsewhere: Math.random() > 0.8
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
  // Store connection state
  const [isStoreConnected, setIsStoreConnected] = useState(false)
  
  // DEMO_MODE 초기 데이터 설정 - 스토어 연결 전에는 0
  const [zombies, setZombies] = useState([]) // Start empty, populate after filter
  const [allListings, setAllListings] = useState([]) // Start empty, populate after store connection
  const [totalZombies, setTotalZombies] = useState(0) // Start at 0, update after filter
  const [totalListings, setTotalListings] = useState(0) // Start at 0, update after store connection
  const [totalBreakdown, setTotalBreakdown] = useState(DEMO_MODE ? { Amazon: 30, Walmart: 20, 'Home Depot': 15, AliExpress: 15, Costway: 10, 'CJ Dropshipping': 5, Banggood: 5 } : { Amazon: 0, Walmart: 0, Unknown: 0 })
  const [platformBreakdown, setPlatformBreakdown] = useState(DEMO_MODE ? { eBay: 100 } : { eBay: 0, Amazon: 0, Shopify: 0, Walmart: 0 })
  const [zombieBreakdown, setZombieBreakdown] = useState(DEMO_MODE ? { Amazon: 5, Walmart: 3, 'Home Depot': 1, AliExpress: 1, Costway: 1, Unknown: 1 } : {})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [queue, setQueue] = useState([])
  const [viewMode, setViewMode] = useState('total') // 항상 통계 뷰로 시작 (좀비 배너가 강조됨)
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
  const [showFilter, setShowFilter] = useState(false) // 기본: 필터 접힘
  
  // API Health Check State
  const [apiConnected, setApiConnected] = useState(false)
  const [apiError, setApiError] = useState(null)
  
  // User Credits & Plan State (from API)
  const [userCredits, setUserCredits] = useState(0)
  const [usedCredits, setUsedCredits] = useState(0)
  const [userPlan, setUserPlan] = useState('FREE')
  const [connectedStoresCount, setConnectedStoresCount] = useState(1)
  
  const [filters, setFilters] = useState({
    marketplace_filter: 'eBay',  // MVP Scope: Default to eBay (only eBay and Shopify supported)
    analytics_period_days: 7,    // 1. 분석 기준 기간 (기본값: 7일)
    min_days: 7,                 // Legacy compatibility
    max_sales: 0,                // 2. 기간 내 판매 건수 (기본값: 0건)
    max_watches: 0,              // 3. 찜하기 (Watch) (기본값: 0건)
    max_watch_count: 0,          // Legacy compatibility
    max_impressions: 100,        // 4. 총 노출 횟수 (기본값: 100회 미만)
    max_views: 10,               // 5. 총 조회 횟수 (기본값: 10회 미만)
    supplier_filter: 'All'
  })
  
  // API Health Check - Check connection on mount
  const checkApiHealth = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/`, { timeout: 5000 })
      if (response.status === 200) {
        setApiConnected(true)
        setApiError(null)
        return true
      }
    } catch (err) {
      console.error('API Health Check failed:', err)
      setApiConnected(false)
      setApiError('Connection Error')
      return false
    }
    return false
  }
  
  // Fetch user credits and plan info
  const fetchUserCredits = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/credits`, {
        params: { user_id: CURRENT_USER_ID }
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

  // 공급처 자동 감지 함수
  const detectSupplier = (title, sku = '') => {
    const text = `${title} ${sku}`.toLowerCase()
    
    // 패턴 매칭
    if (text.includes('aliexpress') || text.includes('ali-') || /^ae\d/i.test(sku)) {
      return 'AliExpress'
    }
    if (text.includes('amazon') || text.includes('amz-') || /^b0[a-z0-9]{8}/i.test(sku)) {
      return 'Amazon'
    }
    if (text.includes('walmart') || text.includes('wmt-')) {
      return 'Walmart'
    }
    if (text.includes('home depot') || text.includes('homedepot') || text.includes('hd-')) {
      return 'Home Depot'
    }
    if (text.includes('cj drop') || text.includes('cjdrop') || /^cj\d/i.test(sku)) {
      return 'CJ Dropshipping'
    }
    if (text.includes('costway')) {
      return 'Costway'
    }
    if (text.includes('banggood') || text.includes('bg-')) {
      return 'Banggood'
    }
    
    return 'Unknown'
  }

  // 좀비 스코어 계산 함수
  const calculateZombieScore = (listing, filterParams) => {
    let score = 0
    const daysListed = listing.days_listed || 0
    const sales = listing.quantity_sold || 0
    const watches = listing.watch_count || 0
    const views = listing.view_count || 0
    
    // 등록 기간이 길수록 점수 증가
    if (daysListed >= 60) score += 30
    else if (daysListed >= 30) score += 20
    else if (daysListed >= 14) score += 10
    
    // 판매가 없으면 점수 증가
    if (sales === 0) score += 30
    
    // 찜이 없으면 점수 증가
    if (watches === 0) score += 20
    else if (watches <= 2) score += 10
    
    // 조회수가 적으면 점수 증가
    if (views <= 5) score += 20
    else if (views <= 10) score += 10
    
    return Math.min(score, 100)
  }

  const fetchZombies = async (filterParams = filters) => {
    try {
      setLoading(true)
      
      // Demo Mode: Use dummy data
      if (DEMO_MODE) {
        await new Promise(resolve => setTimeout(resolve, 800)) // Simulate API delay
        
        // Filter dummy zombies based on filter params
        const maxSales = filterParams.max_sales || 0
        const maxWatches = filterParams.max_watches || 0
        const maxImpressions = filterParams.max_impressions || 100
        const maxViews = filterParams.max_views || 10
        
        const filteredZombies = DUMMY_ZOMBIES.filter(z => 
          z.total_sales <= maxSales &&
          z.watch_count <= maxWatches &&
          z.impressions < maxImpressions &&
          z.views < maxViews
        )
        
        setZombies(filteredZombies)
        setTotalZombies(filteredZombies.length)
        setLoading(false)
        return
      }
      
      // 🚀 Production Mode: Fetch from eBay API
      try {
        console.log('📦 Fetching listings from eBay API...')
        
        const response = await axios.get(`${API_BASE_URL}/api/ebay/listings/active`, {
          params: {
            user_id: CURRENT_USER_ID,
            page: 1,
            entries_per_page: 200
          }
        })
        
        if (!response.data.success) {
          throw new Error(response.data.error || 'Failed to fetch eBay listings')
        }
        
        const allListingsFromEbay = response.data.listings || []
        console.log(`✅ Received ${allListingsFromEbay.length} listings from eBay`)
        
        // 리스팅 데이터 변환 및 공급처 감지
        const transformedListings = allListingsFromEbay.map((item, index) => {
          const supplier = detectSupplier(item.title, item.sku)
          const zombieScore = calculateZombieScore(item, filterParams)
          
          return {
            id: item.item_id || `ebay-${index}`,
            item_id: item.item_id || item.ebay_item_id,
            ebay_item_id: item.ebay_item_id || item.item_id,
            title: item.title,
            price: item.price,
            sku: item.sku,
            supplier: supplier,
            supplier_name: supplier,
            total_sales: item.quantity_sold || 0,
            quantity_sold: item.quantity_sold || 0,
            watch_count: item.watch_count || 0,
            view_count: item.view_count || 0,
            views: item.view_count || 0,
            impressions: item.impressions || 0,
            days_listed: item.days_listed || 0,
            start_time: item.start_time,
            picture_url: item.picture_url,
            is_zombie: false, // 아래에서 필터링으로 결정
            zombie_score: zombieScore,
            recommendation: zombieScore >= 70 ? 'DELETE' : zombieScore >= 50 ? 'OPTIMIZE' : 'MONITOR'
          }
        })
        
        // 전체 리스팅 저장
        setAllListings(transformedListings)
        setTotalListings(transformedListings.length)
        
        // 공급처별 브레이크다운 계산
        const supplierBreakdown = {}
        transformedListings.forEach(item => {
          supplierBreakdown[item.supplier] = (supplierBreakdown[item.supplier] || 0) + 1
        })
        setTotalBreakdown(supplierBreakdown)
        setPlatformBreakdown({ eBay: transformedListings.length })
        
        // 좀비 필터링 적용
        const minDays = filterParams.analytics_period_days || filterParams.min_days || 7
        const maxSales = filterParams.max_sales || 0
        const maxWatches = filterParams.max_watches || filterParams.max_watch_count || 0
        const maxViews = filterParams.max_views || 10
        
        const filteredZombies = transformedListings.filter(item => {
          // 등록 기간 필터
          if (item.days_listed < minDays) return false
          // 판매 필터
          if (item.total_sales > maxSales) return false
          // 찜 필터
          if (item.watch_count > maxWatches) return false
          // 조회 필터
          if (item.view_count > maxViews) return false
          
          return true
        }).map(item => ({ ...item, is_zombie: true }))
        
        console.log(`🧟 Found ${filteredZombies.length} zombie listings`)
        
        // 좀비 공급처별 브레이크다운
        const zombieSupplierBreakdown = {}
        filteredZombies.forEach(item => {
          zombieSupplierBreakdown[item.supplier] = (zombieSupplierBreakdown[item.supplier] || 0) + 1
        })
        setZombieBreakdown(zombieSupplierBreakdown)
        
        setZombies(filteredZombies)
        setTotalZombies(filteredZombies.length)
        setError(null)
        
      } catch (ebayErr) {
        console.error('eBay API Error:', ebayErr)
        
        // eBay 연결 안됨 - 사용자에게 연결 안내
        if (ebayErr.response?.status === 401) {
          setError('eBay not connected. Please connect your eBay account first.')
        } else {
          setError(`Failed to fetch eBay listings: ${ebayErr.message}`)
        }
        
        // Fallback: Try existing analyze endpoint (DB data)
        try {
          console.log('⚠️ Falling back to DB data...')
      const params = {
        user_id: CURRENT_USER_ID,
            store_id: selectedStore?.id,
            marketplace: 'eBay',
            min_days: filterParams.analytics_period_days || filterParams.min_days || 7,
        max_sales: filterParams.max_sales || 0,
            max_watch_count: filterParams.max_watches || filterParams.max_watch_count || 0
      }
      
      const response = await axios.get(`${API_BASE_URL}/api/analyze`, { params })
          setZombies(response.data.zombies || [])
          setTotalZombies(response.data.zombie_count || 0)
      setTotalListings(response.data.total_count || 0)
          setTotalBreakdown(response.data.total_breakdown || {})
          setPlatformBreakdown(response.data.platform_breakdown || { eBay: 0 })
          setZombieBreakdown(response.data.zombie_breakdown || {})
        } catch (fallbackErr) {
          console.error('Fallback also failed:', fallbackErr)
        }
      }
      
    } catch (err) {
      setError('Failed to fetch low interest listings')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Handle store connection change
  const handleStoreConnection = (connected) => {
    setIsStoreConnected(connected)
    
    if (connected) {
      // When connected, load listings (demo data)
      if (DEMO_MODE) {
        setAllListings(DUMMY_ALL_LISTINGS)
        setTotalListings(DUMMY_ALL_LISTINGS.length)
      } else {
        fetchAllListings()
      }
    } else {
      // When disconnected, clear listings
      setAllListings([])
      setTotalListings(0)
      setZombies([])
      setTotalZombies(0)
    }
  }

  const fetchAllListings = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Demo Mode: Use dummy data
      if (DEMO_MODE) {
        await new Promise(resolve => setTimeout(resolve, 500))
        // 더미 데이터로 전체 리스팅 설정 (100개)
        setAllListings(DUMMY_ALL_LISTINGS)
        setTotalListings(DUMMY_ALL_LISTINGS.length)
        setLoading(false)
        return
      }
      
      // 🚀 Production Mode: Fetch from eBay API
      try {
        console.log('📦 Fetching all listings from eBay API...')
        
        const response = await axios.get(`${API_BASE_URL}/api/ebay/listings/active`, {
          params: {
            user_id: CURRENT_USER_ID,
            page: 1,
            entries_per_page: 200
          }
        })
        
        if (!response.data.success) {
          throw new Error(response.data.error || 'Failed to fetch eBay listings')
        }
        
        const allListingsFromEbay = response.data.listings || []
        console.log(`✅ Received ${allListingsFromEbay.length} total listings from eBay`)
        
        // 리스팅 데이터 변환 및 공급처 감지
        const transformedListings = allListingsFromEbay.map((item, index) => {
          const supplier = detectSupplier(item.title, item.sku)
          
          return {
            id: item.item_id || `ebay-${index}`,
            item_id: item.item_id || item.ebay_item_id,
            ebay_item_id: item.ebay_item_id || item.item_id,
            title: item.title,
            price: item.price,
            sku: item.sku,
            supplier: supplier,
            supplier_name: supplier,
            total_sales: item.quantity_sold || 0,
            quantity_sold: item.quantity_sold || 0,
            watch_count: item.watch_count || 0,
            view_count: item.view_count || 0,
            views: item.view_count || 0,
            impressions: item.impressions || 0,
            days_listed: item.days_listed || 0,
            start_time: item.start_time,
            picture_url: item.picture_url
          }
        })
        
        setAllListings(transformedListings)
        setTotalListings(transformedListings.length)
        
        // 공급처별 브레이크다운 계산
        const supplierBreakdown = {}
        transformedListings.forEach(item => {
          supplierBreakdown[item.supplier] = (supplierBreakdown[item.supplier] || 0) + 1
        })
        setTotalBreakdown(supplierBreakdown)
        setPlatformBreakdown({ eBay: transformedListings.length })
        
        setError(null)
        
      } catch (ebayErr) {
        console.error('eBay API Error:', ebayErr)
        
        // eBay 연결 안됨
        if (ebayErr.response?.status === 401) {
          setError('eBay not connected. Please connect your eBay account first.')
          setTotalListings(0)
          setAllListings([])
        } else {
          // Fallback: Try existing DB endpoint
          try {
            console.log('⚠️ Falling back to DB data...')
            const listingsParams = {
              user_id: CURRENT_USER_ID,
              store_id: selectedStore?.id,
              skip: 0,
              limit: 10000
            }
            
            const listingsResponse = await axios.get(`${API_BASE_URL}/api/listings`, {
              params: listingsParams
            })
            setAllListings(listingsResponse.data.listings || [])
            setTotalListings(listingsResponse.data.listings?.length || 0)
          } catch (fallbackErr) {
            console.error('Fallback also failed:', fallbackErr)
            setError('Failed to fetch listings')
          }
        }
      }
      
    } catch (err) {
      setError('Failed to fetch all listings')
      console.error('fetchAllListings error:', err)
    } finally {
      setLoading(false)
    }
  }

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

  const handleViewModeChange = (mode) => {
    setViewMode(mode)
    setSelectedIds([]) // Reset selection when switching views
    
    // Close filter when switching to non-zombie views
    if (mode === 'all' || mode === 'queue' || mode === 'history') {
      setShowFilter(false)
    }
    
    if (mode === 'total') {
      // Statistical view - no data fetching needed
      return
    } else if (mode === 'all') {
      // Show ALL listings (no filtering)
      fetchAllListings()
    } else if (mode === 'zombies') {
      // Show zombie listings (filter stays open for adjustment)
      fetchZombies()
    } else if (mode === 'history') {
      fetchHistory()
    }
    // 'queue' mode doesn't need to fetch data, it uses existing queue state
  }

  const handleToggleFilter = () => {
    setShowFilter(!showFilter)
  }

  const handleAnalyze = () => {
    fetchZombies(filters)
    setViewMode('zombies')
  }

  const handleApplyFilter = (newFilters) => {
    setFilters(newFilters)
    setSelectedIds([]) // Reset selection when filters change
    fetchZombies(newFilters)
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
    if (Array.isArray(checkedOrIds)) {
      setSelectedIds(checkedOrIds)
    } else {
      const currentData = viewMode === 'all' ? allListings : viewMode === 'queue' ? queue : zombies
      if (checkedOrIds) {
        setSelectedIds(currentData.map(item => item.id))
      } else {
        setSelectedIds([])
      }
    }
  }

  const handleAddToQueue = () => {
    // Only allow adding to queue from zombies view
    if (viewMode !== 'zombies') return
    
    const selectedItems = zombies.filter(z => selectedIds.includes(z.id))
    setQueue([...queue, ...selectedItems])
    // Remove selected items from candidates (visually)
    setZombies(zombies.filter(z => !selectedIds.includes(z.id)))
    setSelectedIds([])
    setTotalZombies(totalZombies - selectedItems.length)
    
    // 바로 Queue 뷰로 이동
    setViewMode('queue')
    setShowFilter(false)
  }

  const handleMoveToZombies = (itemIds = null) => {
    // Move items from all listings to zombies (manual zombie flagging)
    const idsToMove = itemIds ? (Array.isArray(itemIds) ? itemIds : [itemIds]) : selectedIds
    if (idsToMove.length === 0) return
    
    const itemsToMove = allListings.filter(item => idsToMove.includes(item.id))
    // Mark as zombie
    const markedItems = itemsToMove.map(item => ({ ...item, is_zombie: true, zombie_score: 100 }))
    
    // Add to zombies list
    setZombies([...zombies, ...markedItems])
    setTotalZombies(totalZombies + markedItems.length)
    
    // Remove from all listings
    setAllListings(allListings.filter(item => !idsToMove.includes(item.id)))
    setTotalListings(totalListings - markedItems.length)
    
    // Only clear selection if bulk action (not single item click)
    if (!itemIds) {
      setSelectedIds([])
    }
    
    // Stay on Active page - don't navigate
  }

  const handleRemoveFromQueueBulk = () => {
    // Remove selected items from queue (restore to candidates)
    if (viewMode !== 'queue') return
    
    const selectedItems = queue.filter(q => selectedIds.includes(q.id))
    // Add back to zombies list
    setZombies([...zombies, ...selectedItems])
    // Remove from queue
    setQueue(queue.filter(q => !selectedIds.includes(q.id)))
    setSelectedIds([])
    setTotalZombies(totalZombies + selectedItems.length)
  }

  const handleRemoveFromQueue = (id) => {
    setQueue(queue.filter(item => item.id !== id))
  }

  const handleSync = async () => {
    // Refresh all data
    await Promise.all([
      fetchZombies(),
      fetchAllListings(),
      fetchHistory().catch(err => console.error('History fetch error:', err))
    ])
  }

  const handleSourceChange = async (itemId, newSupplier) => {
    try {
      // Step 1: Update in backend database
      await axios.patch(`${API_BASE_URL}/api/listing/${itemId}`, {
        supplier: newSupplier
      })

      // Step 2: Update in local state (candidates/zombies/allListings)
      const updateItemInList = (list) => {
        return list.map(item => 
          item.id === itemId ? { ...item, supplier: newSupplier, supplier_name: newSupplier } : item
        )
      }

      if (viewMode === 'all') {
        setAllListings(updateItemInList(allListings))
      } else if (viewMode === 'zombies') {
        setZombies(updateItemInList(zombies))
      }

      // Step 3: If item is in queue, update it there too (will auto-regroup by supplier)
      const itemInQueue = queue.find(item => item.id === itemId)
      if (itemInQueue) {
        setQueue(updateItemInList(queue))
        // Note: QueueReviewPanel automatically regroups by supplier, so the item will move to the correct group
      }

    } catch (err) {
      console.error('Failed to update source:', err)
      alert('Failed to update source. Please try again.')
      // Optionally: revert the change in UI if backend update fails
    }
  }

  // Initial Load - Check API health and fetch data
  useEffect(() => {
    const initializeDashboard = async () => {
      // Step 1: Check API Health
      const isHealthy = await checkApiHealth()
      
      if (isHealthy) {
        // Step 2: Fetch user credits
        await fetchUserCredits()
        
        // Step 3: Fetch history only (listings require store connection)
    fetchHistory().catch(err => {
      console.error('History fetch error on mount:', err)
    })
        
        // Note: fetchAllListings() is called when store is connected via handleStoreConnection
      }
    }
    
    initializeDashboard()
    
    // Set up periodic health check every 30 seconds
    const healthCheckInterval = setInterval(checkApiHealth, 30000)
    
    return () => clearInterval(healthCheckInterval)
  }, [])
  
  // Fetch data when store is connected (handled by handleStoreConnection callback)
  // This useEffect is removed - connection is managed via onConnectionChange prop

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
      alert('No items to export. Please add items to the queue first.')
      return
    }

    try {
      // Step 1: Log deletion to history BEFORE exporting
      try {
        await axios.post(`${API_BASE_URL}/api/log-deletion`, {
          items: items
        })
        // Refresh total deleted count
        const historyResponse = await axios.get(`${API_BASE_URL}/api/history`, {
          params: { skip: 0, limit: 1 }
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
          export_mode: mode
        },
        {
          responseType: 'blob'
        }
      )

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      
      // Determine filename based on supplier and mode
      const source = items.length > 0 ? (items[0].supplier_name || items[0].supplier || "unknown").toLowerCase() : 'all'
      const filenameMap = {
        autods: `${source}_delete.csv`,
        yaballe: `${source}_delete_yaballe.csv`,
        ebay: `${source}_delete_ebay.csv`
      }
      
      link.setAttribute('download', filenameMap[mode])
      document.body.appendChild(link)
      link.click()
      link.remove()

      // Step 3: Remove exported items from queue
      const exportedIds = items.map(item => item.id)
      setQueue(queue.filter(item => !exportedIds.includes(item.id)))
    } catch (err) {
      alert('Failed to export CSV')
      console.error(err)
    }
  }


  return (
    <div className="font-sans bg-black dark:bg-black min-h-full">
      <div className="px-6">
        {/* Summary Card */}
        <SummaryCard 
          totalListings={totalListings}
          totalBreakdown={totalBreakdown}
          platformBreakdown={platformBreakdown}
          totalZombies={totalZombies}
          zombieBreakdown={zombieBreakdown}
          queueCount={queue.length}
          totalDeleted={totalDeleted}
          loading={loading}
          filters={filters}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          connectedStore={selectedStore}
          connectedStoresCount={connectedStoresCount}
          onSync={handleSync}
          showFilter={showFilter}
          onToggleFilter={handleToggleFilter}
          // API Health & Credits
          apiConnected={apiConnected}
          apiError={apiError}
          userPlan={userPlan}
          userCredits={userCredits}
          usedCredits={usedCredits}
          // Store connection callback
          onConnectionChange={handleStoreConnection}
          filterContent={showFilter && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 mt-6 animate-fade-in-up">
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500">🔍 Filter:</span>
                <div className="flex-1">
              <FilterBar 
                onApplyFilter={(newFilters) => {
                  setFilters(newFilters)
                  fetchZombies(newFilters)
                  setViewMode('zombies')
                }}
                onSync={handleSync}
                loading={loading}
                initialFilters={filters}
              />
                </div>
                <button 
                  onClick={() => setShowFilter(false)}
                  className="text-zinc-500 hover:text-white transition-colors text-sm"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        />

        {/* Initial Statistical View - Show when viewMode === 'total' and filter is not shown */}
        {viewMode === 'total' && !showFilter && (
          <div className="bg-zinc-900 dark:bg-zinc-900 border border-zinc-800 dark:border-zinc-800 rounded-lg p-8 mt-8 text-center">
            <p className="text-lg text-zinc-300 dark:text-zinc-300 mb-2">
              📊 <strong className="text-white">Ready to Analyze</strong>
            </p>
            <p className="text-sm text-zinc-400 dark:text-zinc-400 mb-4">
              Click <strong className="text-blue-400">"Total Active Listings"</strong> card above to open filters and analyze your inventory.
            </p>
            <p className="text-xs text-zinc-500">
              Or click <strong className="text-red-400">"Low Interest"</strong> card to see items that need attention.
            </p>
          </div>
        )}

        {/* History View - Full Page */}
        {viewMode === 'history' && (
          <HistoryView 
            historyLogs={historyLogs}
            loading={loading}
            onBack={() => setViewMode('all')}
          />
        )}

        {/* Dynamic Layout: Full Width for 'all', Split View for 'zombies' */}
        {/* Hide table and filters on initial load (viewMode === 'total') */}
        {viewMode !== 'total' && viewMode !== 'history' && (
          <div className={`flex gap-8 transition-all duration-300 ${
            viewMode === 'all' ? '' : ''
          }`}>
            {/* Left Column - Dynamic Width: Full width when queue is empty, flex-1 when queue has items */}
            <div className={`space-y-8 transition-all duration-300 ${
              (viewMode === 'all' || viewMode === 'history' || viewMode === 'queue')
                ? 'w-full' 
                : (viewMode === 'zombies' && queue.length === 0)
                  ? 'w-full'
                  : 'flex-1 min-w-0'
            }`}>
              {/* Active View - With Filter */}
              {viewMode === 'all' && (
                <div className="mt-6 space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-400">
                      📋 <strong className="text-white">All {allListings.length} Listings</strong> - Filter to find zombies
                    </p>
                  </div>
                  
                  {/* Inline Filter for Active View */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
                <FilterBar 
                      onApplyFilter={(newFilters) => {
                        setFilters(newFilters)
                        // Filter allListings locally
                        const filtered = allListings.filter(item => {
                          const matchesSales = (item.total_sales || 0) <= newFilters.max_sales
                          const matchesWatches = (item.watch_count || 0) <= newFilters.max_watches
                          const matchesViews = (item.views || 0) <= newFilters.max_views
                          const matchesImpressions = (item.impressions || 0) <= newFilters.max_impressions
                          return matchesSales && matchesWatches && matchesViews && matchesImpressions
                        })
                        // Move filtered items to zombies
                        setZombies(filtered)
                        setTotalZombies(filtered.length)
                        setViewMode('zombies')
                      }}
                  loading={loading}
                  initialFilters={filters}
                />
                  </div>
                </div>
              )}

            {/* Zombies View - No Filter, just results */}
            {viewMode === 'zombies' && (
              <div className="mt-6 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-zinc-400">
                    🧟 <strong className="text-red-400">{zombies.length} Zombie Listings</strong> found
                  </span>
                  <span className="text-xs text-zinc-600">
                    ({filters.min_days}d • {filters.max_sales} sales • ≤{filters.max_watch_count} views)
                  </span>
                </div>
                <button
                  onClick={() => {
                    setViewMode('all')
                    fetchAllListings()
                  }}
                  className="text-xs text-zinc-500 hover:text-white transition-colors"
                >
                  ← Back to All Listings
                </button>
              </div>
            )}

            {/* Briefing Text for Queue View */}
            {viewMode === 'queue' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-4 mt-6">
                <p className="text-sm text-zinc-400">
                  ✅ <strong className="text-white">Full-Screen Final Review Mode</strong> - Review all items grouped by source. Each section has its own download button.
                </p>
              </div>
            )}



            {/* Table - Shows different data based on viewMode */}
            {viewMode === 'queue' ? (
              <QueueReviewPanel
                queue={queue}
                onRemove={handleRemoveFromQueue}
                onSourceChange={handleSourceChange}
                onExportComplete={(exportedIds) => {
                  // Remove exported items from queue
                  setQueue(queue.filter(item => !exportedIds.includes(item.id)))
                }}
                onHistoryUpdate={() => {
                  // Refresh history count
                  fetchHistory().catch(err => console.error('History fetch error:', err))
                }}
              />
            ) : (
              <div className="bg-zinc-900 dark:bg-zinc-900 border border-zinc-800 dark:border-zinc-800 rounded-lg overflow-hidden">
                {loading ? (
                  <div className="p-8 text-center text-slate-500">
                    Loading {viewMode === 'all' ? 'all' : 'low interest'} listings...
                  </div>
                ) : error ? (
                  <div className="p-8 text-center text-red-500">
                    {error}
                  </div>
                ) : (() => {
                  const currentData = viewMode === 'all' ? allListings : zombies
                  const isEmpty = currentData.length === 0
                  
                  if (isEmpty) {
                    return (
                      <div className="p-8 text-center text-slate-500">
                        {viewMode === 'all' 
                          ? "No listings found."
                          : queue.length > 0 
                            ? "All items have been moved to the queue. Apply new filters to see more candidates."
                            : "No low interest items found! Your inventory is performing well. 🎉"
                        }
                      </div>
                    )
                  }
                  
                  return (
                    <div className="p-6">
                      {/* Filter Summary Banner - Only show for zombies view */}
                      {viewMode === 'zombies' && currentData.length > 0 && (
                        <div className="mb-6 p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                          <p className="text-base text-zinc-300">
                            Products filtered by: No sales in the past{' '}
                            <span className="font-bold text-white text-lg">{filters.analytics_period_days || filters.min_days || 7} days</span>
                            {filters.max_views !== undefined && filters.max_views !== null && (
                              <>
                                , views ≤ <span className="font-bold text-white text-lg">{filters.max_views}</span>
                              </>
                            )}
                            {filters.max_watches !== undefined && filters.max_watches !== null && (
                              <>
                                , watches ≤ <span className="font-bold text-white text-lg">{filters.max_watches}</span>
                              </>
                            )}
                            {filters.max_impressions !== undefined && filters.max_impressions !== null && (
                              <>
                                , impressions ≤ <span className="font-bold text-white text-lg">{filters.max_impressions}</span>
                              </>
                            )}
                            .
                          </p>
                        </div>
                      )}
                      <ZombieTable 
                        zombies={currentData}
                        selectedIds={selectedIds}
                        onSelect={handleSelect}
                        onSelectAll={handleSelectAll}
                        onSourceChange={handleSourceChange}
                        onAddToQueue={viewMode === 'zombies' ? handleAddToQueue : null}
                        showAddToQueue={viewMode === 'zombies'}
                        onMoveToZombies={viewMode === 'all' ? handleMoveToZombies : null}
                        showMoveToZombies={viewMode === 'all'}
                      />
                    </div>
                  )
                })()}
              </div>
            )}
            </div>

            {/* Right Column - Removed: Queue panel now accessed via Queue card */}
            {false && viewMode === 'zombies' && queue.length > 0 && (
              <div className="w-80 flex-shrink-0 transition-all duration-300">
                <div className="sticky top-4">
                  <DeleteQueue
                    queue={queue}
                    onRemove={handleRemoveFromQueue}
                    onExport={handleExport}
                    loading={loading}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard

