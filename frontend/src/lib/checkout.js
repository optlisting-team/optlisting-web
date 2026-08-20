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
 * NOTE (2026-08-20): the UUID below is the store's TEST-mode "Pro Test" product.
 * Before real launch this MUST be swapped for the LIVE-mode product's UUID
 * (a separate object — LS does not auto-copy test-mode products to live).
 * Also confirm the live product's price is actually $49/month — the "Pro Test"
 * product was found configured at $120/month, which doesn't match the site's
 * advertised pricing.
 */

const DEFAULT_STORE = 'https://optlisting.lemonsqueezy.com'
const DEFAULT_CHECKOUT_UUID = '01f530ea-81d9-4623-b714-9f252cc1c161' // TEST MODE — replace with live product's UUID before launch

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
