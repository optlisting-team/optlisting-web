/**
 * Image URL normalization utilities
 * Handles protocol-relative URLs, http -> https conversion, etc.
 */

/**
 * Normalize image URL
 * - Convert protocol-relative URLs (//example.com) to https://
 * - Convert http:// to https:// for security
 * - Return null if URL is invalid or empty
 */
export function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') {
    return null
  }

  let normalized = url.trim()

  // Handle empty string
  if (normalized === '') {
    return null
  }

  // Handle protocol-relative URLs (//i.ebayimg.com/...)
  if (normalized.startsWith('//')) {
    normalized = 'https:' + normalized
  }

  // Convert http to https (for security and mixed content)
  if (normalized.startsWith('http://')) {
    normalized = normalized.replace('http://', 'https://')
  }

  // Validate URL format
  try {
    new URL(normalized)
    return normalized
  } catch (e) {
    // Invalid URL format
    console.warn('Invalid image URL format:', url)
    return null
  }
}

/**
 * Get image URL from listing object (with fallback chain)
 */
export function getImageUrlFromListing(listing) {
  if (!listing) return null

  // Try in order: image_url -> picture_url -> thumbnail_url
  const url = listing.image_url || listing.picture_url || listing.thumbnail_url
  return normalizeImageUrl(url)
}

/**
 * Check if URL is an eBay image domain
 */
export function isEbayImageUrl(url) {
  if (!url) return false
  return url.includes('ebayimg.com') || url.includes('ebaystatic.com')
}

