/**
 * Lemon Squeezy hosted checkout URL generation.
 * Always returns a FULL absolute URL (https://...) to avoid 404 on own domain.
 * No relative paths. Single source of truth for Pricing and Landing.
 *
 * IMPORTANT: Lemon Squeezy's checkout links are UUID-based
 * (https://{store}.lemonsqueezy.com/checkout/buy/{variant-uuid}), not the old
 * numeric /buy/{product_id}?checkout[variant_id]={variant_id} scheme. Get the
 * correct UUID for a product from its "Share" panel in the LS dashboard, or
 * from the `buy_now_url` field on GET /v1/products/{id} via the LS API.
 *
 * NOTE (2026-08-28): the UUID below is the store's LIVE-mode "Pro" product —
 * $49.00/month subscription with a 7-day free trial, confirmed matching the
 * site's advertised pricing. Replaces the earlier TEST-mode "Pro Test"
 * product (which was misconfigured at $120/month).
 */

const DEFAULT_STORE = 'https://optlisting.lemonsqueezy.com'
const DEFAULT_CHECKOUT_UUID = '011d437f-9241-47ed-8319-79b9c0251d67' // LIVE — Pro, $49/mo, 7-day trial

/**
 * Returns Lemon Squeezy config. Store is always absolute (https). UUID falls back to the
 * default so VITE_* can be empty/undefined at build time.
 * @returns {{ store: string, checkoutUuid: string }}
 */
export function getLemonSqueezyConfig() {
  let store = (import.meta.env.VITE_LEMON_SQUEEZY_STORE ?? '').trim() || DEFAULT_STORE
  if (!store.startsWith('http://') && !store.startsWith('https://')) store = DEFAULT_STORE
  let checkoutUuid = (import.meta.env.VITE_LEMON_SQUEEZY_CHECKOUT_UUID ?? '').trim() || DEFAULT_CHECKOUT_UUID
  return { store, checkoutUuid }
}

/**
 * Builds the FULL absolute checkout URL for Lemon Squeezy hosted page.
 * Format: https://optlisting.lemonsqueezy.com/checkout/buy/{uuid}?checkout[custom][user_id]=...
 * Never returns a relative path.
 * @param {{ id?: string, user_metadata?: { user_id?: string }, email?: string } | null} user - Auth user object
 * @returns {string | null} Full absolute URL or null if user id missing
 */
export function generateProfessionalCheckoutUrl(user) {
  const userId = user?.id ?? user?.user_metadata?.user_id
  const userEmail = user?.email ?? ''
  if (!userId) return null

  const { store, checkoutUuid } = getLemonSqueezyConfig()
  const baseUrl = `${store.replace(/\/$/, '')}/checkout/buy/${checkoutUuid}`
  const params = new URLSearchParams({
    'checkout[custom][user_id]': userId,
  })
  if (userEmail) params.append('checkout[custom][email]', userEmail)
  const fullUrl = `${baseUrl}?${params.toString()}`
  return fullUrl.startsWith('http') ? fullUrl : `${DEFAULT_STORE}/checkout/buy/${checkoutUuid}?${params.toString()}`
}
