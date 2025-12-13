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

// Railway URL이 변경되었을 수 있으므로 환경 변수 우선 사용
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://optlisting-production.up.railway.app'
const CURRENT_USER_ID = "default-user" // Temporary user ID for MVP phase

// Demo Mode - Set to true to use dummy data (false for production with real API)
// 🧪 테스트용: true = 더미 데이터, false = 실제 API
// Force redeploy: 2024-12-11 - 실제 eBay 테스트를 위해 false로 변경
const DEMO_MODE = false

// 캐시 설정
const CACHE_KEY = `optlisting_listings_${CURRENT_USER_ID}`
const CACHE_TIMESTAMP_KEY = `optlisting_listings_timestamp_${CURRENT_USER_ID}`
const CACHE_DURATION = 5 * 60 * 1000 // 5분 (밀리초)

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
      // Shopify 경유 정보 추가
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
      const response = await axios.get(`${API_BASE_URL}/api/health`, { 
        timeout: 10000,
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
      // 502 Bad Gateway, 네트워크 에러, CORS 에러 등 모든 에러 처리
      if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED') {
        console.warn('API Health Check failed: Server may be down or unreachable')
      } else {
        console.error('API Health Check failed:', err)
      }
      setApiConnected(false)
      // 502 에러인 경우 더 명확한 메시지
      if (err.response?.status === 502) {
        setApiError('Server Error (502)')
      } else if (err.code === 'ERR_NETWORK') {
        setApiError('Network Error')
      } else {
        setApiError('Connection Error')
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
        timeout: 10000,
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

  // 공급처 자동 감지 함수 (supplier_name과 supplier_id 모두 반환)
  // 우선순위: 자동화 툴 > 공급처
  const extractSupplierInfo = (title, sku = '', imageUrl = '') => {
    if (!title && !sku) return { supplier_name: 'Unknown', supplier_id: null }
    
    const text = `${title} ${sku}`.toLowerCase()
    const skuUpper = sku.toUpperCase()
    const titleLower = (title || '').toLowerCase()
    const imageUrlLower = (imageUrl || '').toLowerCase()
    
    // SKU를 하이픈(-) 또는 언더스코어(_)로 분리하여 분석
    const skuParts = skuUpper.split(/[-_]/)
    
    // ============================================
    // 자동화 툴 감지 (우선순위 높음)
    // ============================================
    
    // AutoDS 감지
    if (
      skuUpper.startsWith('AUTODS') ||
      skuUpper.startsWith('ADS') ||
      skuUpper.startsWith('AD-') ||
      skuUpper.includes('AUTODS') ||
      text.includes('autods') ||
      imageUrlLower.includes('autods')
    ) {
      // AutoDS SKU에서 실제 공급처 추출 시도 (예: "AUTODS-AMZ-B08ABC1234" → "B08ABC1234")
      let remainingSku = null
      if (skuUpper.startsWith('AUTODS')) {
        remainingSku = skuUpper.replace('AUTODS', '').replace(/^[-_]/, '').trim()
      } else if (skuUpper.startsWith('ADS')) {
        remainingSku = skuUpper.replace('ADS', '').replace(/^[-_]/, '').trim()
      } else if (skuUpper.startsWith('AD-')) {
        remainingSku = skuUpper.replace('AD-', '').trim()
      }
      
      // 남은 SKU에서 실제 공급처 ID 추출 (재귀적 파싱)
      let supplierId = null
      if (remainingSku) {
        const remainingParts = remainingSku.split(/[-_]/)
        
        // Amazon ASIN 패턴 찾기 (B0으로 시작하는 10자리)
        const amazonAsinPattern = /B0[0-9A-Z]{8}/
        const asinMatch = remainingSku.match(amazonAsinPattern)
        if (asinMatch) {
          supplierId = asinMatch[0]
        }
        // AMZ 접두사 제거 후 ASIN 찾기
        else if (remainingParts[0] === 'AMZ' && remainingParts.length > 1) {
          // "AMZ-B08ABC1234" → "B08ABC1234"
          for (let i = 1; i < remainingParts.length; i++) {
            if (amazonAsinPattern.test(remainingParts[i])) {
              supplierId = remainingParts[i]
              break
            }
          }
          if (!supplierId) {
            // ASIN 패턴이 없으면 나머지 부분을 ID로 사용
            supplierId = remainingParts.slice(1).join('-') || null
          }
        }
        // Walmart 패턴 (WM 접두사 제거)
        else if (remainingParts[0] === 'WM' || remainingParts[0] === 'WMT' || remainingParts[0] === 'WALMART') {
          // "WM-123456" → "123456"
          supplierId = remainingParts.slice(1).join('-') || null
        }
        // AliExpress 패턴 (AE, ALI 접두사 제거)
        else if (remainingParts[0] === 'AE' || remainingParts[0] === 'ALI' || remainingParts[0] === 'ALIEXPRESS') {
          // "AE-789012" → "789012"
          supplierId = remainingParts.slice(1).join('-') || null
        }
        // 다른 공급처 패턴들
        else if (['CJ', 'HD', 'WF', 'CO', 'CW', 'BG'].includes(remainingParts[0])) {
          // "CJ-345678" → "345678"
          supplierId = remainingParts.slice(1).join('-') || null
        }
        else {
          // 패턴이 없으면 전체를 ID로 사용 (단, AutoDS 접두사는 제외)
          supplierId = remainingSku || null
        }
      }
      
      return { supplier_name: 'AutoDS', supplier_id: supplierId }
    }
    
    // Yaballe 감지
    if (
      skuUpper.startsWith('YABALLE') ||
      skuUpper.startsWith('YAB-') ||
      skuUpper.startsWith('YB-') ||
      skuUpper.includes('YABALLE') ||
      text.includes('yaballe') ||
      imageUrlLower.includes('yaballe')
    ) {
      // Yaballe SKU에서 실제 공급처 추출 시도 (예: "YABALLE-AMZ-B08ABC1234" → "B08ABC1234")
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
      
      // 남은 SKU에서 실제 공급처 ID 추출 (재귀적 파싱)
      let supplierId = null
      if (remainingSku) {
        const remainingParts = remainingSku.split(/[-_]/)
        
        // Amazon ASIN 패턴 찾기 (B0으로 시작하는 10자리)
        const amazonAsinPattern = /B0[0-9A-Z]{8}/
        const asinMatch = remainingSku.match(amazonAsinPattern)
        if (asinMatch) {
          supplierId = asinMatch[0]
        }
        // AMZ 접두사 제거 후 ASIN 찾기
        else if (remainingParts[0] === 'AMZ' && remainingParts.length > 1) {
          // "AMZ-B08ABC1234" → "B08ABC1234"
          for (let i = 1; i < remainingParts.length; i++) {
            if (amazonAsinPattern.test(remainingParts[i])) {
              supplierId = remainingParts[i]
              break
            }
          }
          if (!supplierId) {
            // ASIN 패턴이 없으면 나머지 부분을 ID로 사용
            supplierId = remainingParts.slice(1).join('-') || null
          }
        }
        // Walmart 패턴 (WM 접두사 제거)
        else if (remainingParts[0] === 'WM' || remainingParts[0] === 'WMT' || remainingParts[0] === 'WALMART') {
          // "WM-123456" → "123456"
          supplierId = remainingParts.slice(1).join('-') || null
        }
        // AliExpress 패턴 (AE, ALI 접두사 제거)
        else if (remainingParts[0] === 'AE' || remainingParts[0] === 'ALI' || remainingParts[0] === 'ALIEXPRESS') {
          // "AE-789012" → "789012"
          supplierId = remainingParts.slice(1).join('-') || null
        }
        // 다른 공급처 패턴들
        else if (['CJ', 'HD', 'WF', 'CO', 'CW', 'BG'].includes(remainingParts[0])) {
          // "CJ-345678" → "345678"
          supplierId = remainingParts.slice(1).join('-') || null
        }
        else {
          // 패턴이 없으면 전체를 ID로 사용 (단, Yaballe 접두사는 제외)
          supplierId = remainingSku || null
        }
      }
      
      return { supplier_name: 'Yaballe', supplier_id: supplierId }
    }
    
    // Wholesale2B 감지
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
    // 공급처 감지 (SKU 패턴 우선, 그 다음 제목/이미지)
    // ============================================
    
    // Amazon 감지 (B0으로 시작하는 ASIN 패턴)
    const amazonAsinPattern = /B0[0-9A-Z]{8}/i
    if (amazonAsinPattern.test(sku) || text.includes('amazon') || text.includes('amz-') || 
        imageUrlLower.includes('amazon') || imageUrlLower.includes('ssl-images-amazon')) {
      // ASIN 추출
      const asinMatch = sku.match(amazonAsinPattern)
      const supplierId = asinMatch ? asinMatch[0] : (skuUpper.startsWith('AMZ') ? skuUpper.replace('AMZ', '').replace(/^[-_]/, '').trim() || null : null)
      return { supplier_name: 'Amazon', supplier_id: supplierId }
    }
    
    // AliExpress 감지
    if (/^ae\d/i.test(sku) || text.includes('aliexpress') || text.includes('ali-') || text.includes('alibaba') ||
        imageUrlLower.includes('alicdn') || imageUrlLower.includes('aliexpress')) {
      const supplierId = /^ae(\d+)/i.test(sku) ? sku.match(/^ae(\d+)/i)[1] : (skuUpper.startsWith('AE') ? skuUpper.replace('AE', '').replace(/^[-_]/, '').trim() || null : null)
      return { supplier_name: 'AliExpress', supplier_id: supplierId }
    }
    
    // Walmart 감지
    if (skuUpper.startsWith('WM') || skuUpper.startsWith('WMT') || text.includes('walmart') || text.includes('wmt-') ||
        imageUrlLower.includes('walmartimages') || imageUrlLower.includes('walmart.com')) {
      const supplierId = (skuUpper.startsWith('WM') || skuUpper.startsWith('WMT'))
        ? skuUpper.replace(/^(WM|WMT)/, '').replace(/^[-_]/, '').trim() || null
        : null
      return { supplier_name: 'Walmart', supplier_id: supplierId }
    }
    
    // Home Depot 감지
    if (skuUpper.startsWith('HD') || text.includes('home depot') || text.includes('homedepot') || text.includes('hd-') ||
        imageUrlLower.includes('homedepot')) {
      const supplierId = skuUpper.startsWith('HD') 
        ? skuUpper.replace('HD', '').replace(/^[-_]/, '').trim() || null
        : null
      return { supplier_name: 'Home Depot', supplier_id: supplierId }
    }
    
    // CJ Dropshipping 감지
    if (/^cj\d/i.test(sku) || text.includes('cj drop') || text.includes('cjdrop') || text.includes('cjdropshipping') ||
        imageUrlLower.includes('cjdropshipping')) {
      const supplierId = /^cj(\d+)/i.test(sku) ? sku.match(/^cj(\d+)/i)[1] : (skuUpper.startsWith('CJ') ? skuUpper.replace('CJ', '').replace(/^[-_]/, '').trim() || null : null)
      return { supplier_name: 'CJ Dropshipping', supplier_id: supplierId }
    }
    
    // Costway 감지
    if (skuUpper.startsWith('CW') || text.includes('costway') || imageUrlLower.includes('costway')) {
      const supplierId = skuUpper.startsWith('CW') 
        ? skuUpper.replace('CW', '').replace(/^[-_]/, '').trim() || null
        : null
      return { supplier_name: 'Costway', supplier_id: supplierId }
    }
    
    // Banggood 감지
    if (skuUpper.startsWith('BG') || text.includes('banggood') || text.includes('bg-') || imageUrlLower.includes('banggood')) {
      const supplierId = skuUpper.startsWith('BG') 
        ? skuUpper.replace('BG', '').replace(/^[-_]/, '').trim() || null
        : null
      return { supplier_name: 'Banggood', supplier_id: supplierId }
    }
    
    // Doba 감지
    if (skuUpper.startsWith('DOBA') || text.includes('doba') || imageUrlLower.includes('doba')) {
      const supplierId = skuUpper.startsWith('DOBA') 
        ? skuUpper.replace('DOBA', '').replace(/^[-_]/, '').trim() || null
        : null
      return { supplier_name: 'Doba', supplier_id: supplierId }
    }
    
    // DSers 감지
    if (skuUpper.startsWith('DSERS') || text.includes('dsers') || imageUrlLower.includes('dsers')) {
      const supplierId = skuUpper.startsWith('DSERS') 
        ? skuUpper.replace('DSERS', '').replace(/^[-_]/, '').trim() || null
        : null
      return { supplier_name: 'DSers', supplier_id: supplierId }
    }
    
    // Spocket 감지
    if (skuUpper.startsWith('SPK') || text.includes('spocket') || imageUrlLower.includes('spocket')) {
      const supplierId = skuUpper.startsWith('SPK') 
        ? skuUpper.replace('SPK', '').replace(/^[-_]/, '').trim() || null
        : null
      return { supplier_name: 'Spocket', supplier_id: supplierId }
    }
    
    // 일반적인 패턴: D로 시작하는 SKU (예: D0102HEVLYJ-KS Z1 BPNK)
    // 이런 경우는 "Unverified"로 분류
    if (skuUpper.startsWith('D') && /^D\d/.test(skuUpper)) {
      return { supplier_name: 'Unverified', supplier_id: null }
    }
    
    return { supplier_name: 'Unknown', supplier_id: null }
  }
  
  // Legacy 함수 (하위 호환성)
  const detectSupplier = (title, sku = '') => {
    const result = extractSupplierInfo(title, sku)
    return result.supplier_name
  }

  // Performance Score 계산 함수 (낮을수록 성능 낮음)
  const calculateZombieScore = (listing, filterParams) => {
    let score = 100 // Start with perfect score
    const daysListed = listing.days_listed || 0
    const sales = listing.quantity_sold || 0
    const watches = listing.watch_count || 0
    const views = listing.view_count || 0
    
    // 등록 기간이 길수록 점수 감소
    if (daysListed >= 60) score -= 30
    else if (daysListed >= 30) score -= 20
    else if (daysListed >= 14) score -= 10
    
    // 판매가 없으면 점수 감소
    if (sales === 0) score -= 30
    
    // 찜이 없으면 점수 감소
    if (watches === 0) score -= 20
    else if (watches <= 2) score -= 10
    
    // 조회수가 적으면 점수 감소
    if (views <= 5) score -= 20
    else if (views <= 10) score -= 10
    
    return Math.max(0, Math.min(score, 100))
  }

  const fetchZombies = async (filterParams = filters, forceRefresh = false) => {
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
      
      // 🔥 "Find Low-Performing SKUs" 버튼 클릭 시 항상 백엔드 API 호출하여 크레딧 차감
      // forceRefresh가 true이면 백엔드 /api/analyze 엔드포인트 호출 (크레딧 차감 포함)
      if (forceRefresh) {
        // 백엔드 /api/analyze 엔드포인트 호출 (크레딧 차감 포함)
        try {
          console.log('🔄 "Find Low-Performing SKUs" 버튼 클릭 - 백엔드 /api/analyze 호출 및 크레딧 차감')
          const params = {
            user_id: CURRENT_USER_ID,
            store_id: selectedStore?.id,
            marketplace: 'eBay',
            analytics_period_days: filterParams.analytics_period_days || filterParams.min_days || 7,
            min_days: filterParams.analytics_period_days || filterParams.min_days || 7,
            max_sales: filterParams.max_sales || 0,
            max_watches: filterParams.max_watches || filterParams.max_watch_count || 0,
            max_watch_count: filterParams.max_watches || filterParams.max_watch_count || 0,
            max_impressions: filterParams.max_impressions || 100,
            max_views: filterParams.max_views || 10,
            supplier_filter: filterParams.supplier_filter || 'All'
          }
          
          const response = await axios.get(`${API_BASE_URL}/api/analyze`, { params })
          setZombies(response.data.zombies || [])
          setTotalZombies(response.data.zombie_count || 0)
          setTotalListings(response.data.total_count || 0)
          setTotalBreakdown(response.data.total_breakdown || {})
          setPlatformBreakdown(response.data.platform_breakdown || { eBay: 0 })
          setZombieBreakdown(response.data.zombie_breakdown || {})
          
          // 크레딧 잔액 새로고침
          await fetchUserCredits()
          setError(null)
          setLoading(false)
          return
        } catch (analyzeErr) {
          console.error('백엔드 /api/analyze 호출 실패:', analyzeErr)
          
          // 크레딧 부족 에러 처리
          if (analyzeErr.response?.status === 402) {
            const errorDetail = analyzeErr.response?.data?.detail
            const availableCredits = errorDetail?.available_credits || 0
            const requiredCredits = errorDetail?.required_credits || 0
            const message = errorDetail?.message || '크레딧이 부족합니다.'
            
            const userMessage = `${message}\n\n필요한 크레딧: ${requiredCredits}\n보유 크레딧: ${availableCredits}\n\n크레딧을 구매하시겠습니까?`
            
            if (confirm(userMessage)) {
              window.location.href = '/#pricing'
            }
            
            setError(`크레딧 부족: ${requiredCredits} 크레딧이 필요하며, 현재 ${availableCredits} 크레딧만 보유하고 있습니다.`)
            setLoading(false)
            return
          }
          
          setError(`분석 실패: ${analyzeErr.message}`)
          setLoading(false)
          return
        }
      }
      
      // 🔥 forceRefresh가 false이면 로컬 필터링만 수행 (크레딧 차감 없음 - viewMode 변경 시 등)
      if (!forceRefresh && allListings.length > 0) {
        try {
          const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)
          if (cachedTimestamp) {
            const cacheAge = Date.now() - parseInt(cachedTimestamp, 10)
            if (cacheAge < CACHE_DURATION) {
              console.log(`✅ 로컬 데이터로 필터링 (캐시 유효: ${Math.floor(cacheAge / 1000)}초 전 조회)`)
              
              // 로컬 필터링만 수행 (크레딧 차감 없음)
              const minDays = filterParams.analytics_period_days || filterParams.min_days || 7
              const maxSales = filterParams.max_sales || 0
              const maxWatches = filterParams.max_watches || filterParams.max_watch_count || 0
              const maxViews = filterParams.max_views || 10
              
              const filteredZombies = allListings.filter(item => {
                if (item.days_listed < minDays) return false
                if (item.total_sales > maxSales) return false
                if (item.watch_count > maxWatches) return false
                if (item.view_count > maxViews) return false
                return true
              }).map(item => ({ ...item, is_zombie: true }))
              
              setZombies(filteredZombies)
              setTotalZombies(filteredZombies.length)
              setLoading(false)
              return
            }
          }
        } catch (cacheErr) {
          console.warn('캐시 확인 실패, API 호출:', cacheErr)
        }
      }
      
      // 🚀 Production Mode: Fetch from eBay API (캐시가 없거나 만료된 경우)
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
        
        // 디버깅: 모든 리스팅의 이미지 정보 확인
        if (allListingsFromEbay.length > 0) {
          console.log('🔍 Image data check for all listings:')
          allListingsFromEbay.forEach((listing, index) => {
            console.log(`  Listing ${index + 1} (${listing.item_id}):`, {
              picture_url: listing.picture_url || 'MISSING',
              thumbnail_url: listing.thumbnail_url || 'MISSING',
              image_url: listing.image_url || 'MISSING',
              title: listing.title?.substring(0, 30) || 'N/A'
            })
          })
        }
        
        // 리스팅 데이터 변환 및 공급처 감지
        const transformedListings = allListingsFromEbay.map((item, index) => {
          // 백엔드에서 이미 추출한 supplier 정보가 있으면 우선 사용, 없으면 프론트엔드에서 추출
          let supplierInfo
          if (item.supplier_name && item.supplier_id) {
            // 백엔드에서 이미 추출된 supplier 정보 사용
            supplierInfo = {
              supplier_name: item.supplier_name,
              supplier_id: item.supplier_id
            }
          } else {
            // 프론트엔드에서 supplier 정보 추출 (fallback)
            supplierInfo = extractSupplierInfo(item.title, item.sku, item.image_url || item.picture_url || item.thumbnail_url)
          }
          
          // 디버깅: supplier 감지 결과 확인
          if (index < 3) { // 처음 3개만 로그
            console.log(`🔍 Supplier detection for item ${index + 1}:`, {
              title: item.title?.substring(0, 50),
              sku: item.sku,
              detected_supplier: supplierInfo.supplier_name,
              detected_supplier_id: supplierInfo.supplier_id,
              source: item.supplier_name ? 'backend' : 'frontend'
            })
          }
          
          const zombieScore = calculateZombieScore(item, filterParams)
          
          return {
            id: item.item_id || `ebay-${index}`,
            item_id: item.item_id || item.ebay_item_id,
            ebay_item_id: item.ebay_item_id || item.item_id,
            sell_item_id: item.sell_item_id || item.item_id || item.ebay_item_id, // Sell Item ID 명시적으로 포함
            title: item.title,
            price: item.price,
            sku: item.sku,
            supplier: supplierInfo.supplier_name,
            supplier_name: supplierInfo.supplier_name,
            supplier_id: supplierInfo.supplier_id, // supplier_id 추가
            source: item.source || supplierInfo.supplier_name, // source 필드 추가 (백엔드 응답 우선, 없으면 supplier_name 사용)
            total_sales: item.quantity_sold || 0,
            quantity_sold: item.quantity_sold || 0,
            watch_count: item.watch_count || 0,
            view_count: item.view_count || 0,
            views: item.view_count || 0,
            impressions: item.impressions || 0,
            days_listed: item.days_listed || 0,
            start_time: item.start_time,
            picture_url: item.picture_url, // 메인 이미지 URL
            thumbnail_url: item.thumbnail_url || item.picture_url, // 썸네일 이미지 URL (좀비 SKU 리포트용)
            image_url: item.image_url || item.picture_url || item.thumbnail_url, // 프론트엔드 호환성을 위한 필드
            is_zombie: false, // 아래에서 필터링으로 결정
            zombie_score: zombieScore,
            recommendation: zombieScore <= 20 ? 'DELETE' : zombieScore <= 40 ? 'DELETE' : zombieScore <= 60 ? 'OPTIMIZE' : 'MONITOR'
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
        
        // 🔥 전체 리스팅도 업데이트 (캐시 갱신)
        setAllListings(transformedListings)
        setTotalListings(transformedListings.length)
        
        // 공급처별 브레이크다운 계산
        const supplierBreakdown = {}
        transformedListings.forEach(item => {
          supplierBreakdown[item.supplier] = (supplierBreakdown[item.supplier] || 0) + 1
        })
        setTotalBreakdown(supplierBreakdown)
        setPlatformBreakdown({ eBay: transformedListings.length })
        
        // 🔥 캐시 저장
        try {
          const cacheData = {
            listings: transformedListings,
            totalListings: transformedListings.length,
            totalBreakdown: supplierBreakdown,
            platformBreakdown: { eBay: transformedListings.length }
          }
          localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))
          localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString())
          console.log('✅ 데이터 캐시 저장 완료')
        } catch (cacheErr) {
          console.warn('캐시 저장 실패:', cacheErr)
        }
        
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
          
          // 크레딧 잔액 새로고침
          await fetchUserCredits()
        } catch (fallbackErr) {
          console.error('Fallback also failed:', fallbackErr)
          
          // 크레딧 부족 에러 처리
          if (fallbackErr.response?.status === 402) {
            const errorDetail = fallbackErr.response?.data?.detail
            const availableCredits = errorDetail?.available_credits || 0
            const requiredCredits = errorDetail?.required_credits || 0
            const message = errorDetail?.message || '크레딧이 부족합니다.'
            
            const userMessage = `${message}\n\n필요한 크레딧: ${requiredCredits}\n보유 크레딧: ${availableCredits}\n\n크레딧을 구매하시겠습니까?`
            
            if (confirm(userMessage)) {
              // 크레딧 구매 페이지로 이동 (또는 모달 열기)
              window.location.href = '/#pricing'
            }
            
            setError(`크레딧 부족: ${requiredCredits} 크레딧이 필요하며, 현재 ${availableCredits} 크레딧만 보유하고 있습니다.`)
            return
          }
          
          setError(`Failed to analyze listings: ${fallbackErr.message}`)
        }
      }
      
    } catch (err) {
      // 크레딧 부족 에러 처리
      if (err.response?.status === 402) {
        const errorDetail = err.response?.data?.detail
        const availableCredits = errorDetail?.available_credits || 0
        const requiredCredits = errorDetail?.required_credits || 0
        const message = errorDetail?.message || '크레딧이 부족합니다.'
        
        const userMessage = `${message}\n\n필요한 크레딧: ${requiredCredits}\n보유 크레딧: ${availableCredits}\n\n크레딧을 구매하시겠습니까?`
        
        if (confirm(userMessage)) {
          // 크레딧 구매 페이지로 이동 (또는 모달 열기)
          window.location.href = '/#pricing'
        }
        
        setError(`크레딧 부족: ${requiredCredits} 크레딧이 필요하며, 현재 ${availableCredits} 크레딧만 보유하고 있습니다.`)
      } else {
        setError('Failed to fetch low interest listings')
        console.error(err)
      }
    } finally {
      setLoading(false)
    }
  }

  // Handle store connection change
  const handleStoreConnection = (connected) => {
    const wasConnected = isStoreConnected
    setIsStoreConnected(connected)
    
    console.log('🔄 eBay 연결 상태 변경:', { wasConnected, connected })
    
    // 🔥 연결 해제 시 캐시 초기화
    if (!connected && wasConnected) {
      console.log('🗑️ 연결 해제 - 캐시 초기화')
      try {
        localStorage.removeItem(CACHE_KEY)
        localStorage.removeItem(CACHE_TIMESTAMP_KEY)
        setAllListings([])
        setTotalListings(0)
        setZombies([])
        setTotalZombies(0)
      } catch (err) {
        console.warn('캐시 초기화 실패:', err)
      }
      return
    }
    
    if (connected && !wasConnected) {
      // 연결됨: 제품 로드 (강제 새로고침)
      console.log('✅ eBay 연결됨 - 제품 로드 시작 (강제 새로고침)')
      if (DEMO_MODE) {
        setAllListings(DUMMY_ALL_LISTINGS)
        setTotalListings(DUMMY_ALL_LISTINGS.length)
      } else {
        fetchAllListings()
      }
    } else if (!connected && wasConnected) {
      // 연결 해제됨: 제품 초기화
      console.log('❌ eBay 연결 해제됨 - 제품 초기화')
      setAllListings([])
      setTotalListings(0)
      setZombies([])
      setTotalZombies(0)
    }
  }

  const fetchAllListings = async (forceRefresh = false) => {
    try {
      // 🔥 데이터가 이미 있고 캐시가 유효하면 API 호출하지 않음 (로딩 상태도 설정하지 않음)
      if (!forceRefresh && allListings.length > 0) {
        try {
          const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)
          if (cachedTimestamp) {
            const cacheAge = Date.now() - parseInt(cachedTimestamp, 10)
            if (cacheAge < CACHE_DURATION) {
              console.log(`✅ 데이터가 이미 있고 캐시 유효 - API 호출 건너뜀 (${Math.floor(cacheAge / 1000)}초 전 조회)`)
              return // 데이터가 이미 있고 캐시가 유효하면 API 호출하지 않음
            }
          }
        } catch (err) {
          console.warn('캐시 확인 실패:', err)
        }
      }
      
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
      
      // 🔥 캐시 확인: forceRefresh가 false이고 캐시가 유효하면 캐시 사용
      if (!forceRefresh) {
        try {
          const cachedData = localStorage.getItem(CACHE_KEY)
          const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)
          
          if (cachedData && cachedTimestamp) {
            const cacheAge = Date.now() - parseInt(cachedTimestamp, 10)
            
            if (cacheAge < CACHE_DURATION) {
              console.log(`✅ 캐시된 데이터 사용 (${Math.floor(cacheAge / 1000)}초 전 조회)`)
              const parsedData = JSON.parse(cachedData)
              setAllListings(parsedData.listings || [])
              setTotalListings(parsedData.totalListings || 0)
              setTotalBreakdown(parsedData.totalBreakdown || {})
              setPlatformBreakdown(parsedData.platformBreakdown || { eBay: 0 })
              setLoading(false)
              return
            } else {
              console.log(`⏰ 캐시 만료 (${Math.floor(cacheAge / 1000)}초 경과) - 새로 조회`)
            }
          }
        } catch (cacheErr) {
          console.warn('캐시 읽기 실패, API 호출:', cacheErr)
        }
      } else {
        console.log('🔄 강제 새로고침 - 캐시 무시')
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
          // supplier_name과 supplier_id 모두 추출
          const supplierInfo = extractSupplierInfo(item.title, item.sku, item.image_url || item.picture_url || item.thumbnail_url)
          
          return {
            id: item.item_id || `ebay-${index}`,
            item_id: item.item_id || item.ebay_item_id,
            ebay_item_id: item.ebay_item_id || item.item_id,
            sell_item_id: item.sell_item_id || item.item_id || item.ebay_item_id, // Sell Item ID 명시적으로 포함
            title: item.title,
            price: item.price,
            sku: item.sku,
            supplier: supplierInfo.supplier_name,
            supplier_name: supplierInfo.supplier_name,
            supplier_id: supplierInfo.supplier_id, // supplier_id 추가
            total_sales: item.quantity_sold || 0,
            quantity_sold: item.quantity_sold || 0,
            watch_count: item.watch_count || 0,
            view_count: item.view_count || 0,
            views: item.view_count || 0,
            impressions: item.impressions || 0,
            days_listed: item.days_listed || 0,
            start_time: item.start_time,
            picture_url: item.picture_url, // 메인 이미지 URL
            thumbnail_url: item.thumbnail_url || item.picture_url, // 썸네일 이미지 URL (좀비 SKU 리포트용)
            image_url: item.image_url || item.picture_url || item.thumbnail_url // 프론트엔드 호환성을 위한 필드
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
        
        // 🔥 캐시 저장
        try {
          const cacheData = {
            listings: transformedListings,
            totalListings: transformedListings.length,
            totalBreakdown: supplierBreakdown,
            platformBreakdown: { eBay: transformedListings.length }
          }
          localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))
          localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString())
          console.log('✅ 데이터 캐시 저장 완료')
        } catch (cacheErr) {
          console.warn('캐시 저장 실패:', cacheErr)
        }
        
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
      // 🔥 데이터가 이미 있고 캐시가 유효하면 API 호출하지 않음
      if (allListings.length > 0) {
        try {
          const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)
          if (cachedTimestamp) {
            const cacheAge = Date.now() - parseInt(cachedTimestamp, 10)
            if (cacheAge < CACHE_DURATION) {
              console.log(`✅ Active 카드 클릭 - 캐시된 데이터 사용 (${Math.floor(cacheAge / 1000)}초 전 조회)`)
              return // 데이터가 이미 있고 캐시가 유효하면 API 호출하지 않음
            }
          }
        } catch (err) {
          console.warn('캐시 확인 실패:', err)
        }
      }
      
      // 데이터가 없거나 캐시가 만료된 경우에만 API 호출
      if (allListings.length === 0 || !isStoreConnected) {
        fetchAllListings(false)
      }
    } else if (mode === 'zombies') {
      // Show zombie listings (filter stays open for adjustment) - 캐시 사용
      fetchZombies(filters, false)
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

  const handleApplyFilter = async (newFilters) => {
    console.log('🔍 handleApplyFilter 호출됨 - Find Low-Performing SKUs 버튼 클릭')
    setFilters(newFilters)
    setSelectedIds([]) // Reset selection when filters change
    
    // 🔥 "Find Low-Performing SKUs" 버튼 클릭 시 항상 크레딧 차감 팝업 표시
    // Active 카드에서 이미 조회된 데이터를 사용하더라도 분석 시에는 크레딧 차감 필요
    try {
      console.log('💰 크레딧 잔액 확인 시작...')
      // 크레딧 잔액 확인
      const creditsResponse = await axios.get(`${API_BASE_URL}/api/credits`, {
        params: { user_id: CURRENT_USER_ID },
        timeout: 10000
      })
      
      const availableCredits = creditsResponse.data?.available_credits || 0
      // 🔥 전체 스캔하는 제품 수만큼 크레딧 차감
      const requiredCredits = Math.max(1, totalListings || allListings.length || 0) // 최소 1 크레딧
      
      console.log(`💰 크레딧 정보: 보유=${availableCredits}, 필요=${requiredCredits} (전체 ${totalListings || allListings.length}개 리스팅 스캔)`)
      
      // 크레딧 부족 확인
      if (availableCredits < requiredCredits) {
        console.log('⚠️ 크레딧 부족 - 구매 안내 팝업 표시')
        const userMessage = `크레딧이 부족합니다.\n\n필요한 크레딧: ${requiredCredits}\n보유 크레딧: ${availableCredits}\n\n크레딧을 구매하시겠습니까?`
        
        if (confirm(userMessage)) {
          window.location.href = '/#pricing'
        }
        return
      }
      
      // 크레딧 충분 - 확인 팝업 표시
      console.log('✅ 크레딧 충분 - 확인 팝업 표시')
      const confirmMessage = `분석을 시작하시겠습니까?\n\n필요한 크레딧: ${requiredCredits} (전체 ${totalListings || allListings.length}개 리스팅 스캔)\n보유 크레딧: ${availableCredits}\n차감 후 잔액: ${availableCredits - requiredCredits}`
      
      const userConfirmed = confirm(confirmMessage)
      console.log(`👤 사용자 확인: ${userConfirmed}`)
      
      if (userConfirmed) {
        // 사용자 확인 후 필터링 진행 (크레딧 차감 포함, 백엔드 API 호출)
        console.log('🚀 사용자 확인 완료 - 분석 시작')
        fetchZombies(newFilters, true)
      } else {
        console.log('❌ 사용자 취소 - 분석 중단')
      }
    } catch (err) {
      console.error('❌ 크레딧 확인 실패:', err)
      // 크레딧 확인 실패 시에도 진행 (백엔드에서 처리)
      if (confirm('크레딧 확인에 실패했습니다. 계속 진행하시겠습니까?')) {
        fetchZombies(newFilters, true)
      }
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
    
    const selectedItems = zombies.filter(z => selectedIds.includes(z.id)).map(item => ({
      ...item,
      // source 필드가 없으면 supplier_name 또는 supplier로 설정
      source: item.source || item.supplier_name || item.supplier || 'Unknown'
    }))
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
    const markedItems = itemsToMove.map(item => ({ ...item, is_zombie: true, zombie_score: 0 }))
    
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

  // OAuth 콜백 후 URL 파라미터 확인 및 연결 상태 강제 업데이트
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const ebayConnected = urlParams.get('ebay_connected')
    const ebayError = urlParams.get('ebay_error')
    const code = urlParams.get('code')
    const state = urlParams.get('state')
    
    // 🔥 중요: eBay가 프론트엔드로 직접 리다이렉트한 경우 (code 파라미터가 있음)
    // 백엔드 콜백 엔드포인트로 리다이렉트
    if (code && !ebayConnected && !ebayError) {
      console.log('🔄 eBay OAuth code 감지 - 백엔드로 리다이렉트')
      console.log('   Code:', code.substring(0, 20) + '...')
      console.log('   State:', state)
      
      // 백엔드 콜백 엔드포인트로 리다이렉트 (모든 파라미터 전달)
      const callbackUrl = `${API_BASE_URL}/api/ebay/auth/callback?${urlParams.toString()}`
      console.log('   Redirecting to:', callbackUrl)
      window.location.href = callbackUrl
      return // 리다이렉트 후 실행 중단
    }
    
    if (ebayConnected === 'true') {
      console.log('✅ OAuth 콜백 성공 - eBay 연결됨')
      
      // 즉시 연결 상태 업데이트
      setIsStoreConnected(true)
      console.log('🔄 연결 상태를 true로 설정')
      
      // URL 파라미터 제거 (깔끔한 URL 유지)
      window.history.replaceState({}, '', window.location.pathname)
      
      // 제품 로드 (약간의 지연 후 - 토큰이 DB에 저장되는 시간 고려)
      // 연결 직후이므로 강제 새로고침
      setTimeout(() => {
        console.log('📦 OAuth 콜백 후 제품 로드 시작 (강제 새로고침)')
        if (!DEMO_MODE) {
          fetchAllListings(true).catch(err => {
            console.error('제품 로드 실패:', err)
          })
        }
      }, 3000) // 3초 대기 (DB 저장 시간 고려)
      
      // 연결 상태 재확인 (SummaryCard가 자동으로 확인하지만, 강제로 한 번 더)
      setTimeout(async () => {
        try {
          const statusResponse = await axios.get(`${API_BASE_URL}/api/ebay/auth/status`, {
            params: { user_id: CURRENT_USER_ID },
            timeout: 30000
          })
          if (statusResponse.data?.connected === true) {
            console.log('✅ 연결 상태 확인 완료:', statusResponse.data)
            setIsStoreConnected(true)
          } else {
            console.warn('⚠️ 연결 상태 확인 실패:', statusResponse.data)
          }
        } catch (err) {
          console.error('❌ 연결 상태 확인 에러:', err)
        }
      }, 5000) // 5초 후 재확인
      
    } else if (ebayError) {
      console.error('❌ OAuth 콜백 에러:', ebayError)
      const errorMessage = urlParams.get('message') || 'eBay 연결에 실패했습니다'
      alert(`eBay 연결 실패: ${errorMessage}`)
      // URL 파라미터 제거
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])
  
  // 강제 새로고침 이벤트 리스너
  useEffect(() => {
    const handleForceRefresh = () => {
      console.log('🔄 강제 새로고침 요청')
      // 캐시 초기화
      try {
        localStorage.removeItem(CACHE_KEY)
        localStorage.removeItem(CACHE_TIMESTAMP_KEY)
      } catch (err) {
        console.warn('캐시 초기화 실패:', err)
      }
      // 데이터 새로고침
      if (isStoreConnected) {
        fetchAllListings(true)
        if (viewMode === 'zombies') {
          fetchZombies(filters, true)
        }
      }
    }
    
    window.addEventListener('forceRefresh', handleForceRefresh)
    return () => window.removeEventListener('forceRefresh', handleForceRefresh)
  }, [isStoreConnected, viewMode, filters])

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
        // 캐시가 있으면 자동으로 사용됨
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

    // 동시 요청 방지
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
          timeout: 10000 // 10초 타임아웃
        })
        // Refresh total deleted count
        const historyResponse = await axios.get(`${API_BASE_URL}/api/history`, {
          params: { skip: 0, limit: 1 },
          timeout: 10000
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
          timeout: 30000 // 30초 타임아웃 추가
        }
      )

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      
      // Determine filename based on supplier and mode
      // source 필드가 있으면 사용, 없으면 supplier_name 또는 supplier 사용
      const getSource = (item) => {
        return item.source || item.supplier_name || item.supplier || "unknown"
      }
      const source = items.length > 0 ? getSource(items[0]).toLowerCase().replace(/\s+/g, '_') : 'all'
      const filenameMap = {
        autods: `${source}_delete.csv`,
        yaballe: `${source}_delete_yaballe.csv`,
        ebay: `${source}_delete_ebay.csv`
      }
      
      link.setAttribute('download', filenameMap[mode] || `${source}_delete.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url) // 메모리 누수 방지

      // Step 3: Remove exported items from queue if they were in queue
      if (itemsToExport === null) {
        const exportedIds = items.map(item => item.id)
        setQueue(queue.filter(item => !exportedIds.includes(item.id)))
      }
    } catch (err) {
      let errorMessage = 'CSV 추출 중 오류가 발생했습니다.'
      
      if (err.code === 'ECONNABORTED') {
        errorMessage = '요청 시간이 초과되었습니다. 다시 시도해주세요.'
      } else if (err.response) {
        errorMessage = `서버 오류: ${err.response.status} - ${err.response.statusText || err.response.data?.detail || '알 수 없는 오류'}`
      } else if (err.request) {
        errorMessage = '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.'
      } else {
        errorMessage = `CSV 추출 실패: ${err.message || '알 수 없는 오류'}`
      }
      
      setError(errorMessage)
      alert(errorMessage)
      console.error('Export error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Handle supplier-specific export from Product Journey section
  const handleSupplierExport = async (items, targetTool, supplierName) => {
    if (!items || items.length === 0) {
      alert(`No items to export for ${supplierName}`)
      return
    }

    // 동시 요청 방지
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
          timeout: 10000 // 10초 타임아웃
        })
        // Refresh total deleted count
        const historyResponse = await axios.get(`${API_BASE_URL}/api/history`, {
          params: { skip: 0, limit: 1 },
          timeout: 10000
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
          timeout: 30000 // 30초 타임아웃 추가
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
      window.URL.revokeObjectURL(url) // 메모리 누수 방지
    } catch (err) {
      let errorMessage = `CSV 추출 중 오류가 발생했습니다.`
      
      if (err.code === 'ECONNABORTED') {
        errorMessage = '요청 시간이 초과되었습니다. 다시 시도해주세요.'
      } else if (err.response) {
        errorMessage = `서버 오류: ${err.response.status} - ${err.response.statusText || err.response.data?.detail || '알 수 없는 오류'}`
      } else if (err.request) {
        errorMessage = '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.'
      } else {
        errorMessage = `CSV 추출 실패: ${err.message || '알 수 없는 오류'}`
      }
      
      setError(errorMessage)
      alert(`Failed to export CSV for ${supplierName}: ${errorMessage}`)
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
          // Low-Performing items for Product Journey analysis
          zombies={zombies}
          userCredits={userCredits}
          usedCredits={usedCredits}
          // Store connection callback
          onConnectionChange={handleStoreConnection}
          // Supplier export callback
          onSupplierExport={handleSupplierExport}
          filterContent={showFilter && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 mt-6 animate-fade-in-up">
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500">🔍 Filter:</span>
                <div className="flex-1">
              <FilterBar 
                onApplyFilter={async (newFilters) => {
                  await handleApplyFilter(newFilters)
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
                      onApplyFilter={async (newFilters) => {
                        await handleApplyFilter(newFilters)
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
                    📉 <strong className="text-red-400">{zombies.length} Low-Performing SKUs</strong> found
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
                            Low-Performing SKUs filtered by: No sales in the past{' '}
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

