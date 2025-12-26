import React, { useState, useEffect, useMemo } from 'react'
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
import { Button } from './ui/button'
import { AlertCircle, X } from 'lucide-react'

// Use environment variable for Railway URL, fallback based on environment
// Priority: VITE_API_URL env var > Development (empty for Vite proxy) > Production (Railway URL)
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? '' : 'https://optlisting-production.up.railway.app')
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
  const [isStoreConnected, setIsStoreConnected] = useState(false)
  const [allListings, setAllListings] = useState([])
  const [zombies, setZombies] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [queue, setQueue] = useState([])
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
  
  // API Health Check State
  const [apiConnected, setApiConnected] = useState(false)
  const [apiError, setApiError] = useState(null)
  
  // Error Modal State
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorModalMessage, setErrorModalMessage] = useState('')
  
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

  // Derived values only (no duplicate state)
  const totalListings = useMemo(() => allListings.length, [allListings])
  const totalZombies = useMemo(() => zombies.length, [zombies])
  
  const totalBreakdown = useMemo(() => {
    const breakdown = {}
    allListings.forEach(item => {
      const supplier = item.supplier || item.supplier_name || 'Unknown'
      breakdown[supplier] = (breakdown[supplier] || 0) + 1
    })
    return breakdown
  }, [allListings])
  
  const platformBreakdown = useMemo(() => ({ eBay: allListings.length }), [allListings])
  
  const zombieBreakdown = useMemo(() => {
    const breakdown = {}
    zombies.forEach(item => {
      const supplier = item.supplier || item.supplier_name || 'Unknown'
      breakdown[supplier] = (breakdown[supplier] || 0) + 1
    })
    return breakdown
  }, [zombies])

  // Derived: filtered listings (100% local)
  const filteredListings = useMemo(() => {
    if (viewMode !== 'zombies' || zombies.length === 0) return allListings
    return zombies
  }, [viewMode, allListings, zombies])
  
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

  // 100% local filtering - no network calls
  const applyLocalFilter = (filterParams = filters) => {
    if (allListings.length === 0) {
      setZombies([])
      return
    }

    const minDays = filterParams.analytics_period_days || filterParams.min_days || 7
    const maxSales = filterParams.max_sales || 0
    const maxWatches = filterParams.max_watches || filterParams.max_watch_count || 0
    const maxImpressions = filterParams.max_impressions || 100
    const maxViews = filterParams.max_views || 10
    
    const filteredZombies = allListings.filter(item => {
      if ((item.days_listed || 0) < minDays) return false
      if ((item.total_sales || item.quantity_sold || 0) > maxSales) return false
      if ((item.watch_count || 0) > maxWatches) return false
      if ((item.impressions || 0) > maxImpressions) return false
      if ((item.view_count || item.views || 0) > maxViews) return false
      return true
    }).map(item => ({ ...item, is_zombie: true }))
    
    setZombies(filteredZombies)
  }

  // Handle store connection change
  const handleStoreConnection = (connected, forceLoad = false) => {
    setIsStoreConnected(connected)
    
    // Clear data when disconnected
    if (!connected) {
      setAllListings([])
      setZombies([])
      setViewMode('total')
      setShowFilter(false)
    } else {
      // When connected, fetch listings if in demo mode or if forceLoad is true
      if (DEMO_MODE) {
        setAllListings(DUMMY_ALL_LISTINGS)
        setViewMode('all')
        setShowFilter(true)
      } else if (forceLoad) {
        // Fetch listings when connection is confirmed and forceLoad is true
        console.log('🔄 handleStoreConnection: forceLoad=true, calling fetchAllListings()')
        fetchAllListings().catch(err => {
          console.error('Failed to fetch listings after connection:', err)
        })
      }
    }
  }

  // Called ONLY from: (1) OAuth success OR (2) handleSync OR (3) handleStoreConnection with forceLoad
  const fetchAllListings = async () => {
    try {
      console.log('📦 fetchAllListings: Starting to fetch eBay listings...')
      setLoading(true)
      setError(null)
      
      if (DEMO_MODE) {
        setAllListings(DUMMY_ALL_LISTINGS)
        setViewMode('all')
        setShowFilter(true)
        return
      }
      
      console.log('📡 fetchAllListings: Calling API:', `${API_BASE_URL}/api/ebay/listings/active`)
      const response = await axios.get(`${API_BASE_URL}/api/ebay/listings/active`, {
        params: {
          user_id: CURRENT_USER_ID,
          page: 1,
          entries_per_page: 200
        },
        timeout: 120000 // 120초로 증가 (백엔드가 여러 API 호출을 순차 처리하므로 시간이 필요)
      })
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to fetch eBay listings')
      }
      
      const allListingsFromEbay = response.data.listings || []
      console.log(`✅ fetchAllListings: Successfully fetched ${allListingsFromEbay.length} listings`)
      
      // Debug: Check first item's image URLs
      if (allListingsFromEbay.length > 0) {
        const firstItem = allListingsFromEbay[0]
        console.log('🔍 First item image URLs:', {
          image_url: firstItem.image_url,
          picture_url: firstItem.picture_url,
          thumbnail_url: firstItem.thumbnail_url,
          item_id: firstItem.item_id,
          title: firstItem.title?.substring(0, 50)
        })
      }
      
      // Transform listing data and detect suppliers
      const transformedListings = allListingsFromEbay.map((item, index) => {
        const supplierInfo = extractSupplierInfo(item.title, item.sku, item.image_url || item.picture_url || item.thumbnail_url)
        
        return {
          id: item.item_id || `ebay-${index}`,
          item_id: item.item_id || item.ebay_item_id,
          ebay_item_id: item.ebay_item_id || item.item_id,
          sell_item_id: item.sell_item_id || item.item_id || item.ebay_item_id,
          title: item.title,
          price: item.price,
          sku: item.sku,
          supplier: supplierInfo.supplier_name,
          supplier_name: supplierInfo.supplier_name,
          supplier_id: supplierInfo.supplier_id,
          source: item.source || supplierInfo.supplier_name,
          total_sales: item.quantity_sold || 0,
          quantity_sold: item.quantity_sold || 0,
          watch_count: item.watch_count || 0,
          view_count: item.view_count || 0,
          views: item.view_count || 0,
          impressions: item.impressions || 0,
          days_listed: item.days_listed || 0,
          start_time: item.start_time,
          picture_url: item.picture_url,
          thumbnail_url: item.thumbnail_url || item.picture_url,
          image_url: item.image_url || item.picture_url || item.thumbnail_url
        }
      })
      
      // Debug: Check image URLs in transformed listings
      const listingsWithImages = transformedListings.filter(l => l.image_url || l.picture_url || l.thumbnail_url).length
      const listingsWithoutImages = transformedListings.length - listingsWithImages
      console.log(`📊 Image statistics: ${listingsWithImages} with images, ${listingsWithoutImages} without images`)
      
      if (listingsWithoutImages > 0) {
        const firstNoImage = transformedListings.find(l => !(l.image_url || l.picture_url || l.thumbnail_url))
        if (firstNoImage) {
          console.warn('⚠️ Sample item without image:', {
            item_id: firstNoImage.item_id,
            title: firstNoImage.title?.substring(0, 50),
            raw_data: allListingsFromEbay.find(item => item.item_id === firstNoImage.item_id)
          })
        }
      }
      
      if (transformedListings.length > 0) {
        setViewMode('all')
        setShowFilter(true)
      }
      
      setAllListings(transformedListings)
      setError(null)
      
    } catch (err) {
      console.error('fetchAllListings error:', err)
      
      let errorMessage = ''
      
      if (err.response?.status === 401) {
        errorMessage = 'eBay 계정이 연결되지 않았습니다. eBay 계정을 먼저 연결해주세요.'
        setError(errorMessage)
        setAllListings([])
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMessage = '요청 시간이 초과되었습니다. 서버가 응답하지 않거나 네트워크가 느릴 수 있습니다. 잠시 후 다시 시도해주세요.'
        setError(errorMessage)
        // Don't clear existing listings on timeout - keep what we have
      } else if (allListings.length === 0) {
        errorMessage = `제품 목록을 가져오는데 실패했습니다: ${err.message || '알 수 없는 오류'}. 다시 시도해주세요.`
        setError(errorMessage)
      } else {
        // If we have existing listings, just log the error but don't show it prominently
        console.warn('Failed to refresh listings, but keeping existing data:', err)
        errorMessage = `제품 목록을 새로고침하는데 실패했습니다: ${err.message || '알 수 없는 오류'}. 기존 데이터는 유지됩니다.`
      }
      
      // Show error modal if there's an error message
      if (errorMessage) {
        setErrorModalMessage(errorMessage)
        setShowErrorModal(true)
      }
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

  const openAllListingsView = () => {
    setViewMode('all')
    setShowFilter(true)
    setSelectedIds([])
  }

  const handleViewModeChange = (mode) => {
    setViewMode(mode)
    setSelectedIds([]) // Reset selection when switching views
    
    // Close filter when switching to non-zombie views (but keep filter when switching to 'all' mode)
    if (mode === 'queue' || mode === 'history') {
      setShowFilter(false)
    }
    // Don't close filter when switching to 'all' mode (filter should be open when auto-displayed after connection)
    
    if (mode === 'total') {
      // Statistical view - no data fetching needed
      return
    } else if (mode === 'all') {
      setShowFilter(true)
      return
    } else if (mode === 'zombies') {
      // When zombie card is clicked: filter if needed
      if (zombies.length === 0 && allListings.length > 0) {
        applyLocalFilter(filters)
      }
      return
    } else if (mode === 'history') {
      fetchHistory()
    }
    // 'queue' mode doesn't need to fetch data, it uses existing queue state
  }

  const handleToggleFilter = () => {
    setShowFilter(!showFilter)
  }

  const handleAnalyze = () => {
    applyLocalFilter(filters)
    setViewMode('zombies')
  }

  // 100% local filter - no network calls
  const handleApplyFilter = (newFilters) => {
    setFilters(newFilters)
    setSelectedIds([])
    applyLocalFilter(newFilters)
    setViewMode('zombies')
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
      // Set to supplier_name or supplier if source field is missing
      source: item.source || item.supplier_name || item.supplier || 'Unknown'
    }))
    setQueue([...queue, ...selectedItems])
    // Remove selected items from candidates (visually)
    setZombies(zombies.filter(z => !selectedIds.includes(z.id)))
    setSelectedIds([])
    
    // Navigate directly to Queue view
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
    
    // Remove from all listings
    setAllListings(allListings.filter(item => !idsToMove.includes(item.id)))
    
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
  }

  const handleRemoveFromQueue = (id) => {
    setQueue(queue.filter(item => item.id !== id))
  }

  // Sync: fetchAllListings + history (only network calls)
  const handleSync = async () => {
    try {
      setLoading(true)
      await Promise.all([
        fetchAllListings(),
        fetchHistory().catch(err => console.error('History fetch error:', err))
      ])
    } catch (err) {
      console.error('Sync failed:', err)
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

  // Check URL parameters after OAuth callback and force update connection status
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const ebayConnected = urlParams.get('ebay_connected')
    const ebayError = urlParams.get('ebay_error')
    const code = urlParams.get('code')
    const state = urlParams.get('state')
    
    // Important: If eBay redirected directly to frontend (code parameter exists)
    // Redirect to backend callback endpoint
    if (code && !ebayConnected && !ebayError) {
      console.log('🔄 eBay OAuth code detected - redirecting to backend')
      console.log('   Code:', code.substring(0, 20) + '...')
      console.log('   State:', state)
      
      // Redirect to backend callback endpoint (pass all parameters)
      const callbackUrl = `${API_BASE_URL}/api/ebay/auth/callback?${urlParams.toString()}`
      console.log('   Redirecting to:', callbackUrl)
      window.location.href = callbackUrl
      return // Stop execution after redirect
    }
    
    if (ebayConnected === 'true') {
      window.history.replaceState({}, '', window.location.pathname)
      setIsStoreConnected(true)
      handleStoreConnection(true)
      
      // Fetch listings after OAuth success (ONE of two call sites)
      if (!DEMO_MODE) {
        fetchAllListings().catch(err => {
          console.error('Product load failed:', err)
        })
      }
    } else if (ebayError) {
      console.error('❌ OAuth callback error:', ebayError)
      const errorMessage = urlParams.get('message') || 'Failed to connect to eBay'
      alert(`eBay connection failed: ${errorMessage}`)
      // Remove URL parameters
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, []) // Keep empty dependency array - only run on mount
  
  // Initial Load - Check API health and fetch data (execute only once)
  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        const isHealthy = await checkApiHealth()
        if (isHealthy) {
          await fetchUserCredits()
          fetchHistory().catch(err => {
            console.error('History fetch error on mount:', err)
          })
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
    if (allListings.length > 0) return
    
    if (viewParam === 'history') {
      setViewMode('history')
      fetchHistory()
    }
  }, [viewParam, allListings.length])

  const handleExport = async (mode, itemsToExport = null) => {
    // Use provided items or default to full queue
    const items = itemsToExport || queue
    
    if (items.length === 0) {
      alert('No items to export. Please add items to the queue first.')
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
          key="summary-card"
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
          filterContent={null}
        />

        {/* Empty state when not connected or no data */}
        {!isStoreConnected || allListings.length === 0 ? (
          <div className="bg-zinc-900 dark:bg-zinc-900 border border-zinc-800 dark:border-zinc-800 rounded-lg p-8 mt-8 text-center">
            <p className="text-lg text-zinc-300 dark:text-zinc-300 mb-2">
              📊 <strong className="text-white">Ready to Analyze</strong>
            </p>
            <p className="text-sm text-zinc-400 dark:text-zinc-400 mb-4">
              {!isStoreConnected 
                ? "Connect your eBay account to start analyzing your listings."
                : "No listings found. Please sync from eBay or check your connection."
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

        {/* Main content - render if connected and has data (excluding history) */}
        {isStoreConnected && allListings.length > 0 && viewMode !== 'history' && (
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
              {/* Active View - Header and FilterBar - SINGLE RENDER LOCATION */}
              {/* Only display in 'all' view mode when eBay is connected and data exists */}
              {viewMode === 'all' && isStoreConnected && allListings.length > 0 && !loading && (
                <div className="mt-6 space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-400">
                      📋 <strong className="text-white">All {allListings.length} Listings</strong> - Filter to find zombies
                    </p>
                  </div>
                  
                  {/* FilterBar - SINGLE RENDER LOCATION - Show after product fetch is complete */}
                  <div className="mt-4">
                    <FilterBar 
                      key="single-filter-bar-below-listings"
                      onApplyFilter={async (newFilters) => {
                        await handleApplyFilter(newFilters)
                        setViewMode('zombies')
                      }}
                      onSync={handleSync}
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
                  onClick={() => setViewMode('all')}
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
                  if (isStoreConnected && allListings.length > 0) {
                    const tableData = filteredListings
                    
                    return (
                      <div className="p-6">
                        {viewMode === 'zombies' && tableData.length > 0 && (
                          <div className="mb-6 p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                            <p className="text-base text-zinc-300">
                              Low-Performing SKUs filtered by: No sales in the past{' '}
                              <span className="font-bold text-white text-lg">{filters.analytics_period_days || filters.min_days || 7} days</span>
                              {filters.max_views !== undefined && filters.max_views !== null && (
                                <>, views ≤ <span className="font-bold text-white text-lg">{filters.max_views}</span></>
                              )}
                              {filters.max_watches !== undefined && filters.max_watches !== null && (
                                <>, watches ≤ <span className="font-bold text-white text-lg">{filters.max_watches}</span></>
                              )}
                              {filters.max_impressions !== undefined && filters.max_impressions !== null && (
                                <>, impressions ≤ <span className="font-bold text-white text-lg">{filters.max_impressions}</span></>
                              )}
                              .
                            </p>
                          </div>
                        )}
                        <ZombieTable 
                          zombies={tableData}
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
                  }
                  
                  return (
                    <div className="p-8 text-center text-slate-500">
                      {!isStoreConnected 
                        ? "Connect your eBay account to start analyzing your listings."
                        : "No listings found. Please sync from eBay or check your connection."
                      }
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
                  <h3 className="text-xl font-bold text-white">제품 업로드 실패</h3>
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
                  닫기
                </button>
                <button
                  onClick={() => {
                    setShowErrorModal(false)
                    fetchAllListings()
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  다시 시도
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default Dashboard

