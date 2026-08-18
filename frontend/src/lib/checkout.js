/**
 * Lemon Squeezy hosted checkout URL generation.
 * Always returns a FULL absolute URL (https://...) to avoid 404 on own domain.
 * No relative paths. Single source of truth for Pricing and Landing.
 */

const DEFAULT_STORE = 'https://optlisting.lemonsqueezy.com'
const DEFAULT_PRODUCT_ID = '795931'
const DEFAULT_VARIANT_ID = '1255285'

/**
 * Returns Lemon Squeezy config. Store is always absolute (https). IDs fallback to defaults
 * so VITE_* can be empty/undefined at build time.
 * @returns {{ store: string, productId: string, variantId: string }}
 */
export function getLemonSqueezyConfig() {
  let store = (import.meta.env.VITE_LEMON_SQUEEZY_STORE ?? '').trim() || DEFAULT_STORE
  if (!store.startsWith('http://') && !store.startsWith('https://')) store = DEFAULT_STORE
  let productId = String(import.meta.env.VITE_LEMON_SQUEEZY_PRODUCT_ID ?? DEFAULT_PRODUCT_ID).trim()
  let variantId = String(import.meta.env.VITE_LEMON_SQUEEZY_VARIANT_ID ?? DEFAULT_VARIANT_ID).trim()
  if (productId === '' || isNaN(Number(productId))) productId = DEFAULT_PRODUCT_ID
  if (variantId === '' || isNaN(Number(variantId))) variantId = DEFAULT_VARIANT_ID
  return { store, productId, variantId }
}

/**
 * Builds the FULL absolute checkout URL for Lemon Squeezy hosted page.
 * Format: https://optlisting.lemonsqueezy.com/buy/795931?checkout[variant_id]=1255285&checkout[custom][user_id]=...&test_mode=true
 * Never returns a relative path.
 * @param {{ id?: string, user_metadata?: { user_id?: string }, email?: string } | null} user - Auth user object
 * @returns {string | null} Full absolute URL or null if user id missing
 */
export function generateProfessionalCheckoutUrl(user) {
  const userId = user?.id ?? user?.user_metadata?.user_id
  const userEmail = user?.email ?? ''
  if (!userId) return null

  const { store, productId, variantId } = getLemonSqueezyConfig()
  const baseUrl = `${store.replace(/\/$/, '')}/buy/${productId}`
  const params = new URLSearchParams({
    'checkout[variant_id]': variantId,
    'checkout[custom][user_id]': userId,
    'test_mode': 'true',
  })
  if (userEmail) params.append('checkout[custom][email]', userEmail)
  const fullUrl = `${baseUrl}?${params.toString()}`
  return fullUrl.startsWith('http') ? fullUrl : `${DEFAULT_STORE}/buy/${productId}?${params.toString()}`
}
