import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, TrendingDown, Ban, DollarSign, Check, CheckCircle, Zap, TrendingUp, Clock, Puzzle, Table, ChevronDown, User, LayoutDashboard, Settings, LogOut, BarChart3, Target, Users, Star, RefreshCw, Filter, Download } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/card'
import { Button } from './ui/button'

// Lemon Squeezy Store URL
const LEMON_SQUEEZY_STORE = import.meta.env.VITE_LEMON_SQUEEZY_STORE || 'https://optlisting.lemonsqueezy.com'

// Professional Plan - $120/month
// CRITICAL: Use numeric IDs only (no string slugs) to avoid 404 errors
// Product ID: 795931, Variant ID: 1255285
const PROFESSIONAL_PLAN = {
  id: 'professional',
  name: 'Professional Plan',
  price: 120,
  billing: 'month',
  // Numeric IDs with fallback to hardcoded values (prevents 404 errors)
  // Environment variables override, but fallback ensures checkout always works
  product_id: import.meta.env.VITE_LEMON_SQUEEZY_PRODUCT_ID || '795931',
  variant_id: import.meta.env.VITE_LEMON_SQUEEZY_VARIANT_ID || '1255285',
  features: [
    'Unlimited eBay listings analysis',
    'Advanced zombie detection algorithms',
    'CSV export with supplier matching',
    'Real-time sync with eBay API',
    'Priority support',
    'US market optimization',
    'Asynchronous processing queue',
    'Account health protection',
    'Automated inventory cleaning'
  ]
}

function LandingPage() {
  const { user, isAuthenticated, signOut } = useAuth()
  const navigate = useNavigate()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isSubscribing, setIsSubscribing] = useState(false)
  const profileRef = useRef(null)
  
  // Generate Lemon Squeezy Checkout link for $120/month Professional subscription
  // Format: https://optlisting.lemonsqueezy.com/checkout/buy/{product_id}?checkout[variant_id]={variant_id}&checkout[custom][user_id]={user_id}&checkout[custom][email]={email}
  const generateCheckoutUrl = () => {
    const userId = user?.id || user?.user_metadata?.user_id
    const userEmail = user?.email || ''
    
    if (!userId) {
      console.error('❌ [CHECKOUT] User not logged in')
      return null
    }
    
    // CRITICAL: Force numeric IDs with fallback to prevent 404 errors
    // Always use numeric product_id (795931) in URL path, NOT a string slug
    let productId = String(PROFESSIONAL_PLAN.product_id || '795931').trim()
    let variantId = String(PROFESSIONAL_PLAN.variant_id || '1255285').trim()
    
    // Verify IDs are numeric (not string slugs) - use fallback if invalid
    if (isNaN(Number(productId)) || productId === '') {
      console.warn('⚠️ [CHECKOUT] Product ID is not numeric, using fallback: 795931')
      productId = '795931'
    }
    if (isNaN(Number(variantId)) || variantId === '') {
      console.warn('⚠️ [CHECKOUT] Variant ID is not numeric, using fallback: 1255285')
      variantId = '1255285'
    }
    
    // Lemon Squeezy hosted checkout URL format (direct redirect, bypasses overlay)
    // CRITICAL: Use /buy/{product_id} instead of /checkout/buy/{product_id} to avoid 404
    // Final URL format: https://optlisting.lemonsqueezy.com/buy/795931?checkout[variant_id]=1255285&checkout[custom][user_id]=...
    // Documentation: https://docs.lemonsqueezy.com/help/checkout/checkout-custom-fields
    
    // Use /buy/{product_id} for hosted checkout (direct redirect, no overlay)
    const baseUrl = `${LEMON_SQUEEZY_STORE}/buy/${productId}`
    const params = new URLSearchParams({
      'checkout[variant_id]': variantId,
      'checkout[custom][user_id]': userId,
      'test_mode': 'true', // Enable test mode for hosted checkout
    })
    
    // Add email if available for webhook synchronization
    if (userEmail) {
      params.append('checkout[custom][email]', userEmail)
    }
    
    const checkoutUrl = `${baseUrl}?${params.toString()}`
    console.log('🔗 [CHECKOUT] Generated checkout URL:', checkoutUrl)
    console.log('   Product ID (numeric):', productId)
    console.log('   Variant ID (numeric):', variantId)
    console.log('   User ID:', userId)
    console.log('   Email:', userEmail || 'not provided')
    console.log('   URL Structure:', `buy/${productId}?checkout[variant_id]=${variantId}`)
    return checkoutUrl
  }
  
  const handleSubscribe = () => {
    if (!user?.id) {
      console.error('❌ [CHECKOUT] Cannot subscribe: User not logged in')
      // Redirect to login or show login modal
      navigate('/login')
      return
    }
    
    // IDs are always available due to fallback values (795931, 1255285)
    // No need to check - fallback ensures checkout always works
    
    setIsSubscribing(true)
    const checkoutUrl = generateCheckoutUrl()
    
    if (!checkoutUrl) {
      // This should only happen if user_id extraction failed (already logged)
      console.error('❌ [CHECKOUT] Failed to generate checkout URL')
      setIsSubscribing(false)
      return
    }
    
    // Open Lemon Squeezy checkout in new window
    console.log('🚀 [CHECKOUT] Opening Lemon Squeezy checkout:', checkoutUrl)
    window.open(checkoutUrl, '_blank')
    setIsSubscribing(false)
  }

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    setIsProfileOpen(false)
  }

  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  }

  const staggerContainer = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  return (
    <div className="min-h-screen bg-black dark:bg-black font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-black/60 dark:bg-black/60 backdrop-blur-xl border-b border-zinc-800 dark:border-zinc-800 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-lg shadow-blue-500/20">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white dark:text-white">OptListing</span>
          </div>
          <div className="flex items-center space-x-6">
            <a href="#features" className="text-zinc-300 dark:text-zinc-300 hover:text-white dark:hover:text-white font-medium transition-colors">Features</a>
            <a href="#pricing" className="text-zinc-300 dark:text-zinc-300 hover:text-white dark:hover:text-white font-medium transition-colors">Pricing</a>
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="text-zinc-300 dark:text-zinc-300 hover:text-white dark:hover:text-white font-medium transition-colors">Dashboard</Link>
                <div className="relative" ref={profileRef}>
                  <button 
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-all"
                  >
                    {user?.user_metadata?.avatar_url ? (
                      <img src={user.user_metadata.avatar_url} alt="" className="w-7 h-7 rounded-full" />
                    ) : (
                      <div className="w-7 h-7 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <span className="text-white font-medium text-sm">
                      {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
                  </button>

                {/* Profile Dropdown */}
                {isProfileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-[9999] overflow-hidden">
                    {/* User Info */}
                    <div className="p-3 border-b border-zinc-800">
                      <p className="text-sm font-semibold text-white truncate">
                        {user?.user_metadata?.full_name || 'User'}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                      <Link
                        to="/settings"
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </Link>
                    </div>

                    {/* Logout */}
                    <div className="border-t border-zinc-800 py-1">
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
              </>
            ) : (
              <Link to="/login" className="text-zinc-300 dark:text-zinc-300 hover:text-white dark:hover:text-white font-medium transition-colors">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden bg-black dark:bg-black">
        {/* Background Grid Pattern - Enhanced */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f00a_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f00a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
        
        {/* Radial Gradient Glow - Soft Blue/Purple Glow */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] rounded-full blur-3xl pointer-events-none opacity-50"
          style={{
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, rgba(99, 102, 241, 0.15) 25%, rgba(37, 99, 235, 0.1) 50%, transparent 70%)'
          }}
        ></div>
        
        <div className="container mx-auto max-w-6xl relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight mb-6 leading-tight font-sans">
              <span className="text-white dark:text-white">'Zero Sale' </span>
              <span className="text-white dark:text-white">Cleaner.</span>
            </h1>
            <h2 className="text-xl md:text-2xl text-zinc-400 dark:text-zinc-400 font-normal mb-10 max-w-3xl mx-auto leading-relaxed font-sans">
              Instantly generate a CSV of Low-Performing Listings
            </h2>
            
            {/* CTA Button - Conditional rendering based on login status */}
            {isAuthenticated ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold rounded-xl text-lg transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transform hover:scale-105"
                >
                  <LayoutDashboard className="w-5 h-5" />
                  Go to Dashboard
                </Link>
              </motion.div>
            ) : (
              // Do not display button if not logged in (completely removed per previous request)
              null
            )}
          </motion.div>

          {/* Dashboard Screenshot */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="mt-20"
          >
            <div className="relative">
              {/* Glow effect behind the image */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-cyan-500/20 rounded-2xl blur-3xl -z-10 scale-105"></div>
              
              {/* Browser Frame */}
              <div className="bg-zinc-900 rounded-2xl border border-zinc-700/50 shadow-2xl shadow-black/50 overflow-hidden relative">
                {/* Browser Top Bar */}
                <div className="bg-zinc-800/80 px-4 py-3 flex items-center gap-3 border-b border-zinc-700/50">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="bg-zinc-900/80 rounded-lg px-4 py-1.5 text-xs text-zinc-400 flex items-center gap-2">
                      <span className="text-green-400">🔒</span>
                      <span>optlisting.com/dashboard</span>
                    </div>
                  </div>
                </div>
                
                {/* Dashboard Screenshot */}
                <div className="relative">
                  <img 
                    src="/main-screenshot.png" 
                    alt="OptListing Dashboard - Zombie Listing Finder" 
                    className="w-full h-auto"
                    loading="lazy"
                  />
                  
                  {/* Privacy Blur Overlays - Top Header (User name, email) */}
                  <div className="absolute top-[2%] right-[8%] w-[120px] h-[24px] bg-black/60 backdrop-blur-md rounded border border-zinc-700/50"></div>
                  
                  {/* Privacy Blur Overlays - Plan Banner */}
                  <div className="absolute top-[6%] right-[15%] w-[150px] h-[20px] bg-black/60 backdrop-blur-md rounded border border-zinc-700/50"></div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4 bg-black dark:bg-black" id="features">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white dark:text-white mb-4 font-sans">
              Features
            </h2>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-10"
          >
            <motion.div
              variants={fadeInUp}
              className="bg-zinc-900 dark:bg-zinc-900 p-10 rounded-2xl border border-zinc-800 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-16 h-16 bg-zinc-800 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                <RefreshCw className="h-8 w-8 text-white dark:text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white dark:text-white mb-4 font-sans">Market Listings Auto-Sync</h3>
              <p className="text-zinc-400 dark:text-zinc-400 text-lg leading-relaxed font-sans">
                Automatically fetch and sync your marketplace listings in real-time.
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="bg-zinc-900 dark:bg-zinc-900 p-10 rounded-2xl border border-zinc-800 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-16 h-16 bg-zinc-800 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                <Filter className="h-8 w-8 text-white dark:text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white dark:text-white mb-4 font-sans">Real-Time Low-Performance Filtering</h3>
              <p className="text-zinc-400 dark:text-zinc-400 text-lg leading-relaxed font-sans">
                Instantly identify underperforming products based on sales, views, and engagement metrics.
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="bg-zinc-900 dark:bg-zinc-900 p-10 rounded-2xl border border-zinc-800 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-16 h-16 bg-zinc-800 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                <Download className="h-8 w-8 text-white dark:text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white dark:text-white mb-4 font-sans">Supplier-Specific CSV Export</h3>
              <p className="text-zinc-400 dark:text-zinc-400 text-lg leading-relaxed font-sans">
                Export official CSV files organized by supplier for easy bulk deletion.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* The "Pain" Section */}
      <section className="py-24 px-4 bg-zinc-900 dark:bg-zinc-900" id="pain">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white dark:text-white mb-4 font-sans">
              Why Your Inventory Needs Optimization
            </h2>
            <p className="text-xl text-zinc-400 dark:text-zinc-400 max-w-2xl mx-auto font-sans">
              Dead stock isn't just taking up space—it's actively hurting your business.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-10"
          >
            <motion.div
              variants={fadeInUp}
              className="bg-zinc-900 dark:bg-zinc-900 p-10 rounded-2xl border border-zinc-800 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-16 h-16 bg-zinc-800 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                <TrendingDown className="h-8 w-8 text-white dark:text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white dark:text-white mb-4 font-sans">Marketplace Algorithms Hate Dead Stock</h3>
              <p className="text-zinc-400 dark:text-zinc-400 text-lg leading-relaxed font-sans">
                Old, unsold items drag down your search ranking on every major platform. Clear your dead inventory before it hurts your visibility.
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="bg-zinc-900 dark:bg-zinc-900 p-10 rounded-2xl border border-zinc-800 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-16 h-16 bg-zinc-800 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                <Ban className="h-8 w-8 text-white dark:text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white dark:text-white mb-4 font-sans">Make Room for Winners</h3>
              <p className="text-zinc-400 dark:text-zinc-400 text-lg leading-relaxed font-sans">
                Most marketplaces limit your listing slots. Remove dead stock so you can fill those slots with items that actually sell.
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="bg-zinc-900 dark:bg-zinc-900 p-10 rounded-2xl border border-zinc-800 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-16 h-16 bg-zinc-800 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                <DollarSign className="h-8 w-8 text-white dark:text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white dark:text-white mb-4 font-sans">Cut 90% of Your Cleanup Time</h3>
              <p className="text-zinc-400 dark:text-zinc-400 text-lg leading-relaxed font-sans">
                Stop deleting listings one by one. Automate the entire process instantly.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 px-4 bg-zinc-900 dark:bg-zinc-900" id="how-it-works">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white dark:text-white mb-4 font-sans">
              How It Works
            </h2>
            <p className="text-xl text-zinc-400 dark:text-zinc-400 max-w-2xl mx-auto font-sans">
              Three simple steps to clean up your inventory
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-10"
          >
            <motion.div
              variants={fadeInUp}
              className="bg-zinc-900 dark:bg-zinc-900 p-10 rounded-2xl border border-zinc-800 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-16 h-16 bg-zinc-800 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                <span className="text-3xl font-bold text-white dark:text-white font-sans">1</span>
              </div>
              <h3 className="text-2xl font-bold text-white dark:text-white mb-4 font-sans">Connect Your Store</h3>
              <p className="text-zinc-400 dark:text-zinc-400 text-lg leading-relaxed font-sans">
                Securely link your marketplace account.
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="bg-zinc-900 dark:bg-zinc-900 p-10 rounded-2xl border border-zinc-800 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-16 h-16 bg-zinc-800 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                <span className="text-3xl font-bold text-white dark:text-white font-sans">2</span>
              </div>
              <h3 className="text-2xl font-bold text-white dark:text-white mb-4 font-sans">Detect Low-Performing Listings</h3>
              <p className="text-zinc-400 dark:text-zinc-400 text-lg leading-relaxed font-sans">
                We analyze your listings and flag dead stock, low impressions, and non-performers.
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="bg-zinc-900 dark:bg-zinc-900 p-10 rounded-2xl border border-zinc-800 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-16 h-16 bg-zinc-800 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                <span className="text-3xl font-bold text-white dark:text-white font-sans">3</span>
              </div>
              <h3 className="text-2xl font-bold text-white dark:text-white mb-4 font-sans">Download & Delete via CSV</h3>
              <p className="text-zinc-400 dark:text-zinc-400 text-lg leading-relaxed font-sans">
                Export a ready-to-upload CSV, then bulk-delete inside your marketplace.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>



      {/* Supported Marketplaces & Suppliers */}
      <section className="py-16 px-4 bg-zinc-900 dark:bg-zinc-900 border-b border-zinc-800 dark:border-zinc-800">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white dark:text-white mb-4 font-sans">
              Supported Platforms
            </h2>
          </motion.div>

          {/* Marketplaces */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-12"
          >
            <h3 className="text-lg font-semibold text-zinc-300 dark:text-zinc-300 mb-6 text-center">Marketplaces</h3>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
              <div className="flex flex-col items-center gap-2">
                <div className="h-14 w-32 bg-white rounded-lg flex items-center justify-center p-2 shadow-lg">
                  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/ebay.svg" alt="eBay" className="h-8 w-auto" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<span class="text-zinc-900 font-bold text-sm">eBay</span>'; }} />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Suppliers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h3 className="text-lg font-semibold text-zinc-300 dark:text-zinc-300 mb-6 text-center">Suppliers</h3>
            <div className="flex flex-wrap justify-center items-center gap-6 md:gap-10">
              {/* Shopify */}
              <div className="flex flex-col items-center gap-2">
                <div className="h-14 w-32 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center p-2 shadow-lg">
                  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/shopify.svg" alt="Shopify" className="h-8 w-auto" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<span class="text-white font-bold text-sm">Shopify</span>'; }} />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Section - Vertical Separation UX */}
      <section className="py-24 px-4 bg-zinc-900 dark:bg-zinc-900 relative overflow-hidden" id="pricing">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-900 to-black pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="container mx-auto max-w-6xl relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Header */}
            <div className="text-center mb-8">
              <motion.span 
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm font-semibold mb-6"
              >
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Premium Subscription
              </motion.span>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                1 Hour → 5 Minutes
              </h2>
              <p className="text-xl text-zinc-400 max-w-4xl mx-auto">
                Time is money for sellers. Dramatically reduce your product cleanup time.
              </p>
            </div>

            {/* Professional Plan - Single Tier */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="flex justify-center"
            >
              <div className="w-full max-w-2xl border-2 border-emerald-500/50 rounded-3xl p-8 md:p-10 bg-gradient-to-br from-zinc-900 to-zinc-800 shadow-2xl">
                {/* Professional Badge */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-full mb-4">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-base font-bold text-emerald-400">PROFESSIONAL PLAN</span>
                  </div>
                  <h3 className="text-3xl font-bold text-white mb-2">{PROFESSIONAL_PLAN.name}</h3>
                  <div className="mb-4">
                    <span className="text-6xl font-black text-white">${PROFESSIONAL_PLAN.price}</span>
                    <span className="text-xl text-zinc-400 ml-2">/{PROFESSIONAL_PLAN.billing}</span>
                  </div>
                  <p className="text-zinc-400 text-lg">
                    Account Health Protection & Automated Inventory Cleaning for US eBay Professionals
                  </p>
                </div>

                {/* Features List */}
                <div className="space-y-4 mb-8">
                  {PROFESSIONAL_PLAN.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="text-zinc-300">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Subscribe Button */}
                <button
                  onClick={handleSubscribe}
                  disabled={isSubscribing || !isAuthenticated}
                  className={`
                    w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-center text-lg transition-all shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:scale-[1.02]
                    ${isSubscribing || !isAuthenticated ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {isSubscribing ? 'Processing...' : !isAuthenticated ? 'Please log in to subscribe' : `Subscribe to Professional Plan — $${PROFESSIONAL_PLAN.price}/${PROFESSIONAL_PLAN.billing}`}
                </button>

                {/* Trust Elements */}
                <div className="mt-6 text-center text-zinc-400 text-sm">
                  <p>Secure payment processing through Lemon Squeezy.</p>
                  <p className="mt-1">Cancel anytime. No long-term commitment.</p>
                </div>
              </div>
            </motion.div>

            {/* FAQ / Trust Elements */}
            <div className="mt-12 text-center">
              <p className="text-zinc-500 text-sm">
                Questions? <a href="#support" className="text-blue-400 hover:text-blue-300 underline">Contact our support team</a>
              </p>
              <div className="flex items-center justify-center gap-6 mt-4 text-zinc-600 text-xs">
                <span>🔒 Secure Payment via Lemon Squeezy</span>
                <span>•</span>
                <span>💳 Cancel Anytime</span>
                <span>•</span>
                <span>📧 24/7 Email Support</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-black dark:bg-black border-t border-zinc-800">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-lg shadow-blue-500/20">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white dark:text-white">OptListing</span>
              </div>
              <p className="text-zinc-400 dark:text-zinc-400 text-sm">© 2026 OptListing. All rights reserved.</p>
            </div>
            <div className="flex gap-6">
              <a href="#support" className="text-zinc-400 dark:text-zinc-400 hover:text-white dark:hover:text-white transition-colors">Support</a>
              <Link to="/terms" className="text-zinc-400 dark:text-zinc-400 hover:text-white dark:hover:text-white transition-colors">Terms</Link>
              <Link to="/privacy" className="text-zinc-400 dark:text-zinc-400 hover:text-white dark:hover:text-white transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
