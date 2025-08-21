/**
 * Utility functions for handling image URLs and detecting expired DALL-E images
 */

export interface ImageUrlInfo {
  isExpired: boolean
  isDalleUrl: boolean
  originalUrl: string
  needsRefresh: boolean
}

/**
 * Check if a URL is a DALL-E generated image URL
 */
export function isDalleUrl(url: string): boolean {
  return url.includes('oaidalleapiprodscus.blob.core.windows.net')
}

/**
 * Check if a DALL-E URL is expired by parsing the expiration timestamp
 */
export function isDalleUrlExpired(url: string): boolean {
  if (!isDalleUrl(url)) return false
  
  try {
    // Extract the 'se' parameter which contains the expiration timestamp
    const urlParams = new URLSearchParams(url.split('?')[1])
    const expirationParam = urlParams.get('se')
    
    if (!expirationParam) return true
    
    // Parse the expiration timestamp (format: 2025-08-21T21:32:00Z)
    const expirationDate = new Date(decodeURIComponent(expirationParam))
    const now = new Date()
    
    // Add a small buffer (5 minutes) to account for timezone differences
    const bufferTime = 5 * 60 * 1000
    return now.getTime() > (expirationDate.getTime() - bufferTime)
  } catch (error) {
    console.error('Error parsing DALL-E URL expiration:', error)
    return true // Assume expired if we can't parse
  }
}

/**
 * Analyze an image URL and determine if it needs attention
 */
export function analyzeImageUrl(url: string): ImageUrlInfo {
  const isDalle = isDalleUrl(url)
  const isExpired = isDalle ? isDalleUrlExpired(url) : false
  
  return {
    isExpired,
    isDalleUrl: isDalle,
    originalUrl: url,
    needsRefresh: isExpired
  }
}

/**
 * Extract the original prompt from a DALL-E URL (if available in metadata)
 */
export function extractPromptFromUrl(url: string): string | null {
  if (!isDalleUrl(url)) return null
  
  try {
    const urlParams = new URLSearchParams(url.split('?')[1])
    // DALL-E URLs don't contain prompts, but we can extract other useful info
    const timestamp = urlParams.get('st')
    return timestamp ? `Generated at ${new Date(decodeURIComponent(timestamp)).toLocaleString()}` : null
  } catch (error) {
    return null
  }
}

/**
 * Generate a fallback image URL for expired images
 */
export function getFallbackImageUrl(sceneName: string, sceneNumber?: string): string {
  const sceneInfo = sceneNumber ? `Scene ${sceneNumber}: ${sceneName}` : sceneName
  return `/abstract-geometric-scene.png?key=${Date.now()}&height=288&width=192&query=${encodeURIComponent(sceneInfo)}`
}
