import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useStore } from '../contexts/StoreContext'
import SummaryCard from './SummaryCard'
import ZombieTable from './ZombieTable'
import FilterBar from './FilterBar'
import DeleteQueue from './DeleteQueue'
import HistoryTable from './HistoryTable'
import QueueReviewPanel from './QueueReviewPanel'
import { Button } from './ui/button'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const CURRENT_USER_ID = "default-user" // Temporary user ID for MVP phase

// Demo Mode - Set to true to use dummy data (false for production with real API)
// 🧪 테스트용: true = 더미 데이터, false = 실제 API
// Force redeploy: 2024-12-04
const DEMO_MODE = true

// Dummy data for demo/testing
const DUMMY_ZOMBIES = [
  { id: '1', item_id: 'eBay-123456789', title: 'Wireless Bluetooth Headphones Premium Quality', price: 29.99, supplier: 'Amazon', supplier_name: 'Amazon', total_sales: 0, watch_count: 0, impressions: 45, views: 3, days_listed: 45, is_zombie: true, zombie_score: 85, recommendation: 'DELETE', global_winner: false, active_elsewhere: false },
  { id: '2', item_id: 'eBay-234567890', title: 'LED Desk Lamp with USB Charging Port', price: 34.99, supplier: 'Walmart', supplier_name: 'Walmart', total_sales: 0, watch_count: 1, impressions: 67, views: 5, days_listed: 32, is_zombie: true, zombie_score: 72, recommendation: 'DELETE', global_winner: false, active_elsewhere: true },
  { id: '3', item_id: 'eBay-345678901', title: 'Portable Phone Charger 10000mAh Power Bank', price: 19.99, supplier: 'Amazon', supplier_name: 'Amazon', total_sales: 0, watch_count: 0, impressions: 23, views: 1, days_listed: 60, is_zombie: true, zombie_score: 92, recommendation: 'DELETE', global_winner: false, active_elsewhere: false },
  { id: '4', item_id: 'eBay-456789012', title: 'Kitchen Knife Set Stainless Steel 6-Piece', price: 45.99, supplier: 'Home Depot', supplier_name: 'Home Depot', total_sales: 0, watch_count: 2, impressions: 89, views: 8, days_listed: 21, is_zombie: true, zombie_score: 58, recommendation: 'OPTIMIZE', global_winner: true, active_elsewhere: false },
  { id: '5', item_id: 'eBay-567890123', title: 'Yoga Mat Non-Slip Exercise Fitness Mat', price: 24.99, supplier: 'Amazon', supplier_name: 'Amazon', total_sales: 0, watch_count: 0, impressions: 34, views: 2, days_listed: 55, is_zombie: true, zombie_score: 88, recommendation: 'DELETE', global_winner: false, active_elsewhere: false },
  { id: '6', item_id: 'eBay-678901234', title: 'Wireless Mouse Ergonomic Design 2.4GHz', price: 15.99, supplier: 'Walmart', supplier_name: 'Walmart', total_sales: 0, watch_count: 1, impressions: 56, views: 4, days_listed: 38, is_zombie: true, zombie_score: 68, recommendation: 'DELETE', global_winner: false, active_elsewhere: false },
  { id: '7', item_id: 'eBay-789012345', title: 'Smart Watch Fitness Tracker with Heart Rate', price: 49.99, supplier: 'AliExpress', supplier_name: 'AliExpress', total_sales: 0, watch_count: 3, impressions: 112, views: 12, days_listed: 14, is_zombie: true, zombie_score: 45, recommendation: 'MONITOR', global_winner: false, active_elsewhere: true },
  { id: '8', item_id: 'eBay-890123456', title: 'Camping Tent 4-Person Waterproof Easy Setup', price: 89.99, supplier: 'Amazon', supplier_name: 'Amazon', total_sales: 0, watch_count: 0, impressions: 28, views: 2, days_listed: 67, is_zombie: true, zombie_score: 95, recommendation: 'DELETE', global_winner: false, active_elsewhere: false },
  { id: '9', item_id: 'eBay-901234567', title: 'Coffee Maker 12-Cup Programmable Drip', price: 39.99, supplier: 'Walmart', supplier_name: 'Walmart', total_sales: 0, watch_count: 1, impressions: 78, views: 6, days_listed: 28, is_zombie: true, zombie_score: 62, recommendation: 'OPTIMIZE', global_winner: false, active_elsewhere: false },
  { id: '10', item_id: 'eBay-012345678', title: 'Bluetooth Speaker Portable Waterproof', price: 27.99, supplier: 'Amazon', supplier_name: 'Amazon', total_sales: 0, watch_count: 0, impressions: 41, views: 3, days_listed: 42, is_zombie: true, zombie_score: 82, recommendation: 'DELETE', global_winner: false, active_elsewhere: false },
  { id: '11', item_id: 'eBay-111222333', title: 'Electric Toothbrush Sonic Rechargeable', price: 32.99, supplier: 'Amazon', supplier_name: 'Amazon', total_sales: 0, watch_count: 2, impressions: 95, views: 9, days_listed: 19, is_zombie: true, zombie_score: 52, recommendation: 'OPTIMIZE', global_winner: true, active_elsewhere: false },
  { id: '12', item_id: 'eBay-222333444', title: 'Air Fryer 5.8QT Digital Touch Screen', price: 79.99, supplier: 'Costway', supplier_name: 'Costway', total_sales: 0, watch_count: 4, impressions: 134, views: 15, days_listed: 12, is_zombie: true, zombie_score: 38, recommendation: 'MONITOR', global_winner: false, active_elsewhere: true },
]

const DUMMY_STORE = {
  id: 'store-1',
  name: 'My eBay Store',
  email: 'seller@ebay.com',
  platform: 'eBay'
}

function Dashboard() {
  const { selectedStore } = useStore()
  // DEMO_MODE 초기 데이터 설정
  const [zombies, setZombies] = useState(DEMO_MODE ? DUMMY_ZOMBIES : [])
  const [allListings, setAllListings] = useState([]) // All listings for 'all' view mode
  const [totalZombies, setTotalZombies] = useState(DEMO_MODE ? DUMMY_ZOMBIES.length : 0)
  const [totalListings, setTotalListings] = useState(DEMO_MODE ? 1247 : 0)
  const [totalBreakdown, setTotalBreakdown] = useState(DEMO_MODE ? { Amazon: 523, Walmart: 312, 'Home Depot': 89, AliExpress: 156, Costway: 67, Unknown: 100 } : { Amazon: 0, Walmart: 0, Unknown: 0 })
  const [platformBreakdown, setPlatformBreakdown] = useState(DEMO_MODE ? { eBay: 1247 } : { eBay: 0, Amazon: 0, Shopify: 0, Walmart: 0 })
  const [zombieBreakdown, setZombieBreakdown] = useState(DEMO_MODE ? { Amazon: 5, Walmart: 3, 'Home Depot': 1, AliExpress: 1, Costway: 1, Unknown: 1 } : {})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [queue, setQueue] = useState([])
  const [viewMode, setViewMode] = useState('total') // 항상 통계 뷰로 시작 (좀비 배너가 강조됨)
  const [historyLogs, setHistoryLogs] = useState([])
  const [totalDeleted, setTotalDeleted] = useState(DEMO_MODE ? 23 : 0)
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

  const fetchAllListings = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Demo Mode: Use dummy data
      if (DEMO_MODE) {
        await new Promise(resolve => setTimeout(resolve, 500))
        // 더미 데이터에서는 이미 초기화된 값 사용
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
    
    // Close filter panel when switching to non-zombies view
    if (mode !== 'zombies' && mode !== 'total') {
      setShowFilter(false)
    }
    
    if (mode === 'total') {
      // Statistical view - no data fetching needed
      return
    } else if (mode === 'all') {
      fetchAllListings()
    } else if (mode === 'zombies') {
      // Show zombie listings
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
        
        // Step 3: Fetch initial data (all listings stats)
        await fetchAllListings()
        
        // Step 4: Fetch history (non-blocking)
        fetchHistory().catch(err => {
          console.error('History fetch error on mount:', err)
        })
      }
    }
    
    initializeDashboard()
    
    // Set up periodic health check every 30 seconds
    const healthCheckInterval = setInterval(checkApiHealth, 30000)
    
    return () => clearInterval(healthCheckInterval)
  }, [])
  
  // Fetch data when store changes
  useEffect(() => {
    if (selectedStore && apiConnected) {
      fetchAllListings()
    }
  }, [selectedStore?.id, apiConnected])

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
          filterContent={showFilter && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 animate-fade-in-up">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🔍</span> Analysis Filters
                </h3>
                <button 
                  onClick={() => setShowFilter(false)}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
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

        {/* Dynamic Layout: Full Width for 'all', Split View for 'zombies' */}
        {/* Hide table and filters on initial load (viewMode === 'total') */}
        {viewMode !== 'total' && (
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
              {/* Filter Bar - Only show for zombies view when filter panel is not shown above */}
              {viewMode === 'zombies' && !showFilter && (
                <FilterBar 
                  onApplyFilter={handleApplyFilter}
                  onSync={handleSync}
                  loading={loading}
                  initialFilters={filters}
                />
              )}

              {/* View Mode Info */}
              {viewMode === 'all' && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-4">
                  <p className="text-sm text-zinc-400">
                    📋 <strong className="text-white">Viewing All Listings</strong> - Click "Low Interest Detected" card to filter and optimize inventory.
                  </p>
                </div>
              )}

            {/* Briefing Text for Low Interest Items View */}
            {viewMode === 'zombies' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-4">
                <p className="text-sm text-zinc-400">
                  🔍 <strong className="text-white">Current Filter:</strong> Showing <strong className="text-blue-400">{filters.marketplace_filter === 'All' ? 'All Platforms' : `[${filters.marketplace_filter}]`}</strong> listings older than <strong className="text-white">{filters.min_days} days</strong> with <strong className="text-white">{filters.max_sales} sales</strong> and <strong className="text-white">≤ {filters.max_watch_count} views</strong>. These items have low customer interest and may need optimization.
                </p>
              </div>
            )}

            {/* Briefing Text for Queue View */}
            {viewMode === 'queue' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-4">
                <p className="text-sm text-zinc-400">
                  ✅ <strong className="text-white">Full-Screen Final Review Mode</strong> - Review all items grouped by source. Each section has its own download button.
                </p>
              </div>
            )}

            {/* Briefing Text for History View */}
            {viewMode === 'history' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-4">
                <p className="text-sm text-zinc-400">
                  💀 <strong className="text-white">Deletion History</strong> - View all items that have been exported for deletion. This is your permanent record.
                </p>
              </div>
            )}

            {/* Bulk Action Bar - Show for zombies view only (queue uses QueueReviewPanel) */}
            {viewMode === 'zombies' && zombies.length > 0 && (
              <div className="bg-zinc-900 dark:bg-zinc-900 border border-zinc-800 dark:border-zinc-800 rounded-lg p-6 mb-4">
                <div className="flex items-center justify-between gap-4">
                  {/* Left Side: Select All */}
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={
                          viewMode === 'queue' 
                            ? selectedIds.length === queue.length && queue.length > 0
                            : selectedIds.length === zombies.length && zombies.length > 0
                        }
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-700 dark:border-zinc-700 text-white dark:text-white focus:ring-white dark:focus:ring-white bg-zinc-800 dark:bg-zinc-800"
                      />
                      <span className="text-sm font-medium text-zinc-300 dark:text-zinc-300">
                        Select All ({viewMode === 'queue' ? queue.length : zombies.length} items)
                      </span>
                    </label>
                    {selectedIds.length > 0 && (
                      <span className="text-sm text-zinc-400 dark:text-zinc-400">
                        {selectedIds.length} item{selectedIds.length !== 1 ? 's' : ''} selected
                      </span>
                    )}
                  </div>

                  {/* Right Side: Action Button */}
                  <Button
                    onClick={handleAddToQueue}
                    disabled={selectedIds.length === 0}
                    className="bg-black hover:bg-gray-900 text-white font-semibold"
                  >
                    <span>Add Selected to Queue</span>
                    <span className="text-lg">➡️</span>
                    {selectedIds.length > 0 && (
                      <span className="ml-1 px-2 py-0.5 bg-gray-700 rounded text-xs font-bold">
                        {selectedIds.length}
                      </span>
                    )}
                  </Button>
                </div>
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
                {viewMode === 'history' ? (
                  <div className="p-6">
                    <HistoryTable logs={historyLogs} loading={loading} />
                  </div>
                ) : loading ? (
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
                      <ZombieTable 
                        zombies={currentData}
                        selectedIds={selectedIds}
                        onSelect={handleSelect}
                        onSelectAll={handleSelectAll}
                        onSourceChange={handleSourceChange}
                      />
                    </div>
                  )
                })()}
              </div>
            )}
            </div>

            {/* Right Column (Fixed Width) - Delete Queue - Show only when queue has items */}
            {viewMode === 'zombies' && queue.length > 0 && (
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

