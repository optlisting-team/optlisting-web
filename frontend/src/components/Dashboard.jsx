import React, { useState, useEffect, useRef } from 'react'
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

// Use environment variable for Railway URL, fallback to default if not set
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://web-production-3dc73.up.railway.app'
const CURRENT_USER_ID = "default-user" // Temporary user ID for MVP phase

// Demo Mode - Set to true to use dummy data (false for production with real API)
// Test mode: true = dummy data, false = real API
// Force redeploy: 2024-12-11 - Changed to false for real eBay testing
const DEMO_MODE = false

// Cache configuration
const CACHE_KEY = `optlisting_listings_${CURRENT_USER_ID}`
const CACHE_TIMESTAMP_KEY = `optlisting_listings_timestamp_${CURRENT_USER_ID}`
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes (in milliseconds)

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
  // Store connection state
  const [isStoreConnected, setIsStoreConnected] = useState(false)
  // Ref to prevent duplicate execution
  const listingsLoadedOnceRef = useRef(false)
  // Debug HUD: Last fetch time
  const [lastFetchAt, setLastFetchAt] = useState(null)
  
  // DEMO_MODE initial data setup - set to 0 before store connection
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
  const [viewMode, setViewModeRaw] = useState('total') // Always start with statistics view (zombie banner emphasized)
  
  // Wrap setViewMode to log all changes
  const setViewMode = (next) => {
    const from = viewMode
    console.log('[setViewMode]', { 
      from, 
      to: next, 
      stack: new Error().stack.split('\n').slice(1, 4).join('\n') // Top 3 stack frames only
    })
    setViewModeRaw(next)
  }
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
  
  // User Credits & Plan State (from API)
  const [userCredits, setUserCredits] = useState(0)
  const [usedCredits, setUsedCredits] = useState(0)
  const [userPlan, setUserPlan] = useState('FREE')
  const [connectedStoresCount, setConnectedStoresCount] = useState(1)
  
  const [filters, setFilters] = useState({
    marketplace_filter: 'eBay',  // MVP Scope: Default to eBay (only eBay and Shopify supported)
    analytics_period_days: 7,    // 1. Analysis period in days (default: 7 days)
    min_days: 7,                 // Legacy compatibility
    max_sales: 0,                // 2. Maximum sales count in period (default: 0)
    max_watches: 0,              // 3. Maximum watch count (default: 0)
    max_watch_count: 0,          // Legacy compatibility
    max_impressions: 100,        // 4. Maximum impressions (default: less than 100)
    max_views: 10,               // 5. Maximum views (default: less than 10)
    supplier_filter: 'All'
  })
  
  // Retry utility function
  const retryApiCall = async (apiCall, maxRetries = 3, delay = 2000) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await apiCall()
      } catch (err) {
        const isLastAttempt = i === maxRetries - 1
        if (isLastAttempt) {
          throw err
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)))
      }
    }
  }

  // API Health Check - Check connection on mount
  const checkApiHealth = async () => {
    try {
      const response = await retryApiCall(async () => {
        return await axios.get(`${API_BASE_URL}/api/health`, { 
          timeout: 30000, // Increased from 10s to 30s
          headers: {
            'Content-Type': 'application/json',
          },
        })
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
      const response = await retryApiCall(async () => {
        return await axios.get(`${API_BASE_URL}/api/credits`, {
          params: { user_id: CURRENT_USER_ID },
          timeout: 30000, // Increased from 10s to 30s
          headers: {
            'Content-Type': 'application/json',
          },
        })
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
      
      // When "Find Low-Performing SKUs" button is clicked, always call backend API to deduct credits
      // If forceRefresh is true, call backend /api/analyze endpoint (includes credit deduction)
      if (forceRefresh) {
        // Call backend /api/analyze endpoint (includes credit deduction)
        try {
          console.log('🔄 "Find Low-Performing SKUs" button clicked - calling backend /api/analyze and deducting credits')
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
          
          // Refresh credit balance
          await fetchUserCredits()
          setError(null)
          setLoading(false)
          return
        } catch (analyzeErr) {
          console.error('Backend /api/analyze call failed:', analyzeErr)
          
          // Handle insufficient credits error
          if (analyzeErr.response?.status === 402) {
            const errorDetail = analyzeErr.response?.data?.detail
            const availableCredits = errorDetail?.available_credits || 0
            const requiredCredits = errorDetail?.required_credits || 0
            const message = errorDetail?.message || 'Insufficient credits.'
            
            const userMessage = `${message}\n\nRequired credits: ${requiredCredits}\nAvailable credits: ${availableCredits}\n\nWould you like to purchase credits?`
            
            if (confirm(userMessage)) {
              window.location.href = '/#pricing'
            }
            
            setError(`Insufficient credits: ${requiredCredits} credits required, but only ${availableCredits} credits available.`)
            setLoading(false)
            return
          }
          
          setError(`Analysis failed: ${analyzeErr.message}`)
          setLoading(false)
          return
        }
      }
      
      // If forceRefresh is false, only perform local filtering (no credit deduction - e.g., when viewMode changes)
      if (!forceRefresh && allListings.length > 0) {
        try {
          const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)
          if (cachedTimestamp) {
            const cacheAge = Date.now() - parseInt(cachedTimestamp, 10)
            if (cacheAge < CACHE_DURATION) {
              console.log(`✅ Filtering with local data (cache valid: queried ${Math.floor(cacheAge / 1000)} seconds ago)`)
              
              // Only perform local filtering (no credit deduction)
              const minDays = filterParams.analytics_period_days || filterParams.min_days || 7
              const maxSales = filterParams.max_sales || 0
              const maxWatches = filterParams.max_watches || filterParams.max_watch_count || 0
              const maxImpressions = filterParams.max_impressions || 100
              const maxViews = filterParams.max_views || 10
              
              console.log('🔍 Applying local filtering:', { minDays, maxSales, maxWatches, maxImpressions, maxViews })
              
              const filteredZombies = allListings.filter(item => {
                // Listing period filter: only include items listed for minDays or more (exclude items less than 7 days)
                // Example: if minDays=7, only include items with days_listed >= 7 (exclude items less than 7 days)
                if ((item.days_listed || 0) < minDays) return false
                // Sales filter: only items with maxSales or less (e.g., 0 or less)
                if ((item.total_sales || item.quantity_sold || 0) > maxSales) return false
                // Watch filter: only items with maxWatches or less (e.g., 0 or less)
                if ((item.watch_count || 0) > maxWatches) return false
                // Impressions filter: only items with maxImpressions or less (e.g., 100 or less)
                if ((item.impressions || 0) > maxImpressions) return false
                // Views filter: only items with maxViews or less (e.g., 10 or less)
                if ((item.view_count || item.views || 0) > maxViews) return false
                return true
              }).map(item => ({ ...item, is_zombie: true }))
              
              console.log(`🧟 Local filtering result: ${filteredZombies.length} zombies found (out of ${allListings.length} total)`)
              
              setZombies(filteredZombies)
              setTotalZombies(filteredZombies.length)
              setLoading(false)
              return
            }
          }
        } catch (cacheErr) {
          console.warn('Cache check failed, calling API:', cacheErr)
        }
      }
      
      // 🚀 Production Mode: Fetch from eBay API (when cache is missing or expired)
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
        
        // Debug: Check image information for all listings
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
        
        // Transform listing data and detect suppliers
        const transformedListings = allListingsFromEbay.map((item, index) => {
          // Use supplier info extracted by backend if available, otherwise extract on frontend
          let supplierInfo
          if (item.supplier_name && item.supplier_id) {
            // Use supplier info already extracted by backend
            supplierInfo = {
              supplier_name: item.supplier_name,
              supplier_id: item.supplier_id
            }
          } else {
            // Extract supplier info on frontend (fallback)
            supplierInfo = extractSupplierInfo(item.title, item.sku, item.image_url || item.picture_url || item.thumbnail_url)
          }
          
          // Debug: Check supplier detection result
          if (index < 3) { // Log only first 3 items
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
            sell_item_id: item.sell_item_id || item.item_id || item.ebay_item_id, // Explicitly include Sell Item ID
            title: item.title,
            price: item.price,
            sku: item.sku,
            supplier: supplierInfo.supplier_name,
            supplier_name: supplierInfo.supplier_name,
            supplier_id: supplierInfo.supplier_id, // Add supplier_id
            source: item.source || supplierInfo.supplier_name, // Add source field (prefer backend response, fallback to supplier_name)
            total_sales: item.quantity_sold || 0,
            quantity_sold: item.quantity_sold || 0,
            watch_count: item.watch_count || 0,
            view_count: item.view_count || 0,
            views: item.view_count || 0,
            impressions: item.impressions || 0,
            days_listed: item.days_listed || 0,
            start_time: item.start_time,
            picture_url: item.picture_url, // Main image URL
            thumbnail_url: item.thumbnail_url || item.picture_url, // Thumbnail image URL (for zombie SKU report)
            image_url: item.image_url || item.picture_url || item.thumbnail_url, // Field for frontend compatibility
            is_zombie: false, // Determined by filtering below
            zombie_score: zombieScore,
            recommendation: zombieScore <= 20 ? 'DELETE' : zombieScore <= 40 ? 'DELETE' : zombieScore <= 60 ? 'OPTIMIZE' : 'MONITOR'
          }
        })
        
        // Save all listings
        setAllListings(transformedListings)
        setTotalListings(transformedListings.length)
        
        // Calculate supplier breakdown
        const supplierBreakdown = {}
        transformedListings.forEach(item => {
          supplierBreakdown[item.supplier] = (supplierBreakdown[item.supplier] || 0) + 1
        })
        setTotalBreakdown(supplierBreakdown)
        setPlatformBreakdown({ eBay: transformedListings.length })
        
        // Apply zombie filtering
        const minDays = filterParams.analytics_period_days || filterParams.min_days || 7
        const maxSales = filterParams.max_sales || 0
        const maxWatches = filterParams.max_watches || filterParams.max_watch_count || 0
        const maxImpressions = filterParams.max_impressions || 100
        const maxViews = filterParams.max_views || 10
        
        console.log('🔍 Filtering parameters:', { minDays, maxSales, maxWatches, maxImpressions, maxViews })
        console.log(`📊 Before filtering: ${transformedListings.length} listings`)
        
        const filteredZombies = transformedListings.filter(item => {
          // Listing period filter: only include items listed for minDays or more (exclude items less than 7 days)
          // Example: if minDays=7, only include items with days_listed >= 7 (exclude items less than 7 days)
          if ((item.days_listed || 0) < minDays) return false
          // Sales filter: only items with maxSales or less (e.g., 0 or less)
          if ((item.total_sales || item.quantity_sold || 0) > maxSales) return false
          // Watch filter: only items with maxWatches or less (e.g., 0 or less)
          if ((item.watch_count || 0) > maxWatches) return false
          // Impressions filter: only items with maxImpressions or less (e.g., 100 or less)
          if ((item.impressions || 0) > maxImpressions) return false
          // Views filter: only items with maxViews or less (e.g., 10 or less)
          if ((item.view_count || item.views || 0) > maxViews) return false
          
          return true
        }).map(item => ({ ...item, is_zombie: true }))
        
        console.log(`🧟 After filtering: ${filteredZombies.length} zombies found`)
        
        console.log(`🧟 Found ${filteredZombies.length} zombie listings`)
        
        // Zombie supplier breakdown
        const zombieSupplierBreakdown = {}
        filteredZombies.forEach(item => {
          zombieSupplierBreakdown[item.supplier] = (zombieSupplierBreakdown[item.supplier] || 0) + 1
        })
        setZombieBreakdown(zombieSupplierBreakdown)
        
        setZombies(filteredZombies)
        setTotalZombies(filteredZombies.length)
        
        // Update all listings (refresh cache)
        setAllListings(transformedListings)
        setTotalListings(transformedListings.length)
        
        // Supplier breakdown already calculated above (line 782)
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
          console.log('✅ Data cache saved successfully')
        } catch (cacheErr) {
          console.warn('Cache save failed:', cacheErr)
        }
        
        setError(null)
        
      } catch (ebayErr) {
        console.error('eBay API Error:', ebayErr)
        
        // eBay not connected - guide user to connect
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
          
          // Refresh credit balance
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
  const handleStoreConnection = (connected, forceLoad = false) => {
    const wasConnected = isStoreConnected
    
    // 🔥 상태가 동일하고 강제 로드가 아니면 아무것도 하지 않음 (불필요한 재실행 방지)
    if (connected === wasConnected && !forceLoad) {
      console.log('⏭️ No eBay connection status change - skipping:', { wasConnected, connected, forceLoad })
      return
    }
    
    setIsStoreConnected(connected)
    // 🔥 로그 최소화 - 상태 변경 시에만 출력 (반복 로그 방지)
    if (wasConnected !== connected || forceLoad) {
      console.log('🔄 eBay connection status changed:', { wasConnected, connected, forceLoad })
    }
    
    // 🔥 연결 해제 시 캐시 초기화
    if (!connected && wasConnected) {
      console.log('🗑️ Disconnected - clearing cache')
      try {
        localStorage.removeItem(CACHE_KEY)
        localStorage.removeItem(CACHE_TIMESTAMP_KEY)
        setAllListings([])
        setTotalListings(0)
        setZombies([])
        setTotalZombies(0)
        setViewMode('total')
        setShowFilter(false)
      } catch (err) {
        console.warn('캐시 초기화 실패:', err)
      }
      return
    }
    
    // 🔥 연결됨: 제품 로드는 useEffect에서 자동으로 처리됨
    // 여기서는 상태만 업데이트 (중복 실행 방지)
    if (connected && (!wasConnected || forceLoad)) {
      console.log('✅ eBay connected - status updated (listings will be auto-fetched in useEffect)', { wasConnected, forceLoad })
      if (DEMO_MODE) {
        setAllListings(DUMMY_ALL_LISTINGS)
        setTotalListings(DUMMY_ALL_LISTINGS.length)
        setViewMode('all')
        setShowFilter(true)
        listingsLoadedOnceRef.current = true
      } else {
        // 🔥 실제 API 모드에서는 useEffect가 자동으로 fetch하므로 여기서는 ref만 초기화
        listingsLoadedOnceRef.current = false // useEffect에서 fetch하도록 허용
      }
    }
  }

  const fetchAllListings = async (forceRefresh = false) => {
    // 🔥 중복 실행 방지: 이미 로딩 중이면 스킵
    if (loading && !forceRefresh) {
      console.log('⏭️ fetchAllListings already running - skipping', { loading, forceRefresh })
      return
    }
    
    try {
      // 🔥 데이터가 이미 있고 캐시가 유효하면 API 호출하지 않음 (로딩 상태도 설정하지 않음)
      if (!forceRefresh && allListings.length > 0) {
        try {
          const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)
          if (cachedTimestamp) {
            const cacheAge = Date.now() - parseInt(cachedTimestamp, 10)
            if (cacheAge < CACHE_DURATION) {
              console.log(`✅ Data already exists and cache is valid - skipping API call (queried ${Math.floor(cacheAge / 1000)} seconds ago)`)
              // 🔥 데이터가 있으면 무조건 뷰 모드를 'all'로 설정하여 제품 목록 표시
              if (viewMode !== 'all') {
                console.log('🔄 Existing data detected - setting view mode to "all"', { 
                  listingsCount: allListings.length,
                  currentViewMode: viewMode
                })
                setViewMode('all')
                setShowFilter(true)
              }
              return // 데이터가 이미 있고 캐시가 유효하면 API 호출하지 않음
            }
          }
        } catch (err) {
          console.warn('Cache check failed:', err)
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
              console.log(`✅ Using cached data (queried ${Math.floor(cacheAge / 1000)} seconds ago)`)
              const parsedData = JSON.parse(cachedData)
              const cachedListings = parsedData.listings || []
              // 🔥 데이터가 있으면 무조건 뷰 모드를 'all'로 설정 (setAllListings 전에 호출)
              if (cachedListings.length > 0) {
                setViewMode('all')
                setShowFilter(true)
                console.log('🔄 Cache data loaded - immediately switching to Active listings view', { 
                  listingsCount: cachedListings.length
                })
              }
              // 🔥 캐시 데이터 설정
              setAllListings(cachedListings)
              setTotalListings(parsedData.totalListings || 0)
              setTotalBreakdown(parsedData.totalBreakdown || {})
              setPlatformBreakdown(parsedData.platformBreakdown || { eBay: 0 })
              if (cachedListings.length > 0) {
                console.log('✅ View mode set to "all" after cache data load - products will be displayed')
              }
              setLoading(false)
              return
            } else {
              console.log(`⏰ Cache expired (${Math.floor(cacheAge / 1000)} seconds elapsed) - fetching new data`)
            }
          }
        } catch (cacheErr) {
          console.warn('Cache read failed, calling API:', cacheErr)
        }
      } else {
        console.log('🔄 Force refresh - ignoring cache')
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
        console.log(`[FETCH DONE] Received ${allListingsFromEbay.length} total listings from eBay`)
        
        // Transform listing data and detect suppliers
        const transformedListings = allListingsFromEbay.map((item, index) => {
          // Extract both supplier_name and supplier_id
          const supplierInfo = extractSupplierInfo(item.title, item.sku, item.image_url || item.picture_url || item.thumbnail_url)
          
          return {
            id: item.item_id || `ebay-${index}`,
            item_id: item.item_id || item.ebay_item_id,
            ebay_item_id: item.ebay_item_id || item.item_id,
            sell_item_id: item.sell_item_id || item.item_id || item.ebay_item_id, // Explicitly include Sell Item ID
            title: item.title,
            price: item.price,
            sku: item.sku,
            supplier: supplierInfo.supplier_name,
            supplier_name: supplierInfo.supplier_name,
            supplier_id: supplierInfo.supplier_id, // Add supplier_id
            source: item.source || supplierInfo.supplier_name, // Add source field (prefer backend response, fallback to supplier_name)
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
        
        console.log('📦 Starting product data setup', { 
          count: transformedListings.length,
          firstItem: transformedListings[0]?.title 
        })
        
        // Set view mode immediately along with data setup (synchronously)
        if (transformedListings.length > 0) {
          // If data exists, always set view mode to 'all' (called before setAllListings)
          setViewMode('all')
          setShowFilter(true)
          setAllListings(transformedListings)
          setTotalListings(transformedListings.length)
          setLastFetchAt(Date.now()) // Debug HUD: Record fetch success time
          
          // [FETCH DONE] State synchronization check log
          console.log('[FETCH DONE] listings length:', transformedListings.length)
          console.log('[FETCH DONE] Before setAllListings call:', {
            allListingsLength: allListings.length,
            totalListings: totalListings,
            viewMode: viewMode,
            isStoreConnected: isStoreConnected
          })
          
          // Check again in next render cycle
          setTimeout(() => {
            console.log('[RENDER CHECK] State synchronization check:', {
              allListingsLength: allListings.length,
              totalListings: totalListings,
              viewMode: viewMode,
              isStoreConnected: isStoreConnected,
              shouldShowProducts: viewMode === 'all' || (isStoreConnected && (allListings.length > 0 || totalListings > 0))
            })
          }, 100)
        } else {
          setAllListings(transformedListings)
          setTotalListings(transformedListings.length)
          console.warn('⚠️ transformedListings is empty')
        }
        
        // Calculate supplier breakdown
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
          console.log('✅ Data cache saved successfully')
        } catch (cacheErr) {
          console.warn('Cache save failed:', cacheErr)
        }
        
        // 🔥 뷰 모드는 이미 위에서 설정했으므로 여기서는 로그만 출력
        if (transformedListings.length > 0) {
          console.log('✅ fetchAllListings 완료 - 제품 목록 표시 예정', { 
            listingsCount: transformedListings.length
          })
        }
        
        setError(null)
        setLoading(false) // 🔥 로딩 상태 해제
        
      } catch (ebayErr) {
        console.error('eBay API Error:', ebayErr)
        
        // eBay 연결 안됨 (401만 연결 해제로 처리)
        if (ebayErr.response?.status === 401) {
          setError('eBay not connected. Please connect your eBay account first.')
          setTotalListings(0)
          setAllListings([])
        } else {
          // 🔥 네트워크 에러나 기타 에러는 기존 데이터 유지
          console.log('⚠️ eBay API 에러 - 기존 데이터 유지', {
            error: ebayErr.message,
            status: ebayErr.response?.status,
            hasExistingData: allListings.length > 0
          })
          // 기존 데이터는 유지하고 에러만 표시
          if (allListings.length === 0) {
            setError('Failed to fetch listings. Please try again.')
          }
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
            const fallbackListings = listingsResponse.data.listings || []
            // 🔥 Fallback 데이터 설정과 동시에 뷰 모드도 즉시 설정
            setAllListings(fallbackListings)
            setTotalListings(fallbackListings.length)
            // 🔥 데이터가 있으면 무조건 뷰 모드를 'all'로 설정
            if (fallbackListings.length > 0) {
              console.log('🔄 Fallback 데이터 로드 완료 - Active 리스팅 뷰로 즉시 전환', {
                listingsCount: fallbackListings.length
              })
              setViewMode('all')
              setShowFilter(true)
              console.log('✅ Fallback 데이터 로드 후 뷰 모드 "all"로 설정 완료 - 제품 표시 예정')
            }
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

  // 🔥 All Listings View를 여는 함수 (Active 카드 클릭 시 사용, 자동 실행 시에도 사용)
  const openAllListingsView = () => {
    console.log('[openAllListingsView] All Listings 뷰 열기')
    setViewMode('all')
    setShowFilter(true) // 필터 패널 열기
    setSelectedIds([]) // 선택 초기화
    
    // 데이터가 없으면 fetch
    if (allListings.length === 0 && isStoreConnected) {
      console.log('[openAllListingsView] 데이터가 없어서 fetchAllListings 호출')
      fetchAllListings(false)
    }
  }

  const handleViewModeChange = (mode) => {
    setViewMode(mode)
    setSelectedIds([]) // Reset selection when switching views
    
    // Close filter when switching to non-zombie views (단, 'all' 모드로 전환할 때는 필터 유지)
    if (mode === 'queue' || mode === 'history') {
      setShowFilter(false)
    }
    // 'all' 모드로 전환할 때는 필터를 닫지 않음 (연결 후 자동 표시 시 필터가 열려있어야 함)
    
    if (mode === 'total') {
      // Statistical view - no data fetching needed
      return
    } else if (mode === 'all') {
      // 🔥 'all' 모드로 전환 시 openAllListingsView와 동일한 로직 적용
      setShowFilter(true)
      // 데이터가 없으면 fetch
      if (allListings.length === 0 && isStoreConnected) {
        fetchAllListings(false)
      }
      return
    } else if (mode === 'zombies') {
      // 🔥 좀비 카드 클릭 시: 이미 필터링된 결과가 있으면 그대로 사용 (재필터링하지 않음)
      // 필터링된 결과가 없으면 현재 필터로 다시 필터링 (로컬 필터링만, 크레딧 차감 없음)
      if (zombies.length === 0 && allListings.length > 0) {
        console.log('🔄 좀비 카드 클릭 - 로컬 필터링 실행 (크레딧 차감 없음)')
        fetchZombies(filters, false) // 로컬 필터링만 수행
      } else {
        console.log(`✅ 좀비 카드 클릭 - 이미 필터링된 결과 사용 (${zombies.length}개)`)
      }
      return
    } else if (mode === 'all') {
      // 🔥 Active 카드 클릭 시 openAllListingsView 사용
      openAllListingsView()
      return
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
    console.log('📋 받은 필터:', newFilters)
    console.log('📊 현재 상태:', { totalListings, allListingsLength: allListings.length })
    
    setFilters(newFilters)
    setSelectedIds([]) // Reset selection when filters change
    
    // 🔥 Active 카드에서 데이터가 없으면 먼저 조회
    let currentTotalListings = totalListings || allListings.length
    if (currentTotalListings === 0) {
      console.log('⚠️ Active 카드 데이터가 없음 - 먼저 조회 필요')
      try {
        setLoading(true)
        const response = await axios.get(`${API_BASE_URL}/api/ebay/listings/active`, {
          params: {
            user_id: CURRENT_USER_ID,
            page: 1,
            entries_per_page: 200
          }
        })
        
        if (response.data.success) {
          const listings = response.data.listings || []
          currentTotalListings = listings.length
          console.log(`✅ Active 카드 데이터 조회 완료: ${currentTotalListings}개 리스팅`)
        }
      } catch (err) {
        console.error('❌ Active 카드 데이터 조회 실패:', err)
      } finally {
        setLoading(false)
      }
    }
    
    // 🔥 DB에서 전체 리스팅 수 확인 (크레딧 차감 기준)
    if (currentTotalListings === 0) {
      try {
        const dbResponse = await axios.get(`${API_BASE_URL}/api/listings`, {
          params: {
            user_id: CURRENT_USER_ID,
            skip: 0,
            limit: 1
          }
        })
        // total_count가 응답에 있으면 사용, 없으면 listings 배열 길이 사용
        currentTotalListings = dbResponse.data?.total_count || dbResponse.data?.listings?.length || 0
        console.log(`✅ DB에서 전체 리스팅 수 확인: ${currentTotalListings}개`)
      } catch (err) {
        console.warn('⚠️ DB 리스팅 수 확인 실패, 기본값 사용:', err)
        currentTotalListings = 12 // 기본값 (최소 1 크레딧 차감)
      }
    }
    
    // 🔥 "Find Low-Performing SKUs" 버튼 클릭 시 항상 크레딧 차감 팝업 표시
    // Active 카드에서 이미 조회된 데이터를 사용하더라도 분석 시에는 크레딧 차감 필요
    try {
      console.log('💰 크레딧 잔액 확인 시작...')
      // 크레딧 잔액 확인
      const creditsResponse = await axios.get(`${API_BASE_URL}/api/credits`, {
        params: { user_id: CURRENT_USER_ID },
        timeout: 30000 // 10초 → 30초로 증가
      })
      
      console.log('💰 크레딧 응답:', creditsResponse.data)
      
      const availableCredits = creditsResponse.data?.available_credits || 0
      // 🔥 전체 스캔하는 제품 수만큼 크레딧 차감
      const requiredCredits = Math.max(1, currentTotalListings) // 최소 1 크레딧
      
      console.log(`💰 크레딧 정보: 보유=${availableCredits}, 필요=${requiredCredits} (전체 ${currentTotalListings}개 리스팅 스캔)`)
      
      // 크레딧 부족 확인
      if (availableCredits < requiredCredits) {
        console.log('⚠️ 크레딧 부족 - 구매 안내 팝업 표시')
        const userMessage = `크레딧이 부족합니다.\n\n필요한 크레딧: ${requiredCredits}\n보유 크레딧: ${availableCredits}\n\n크레딧을 구매하시겠습니까?`
        
        if (window.confirm(userMessage)) {
          window.location.href = '/#pricing'
        }
        return
      }
      
      // 크레딧 충분 - 확인 팝업 표시
      console.log('✅ 크레딧 충분 - 확인 팝업 표시')
      const confirmMessage = `분석을 시작하시겠습니까?\n\n필요한 크레딧: ${requiredCredits} (전체 ${currentTotalListings}개 리스팅 스캔)\n보유 크레딧: ${availableCredits}\n차감 후 잔액: ${availableCredits - requiredCredits}`
      
      console.log('💬 확인 팝업 메시지:', confirmMessage)
      const userConfirmed = window.confirm(confirmMessage)
      console.log(`👤 사용자 확인: ${userConfirmed}`)
      
      if (userConfirmed) {
        // 사용자 확인 후 필터링 진행 (크레딧 차감 포함, 백엔드 API 호출)
        console.log('🚀 사용자 확인 완료 - 분석 시작')
        await fetchZombies(newFilters, true)
        setViewMode('zombies')
      } else {
        console.log('❌ 사용자 취소 - 분석 중단')
      }
    } catch (err) {
      console.error('❌ 크레딧 확인 실패:', err)
      console.error('❌ 에러 상세:', err.response?.data || err.message)
      
      // 크레딧 확인 실패 시에도 확인 팝업 표시
      const errorMessage = err.response?.data?.detail || err.message || '알 수 없는 오류'
      const userMessage = `크레딧 확인에 실패했습니다.\n\n에러: ${errorMessage}\n\n계속 진행하시겠습니까? (백엔드에서 크레딧 차감이 시도됩니다)`
      
      if (window.confirm(userMessage)) {
        console.log('🚀 사용자 확인 - 에러 발생했지만 계속 진행')
        await fetchZombies(newFilters, true)
        setViewMode('zombies')
      } else {
        console.log('❌ 사용자 취소 - 에러 발생으로 중단')
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
      
      // 🔥 불필요한 연결 상태 재확인 제거
      // 이미 setIsStoreConnected(true)로 연결 상태가 업데이트되었고,
      // handleStoreConnection 콜백이 호출되어 추가 확인 불필요
      
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

  // Initial Load - Check API health and fetch data (한 번만 실행)
  useEffect(() => {
    const initializeDashboard = async () => {
      // Step 1: Check API Health (초기 로드 시 한 번만)
      try {
        const isHealthy = await checkApiHealth()
        if (isHealthy) {
          // Step 2: Fetch user credits
          await fetchUserCredits()
          
          // Step 3: Fetch history only (listings require store connection)
          fetchHistory().catch(err => {
            console.error('History fetch error on mount:', err)
          })
        }
      } catch (err) {
        console.warn('API Health Check failed (non-critical):', err)
        // Health check 실패해도 크레딧과 히스토리는 로드 시도
        await fetchUserCredits()
        fetchHistory().catch(err => {
          console.error('History fetch error on mount:', err)
        })
      }
      
      // 🔥 초기 로드 시 캐시된 데이터가 있으면 자동으로 제품 표시
      try {
        const cachedData = localStorage.getItem(CACHE_KEY)
        const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)
        
        if (cachedData && cachedTimestamp) {
          const cacheAge = Date.now() - parseInt(cachedTimestamp, 10)
          
          if (cacheAge < CACHE_DURATION) {
            console.log('🔄 초기 로드 - 캐시된 데이터 발견, 제품 자동 표시')
            const parsedData = JSON.parse(cachedData)
            if (parsedData.listings?.length > 0) {
              const cachedListings = parsedData.listings || []
              // 🔥 초기 로드 시 데이터 설정과 동시에 뷰 모드도 즉시 설정
              setAllListings(cachedListings)
              setTotalListings(parsedData.totalListings || 0)
              setTotalBreakdown(parsedData.totalBreakdown || {})
              setPlatformBreakdown(parsedData.platformBreakdown || { eBay: 0 })
              // 🔥 데이터가 있으면 무조건 뷰 모드를 'all'로 설정
              setViewMode('all')
              setShowFilter(true)
              console.log('✅ 캐시된 제품 자동 표시 완료', { 
                count: cachedListings.length,
                viewMode: 'all (강제 설정)',
                willShowProducts: true
              })
            }
          }
        }
      } catch (cacheErr) {
        console.warn('초기 로드 캐시 확인 실패:', cacheErr)
      }
      
      // Note: fetchAllListings() is called when store is connected via handleStoreConnection
      // 캐시가 있으면 자동으로 사용됨
    }
    
    initializeDashboard()
    
    // 🔥 주기적인 Health Check 제거 - 불필요한 API 호출 방지
    // 토큰 갱신은 백그라운드 워커가 처리하므로 프론트엔드에서 주기적 확인 불필요
  }, [])
  
  // Fetch data when store is connected (handled by handleStoreConnection callback)
  // This useEffect is removed - connection is managed via onConnectionChange prop

  // 🔥 allListings에 데이터가 있고 연결되어 있으면 무조건 'all'로 전환 (강제)
  // 주의: 이 useEffect는 openAllListingsView()와 중복될 수 있으므로, 
  // openAllListingsView()가 먼저 실행되도록 순서 조정 필요
  useEffect(() => {
    if (allListings.length > 0 && isStoreConnected) {
      // 🔥 데이터가 있고 연결되어 있으면 무조건 'all' 뷰 모드로 전환 (zombies, queue 제외)
      // 단, 이미 openAllListingsView()가 실행되었으면 스킵
      if (viewMode !== 'all' && viewMode !== 'zombies' && viewMode !== 'queue' && !openedAllListingsOnceRef.current) {
        console.log('🔄 [강제] allListings 데이터 + 연결 감지 - 뷰 모드를 "all"로 즉시 전환', {
          listingsCount: allListings.length,
          currentViewMode: viewMode,
          isStoreConnected,
          firstItem: allListings[0]?.title
        })
        // openAllListingsView()와 동일한 로직 사용
        openAllListingsView()
      }
    }
  }, [allListings.length, isStoreConnected, viewMode])

  // 🔥 eBay 연결 상태를 감지하여 자동으로 listings fetch
  useEffect(() => {
    // 🔥 StrictMode 중복 호출 방지
    if (listingsLoadedOnceRef.current && isStoreConnected) {
      console.log('⏭️ [GUARD] listingsLoadedOnceRef가 이미 true - 스킵')
      return
    }
    
    if (isStoreConnected) {
      console.log('[CONNECTION] eBay 연결 감지 - 자동으로 listings fetch 시작', {
        isStoreConnected,
        listingsLoadedOnce: listingsLoadedOnceRef.current,
        currentAllListingsLength: allListings.length,
        currentTotalListings: totalListings,
        currentViewMode: viewMode
      })
      
      // 🔥 ref를 먼저 설정하여 중복 실행 방지 (StrictMode 대응)
      listingsLoadedOnceRef.current = true
      
      // 🔥 뷰 모드를 먼저 'all'로 설정하여 제품 목록이 자동으로 표시되도록 함
      setViewMode('all')
      setShowFilter(true)
      
      // Active listings 자동 조회
      fetchAllListings(false).then(() => {
        console.log('[CONNECTION] eBay 연결 후 자동 listings fetch 완료', {
          allListingsLength: allListings.length,
          totalListings: totalListings,
          viewMode: viewMode
        })
      }).catch((err) => {
        console.error('[CONNECTION] eBay 연결 후 자동 listings fetch 실패:', err)
        listingsLoadedOnceRef.current = false // 실패 시 재시도 가능하도록
      })
    } else {
      // 연결 해제 시 ref 초기화
      if (listingsLoadedOnceRef.current) {
        listingsLoadedOnceRef.current = false
        console.log('[CONNECTION] eBay 연결 해제 - listingsLoadedOnceRef 초기화')
      }
    }
  }, [isStoreConnected])

  // Handle URL query param for view mode
  useEffect(() => {
    // 🔥 guard: listingsLength > 0 이면 초기화 effect가 viewMode를 변경하지 못하게 함
    if (allListings.length > 0 || totalListings > 0) {
      console.log('[URL PARAM] listings가 있으므로 viewMode 변경 스킵', {
        viewParam,
        allListingsLength: allListings.length,
        totalListings: totalListings,
        currentViewMode: viewMode
      })
      return
    }
    
    if (viewParam === 'history') {
      setViewMode('history')
      fetchHistory()
    }
  }, [viewParam, allListings.length, totalListings, viewMode])

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
          timeout: 30000 // 10초 → 30초로 증가
        })
        // Refresh total deleted count
        const historyResponse = await axios.get(`${API_BASE_URL}/api/history`, {
          params: { skip: 0, limit: 1 },
          timeout: 30000 // 10초 → 30초로 증가
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
      // source 필드가 있으면 사용, 없으면 supplier_name 또는 supplier 사용 (안전하게 처리)
      const getSource = (item) => {
        if (!item) return "unknown"
        return item.source || item.supplier_name || item.supplier || "unknown"
      }
      // source 변수 안전하게 정의 및 유효성 검사
      let source = 'all'
      if (items && items.length > 0) {
        const sourceValue = getSource(items[0])
        if (sourceValue && typeof sourceValue === 'string') {
          source = sourceValue.toLowerCase().replace(/\s+/g, '_')
        }
      }
      
      // source가 유효한지 확인 후 사용
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
          timeout: 30000 // 10초 → 30초로 증가
        })
        // Refresh total deleted count
        const historyResponse = await axios.get(`${API_BASE_URL}/api/history`, {
          params: { skip: 0, limit: 1 },
          timeout: 30000 // 10초 → 30초로 증가
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
      {/* 🔥 Debug HUD - 화면에 직접 표시 (임시) */}
      {(() => {
        const forcedLen = Array.isArray(allListings) ? allListings.length : 0
        const ebayConnected = isStoreConnected
        return (
          <pre style={{
            position: 'fixed',
            bottom: 12,
            right: 12,
            zIndex: 9999,
            background: '#000',
            color: '#0f0',
            padding: 12,
            fontSize: 12,
            border: '1px solid #0f0',
            borderRadius: 4,
            maxWidth: 350,
            overflow: 'auto',
            maxHeight: 250
          }}>
            {JSON.stringify({
              forcedLen: forcedLen,
              ebayConnected: ebayConnected,
              viewMode: viewMode,
              selectedCard: 'N/A', // selectedCard가 없으면 N/A
              listingsLoading: loading,
              listingsLength: allListings.length,
              totalListings: totalListings,
              lastFetchAt: lastFetchAt ? new Date(lastFetchAt).toLocaleTimeString() : null,
              shouldRenderTable: ebayConnected && forcedLen > 0
            }, null, 2)}
          </pre>
        )
      })()}
      
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

        {/* 🔥 FORCE 렌더: ebayConnected && forcedLen > 0 이면 Ready to Analyze 완전히 숨김 */}
        {(() => {
          const forcedLen = Array.isArray(allListings) ? allListings.length : 0
          const ebayConnected = isStoreConnected
          
          console.log('[READY TO ANALYZE CHECK]', {
            ebayConnected,
            forcedLen,
            viewMode,
            shouldHide: ebayConnected && forcedLen > 0
          })
          
          // 🔥 FORCE 렌더 조건: ebayConnected && forcedLen > 0 이면 Ready to Analyze 완전히 숨김
          if (ebayConnected && forcedLen > 0) {
            return null // Ready to Analyze 숨김
          }
          
          // 🔥 ebayConnected가 false이거나 forcedLen이 0이면 Ready to Analyze 표시
          return (
            <div className="bg-zinc-900 dark:bg-zinc-900 border border-zinc-800 dark:border-zinc-800 rounded-lg p-8 mt-8 text-center">
              <p className="text-lg text-zinc-300 dark:text-zinc-300 mb-2">
                📊 <strong className="text-white">Ready to Analyze</strong>
              </p>
              <p className="text-sm text-zinc-400 dark:text-zinc-400 mb-4">
                {!ebayConnected 
                  ? "Connect your eBay account to start analyzing your listings."
                  : "No listings found. Please sync from eBay or check your connection."
                }
              </p>
            </div>
          )
        })()}
        
        {/* 🔥 권장 렌더 분기 2: listingsLoading -> Skeleton/Loading */}
        {/* (loading 상태는 아래 테이블 영역에서 처리) */}
        
        {/* 🔥 권장 렌더 분기 3: listings.length === 0 -> Empty state */}
        {/* (empty 상태는 아래 테이블 영역에서 처리) */}
        
        {/* 🔥 권장 렌더 분기 4: else -> ListingsTable/ListingsGrid 항상 렌더 */}

        {/* History View - Full Page */}
        {viewMode === 'history' && (
          <HistoryView 
            historyLogs={historyLogs}
            loading={loading}
            onBack={() => setViewMode('all')}
          />
        )}

        {/* 🔥 FORCE 렌더링: ebayConnected && forcedLen > 0 이면 무조건 렌더 (viewMode 무관, history만 제외) */}
        {(() => {
          const forcedLen = Array.isArray(allListings) ? allListings.length : 0
          const ebayConnected = isStoreConnected
          const shouldRender = ebayConnected && forcedLen > 0 && viewMode !== 'history'
          
          console.log('[MAIN RENDER] 메인 렌더 조건:', {
            ebayConnected,
            forcedLen,
            viewMode,
            shouldRender,
            reason: !ebayConnected ? 'not connected' : forcedLen === 0 ? 'no data' : viewMode === 'history' ? 'history mode' : 'should render'
          })
          
          return shouldRender
        })() && (
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
              {/* 🔥 eBay 연결되고 데이터가 있으면 항상 표시 (viewMode 무관) */}
              {(isStoreConnected && allListings.length > 0) && (
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
                  // 🔥 최대한 단순화: isStoreConnected && allListings.length > 0 이면 무조건 테이블 렌더 (viewMode 무관)
                  const ebayConnected = isStoreConnected
                  const hasData = Array.isArray(allListings) && allListings.length > 0
                  
                  console.log('[RENDER CHECK] 최종 체크:', {
                    ebayConnected,
                    hasData,
                    allListingsLength: allListings.length,
                    viewMode,
                    shouldRenderTable: ebayConnected && hasData
                  })
                  
                  // 🔥 강제 렌더링: ebayConnected && hasData 이면 무조건 테이블 렌더 (viewMode 무관)
                  if (ebayConnected && hasData) {
                    // viewMode에 따라 데이터 선택 (zombies 모드가 아니면 allListings 사용)
                    const tableData = (viewMode === 'zombies' && zombies.length > 0) ? zombies : allListings
                    
                    return (
                      <div className="p-6">
                        {/* FORCE_RENDER 디버그 표시 */}
                        <div style={{ marginBottom: 12, color: '#0f0', fontSize: 12, padding: 8, background: '#000', borderRadius: 4, border: '1px solid #0f0' }}>
                          ✅ RENDERED: ebayConnected={String(ebayConnected)} dataLength={tableData.length} viewMode={viewMode}
                        </div>
                        
                        {/* Filter Summary Banner - Only show for zombies view */}
                        {viewMode === 'zombies' && tableData.length > 0 && (
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
                  
                  // 🔥 ebayConnected && hasData가 아니면 메시지 표시
                  console.log('[RENDER CHECK] 테이블 렌더 스킵:', {
                    ebayConnected,
                    hasData,
                    allListingsLength: allListings.length,
                    reason: !ebayConnected ? 'not connected' : !hasData ? 'no data' : 'unknown'
                  })
                  
                  return (
                    <div className="p-8 text-center text-slate-500">
                      {!ebayConnected 
                        ? "Connect your eBay account to start analyzing your listings."
                        : !hasData
                          ? "No listings found. Please sync from eBay or check your connection."
                          : "Loading listings..."
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
    </div>
  )
}

export default Dashboard

