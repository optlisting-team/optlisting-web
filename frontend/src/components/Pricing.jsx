import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useAccount } from '../contexts/AccountContext'
import { Check } from 'lucide-react'

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
    'Professional error handling'
  ]
}

export default function Pricing() {
  const { user } = useAuth()
  const { subscriptionStatus, plan, refreshSubscription } = useAccount()
  const [loading, setLoading] = useState(false)

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
    
    // Lemon Squeezy checkout URL format for subscriptions
    // Final URL format: https://optlisting.lemonsqueezy.com/checkout/buy/795931?checkout[variant_id]=1255285&checkout[custom][user_id]=...
    // Documentation: https://docs.lemonsqueezy.com/help/checkout/checkout-custom-fields
    
    const baseUrl = `${LEMON_SQUEEZY_STORE}/checkout/buy/${productId}`
    const params = new URLSearchParams({
      'checkout[variant_id]': variantId,
      'checkout[custom][user_id]': userId,
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
    console.log('   URL Structure:', `checkout/buy/${productId}?checkout[variant_id]=${variantId}`)
    return checkoutUrl
  }

  const handleSubscribe = () => {
    if (!user?.id) {
      console.error('❌ [CHECKOUT] Cannot subscribe: User not logged in')
      alert('Please log in to subscribe to the Professional Plan.')
      return
    }
    
    // IDs are always available due to fallback values (795931, 1255285)
    // No need to check - fallback ensures checkout always works
    
    setLoading(true)
    const checkoutUrl = generateCheckoutUrl()
    
    if (!checkoutUrl) {
      // This should only happen if user_id extraction failed (already logged)
      console.error('❌ [CHECKOUT] Failed to generate checkout URL')
      setLoading(false)
      return
    }
    
    // Open Lemon Squeezy checkout in new window
    console.log('🚀 [CHECKOUT] Opening Lemon Squeezy checkout:', checkoutUrl)
    window.open(checkoutUrl, '_blank')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white py-16 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Premium Pricing</h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            Professional-grade eBay listing optimization for serious sellers
          </p>
        </div>

        {/* Professional Plan - Single Tier */}
        <div className="max-w-2xl mx-auto">
          <div className="relative bg-gradient-to-br from-zinc-900 to-zinc-800 border-2 border-emerald-500/50 rounded-2xl p-8 shadow-2xl">
            {/* Popular Badge */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg">
                PROFESSIONAL
              </span>
            </div>

            <div className="text-center mb-8 mt-4">
              <h3 className="text-3xl font-bold mb-4">{PROFESSIONAL_PLAN.name}</h3>
              <div className="mb-6">
                <span className="text-6xl font-bold text-white">${PROFESSIONAL_PLAN.price}</span>
                <span className="text-xl text-zinc-400 ml-2">/{PROFESSIONAL_PLAN.billing}</span>
              </div>
              <p className="text-zinc-400 text-lg">
                Everything you need to optimize your eBay listings
              </p>
            </div>

            {/* Features List */}
            <ul className="space-y-4 mb-8">
              {PROFESSIONAL_PLAN.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="text-zinc-300">{feature}</span>
                </li>
              ))}
            </ul>

            {/* Subscribe Button or Active Status */}
            {subscriptionStatus === 'active' && plan === 'PROFESSIONAL' ? (
              <div className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg text-center">
                ✓ Active Plan - Professional
              </div>
            ) : (
              <button
                onClick={handleSubscribe}
                disabled={loading || !user}
                className={`
                  w-full py-4 rounded-xl font-bold text-lg transition-all duration-200
                  ${loading || !user
                    ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02]'
                  }
                `}
              >
                {loading ? 'Processing...' : !user ? 'Please log in to subscribe' : 'Subscribe to Professional Plan - $120/month'}
              </button>
            )}

            {/* Notice */}
            <div className="mt-6 text-center text-zinc-400 text-sm">
              <p>Secure payment processing through Lemon Squeezy.</p>
              <p className="mt-1">Cancel anytime. No long-term commitment.</p>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-16 text-center text-zinc-400 text-sm max-w-2xl mx-auto">
          <p className="mb-4">
            <strong className="text-white">High-Profit Price Policy:</strong> OptListing is designed for professional sellers who value premium, reliable service.
          </p>
          <p>
            All features are included. No hidden fees. No credit-based limitations.
          </p>
        </div>
      </div>
    </div>
  )
}
