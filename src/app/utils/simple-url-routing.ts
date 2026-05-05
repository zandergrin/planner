// Simple URL routing system: URL → Short URL Bin (gets sitemap ID) → Sitemap Bin (gets full data)
// This stores ONLY the mapping: shortId → sitemapId (no full sitemap content)

import { 
  storeShortUrlMapping, 
  retrieveShortUrlMapping 
} from './cloud-storage';
import { loadCloudSitemaps } from './cloud-storage';
import { SerializableSitemap } from './storage';

// Generate a short ID (6-8 characters) using safe characters
function generateShortId(length: number = 6): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Find existing short URL for a sitemap ID
export async function findExistingShortUrl(sitemapId: string): Promise<string | null> {
  try {
    console.log('🔍 Looking for existing short URL for sitemap:', sitemapId);
    
    // Use cloud storage API directly to get all short URL mappings
    const apiBase = import.meta.env.DEV ? '/api-jsonbin' : 'https://api.jsonbin.io/v3';
    const response = await fetch(`${apiBase}/b/684a24198561e97a5022add1/latest`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': import.meta.env.VITE_JSONBIN_API_KEY || ''
      },
      signal: AbortSignal.timeout(15000)
    });
    
    if (!response.ok) {
      console.log('⚠️ Could not load existing short URLs, will create new one');
      return null;
    }
    
    const data = await response.json();
    const cloudData = data?.record;
    
    if (cloudData && cloudData.mappings) {
      // Look for existing mapping that points to this sitemap ID
      const existingMapping = cloudData.mappings.find((mapping: any) => {
        // Handle different formats of stored data
        if (typeof mapping.sitemapData === 'string') {
          return mapping.sitemapData === sitemapId;
        } else if (mapping.sitemapData && mapping.sitemapData.sitemapId) {
          return mapping.sitemapData.sitemapId === sitemapId;
        } else if (mapping.sitemapData && mapping.sitemapData.id) {
          return mapping.sitemapData.id === sitemapId;
        }
        return false;
      });
      
      if (existingMapping) {
        const baseUrl = `${window.location.origin}${window.location.pathname}`;
        const existingUrl = `${baseUrl}?mode=view&sitemap=${existingMapping.shortId}`;
        console.log('✅ Found existing short URL:', existingUrl);
        return existingUrl;
      }
    }
    
    console.log('ℹ️ No existing short URL found for sitemap:', sitemapId);
    return null;
    
  } catch (error) {
    console.log('⚠️ Error checking for existing short URL:', error);
    return null;
  }
}

// Create a short URL for a sitemap (stores ONLY the sitemap ID, not the full data)
export async function createSimpleShortUrl(sitemapId: string, forceNew: boolean = false): Promise<string> {
  try {
    console.log('🔗 Creating simple short URL for sitemap:', sitemapId, forceNew ? '(forcing new)' : '');
    
    // First, check if a short URL already exists for this sitemap (unless forcing new)
    if (!forceNew) {
      const existingUrl = await findExistingShortUrl(sitemapId);
      if (existingUrl) {
        console.log('♻️ Reusing existing short URL instead of creating new one');
        return existingUrl;
      }
    } else {
      console.log('🆕 Forcing creation of new short URL (ignoring existing)');
    }
    
    // Generate a unique short ID
    let shortId = generateShortId(6);
    let attempts = 0;
    const maxAttempts = 3;
    
    // Check for collisions
    while (attempts < maxAttempts) {
      try {
        const existing = await retrieveShortUrlMapping(shortId);
        if (!existing) {
          break; // ID is unique
        }
        shortId = generateShortId(6);
        attempts++;
      } catch (error) {
        // If retrieval fails, assume ID is unique
        break;
      }
    }
    
    if (attempts >= maxAttempts) {
      throw new Error('Failed to generate unique short ID');
    }
    
    // Store ONLY the sitemap ID mapping (not full sitemap data)
    console.log('💾 Storing simple mapping:', { shortId, sitemapId });
    await storeShortUrlMapping(shortId, sitemapId);
    
    // Create the final URL
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const shortUrl = `${baseUrl}?mode=view&sitemap=${shortId}`;
    
    console.log('✅ Short URL created:', shortUrl);
    return shortUrl;
    
  } catch (error) {
    console.error('❌ Error creating simple short URL:', error);
    throw new Error('Failed to create share URL');
  }
}

// Get sitemap ID from short URL (extracts just the ID)
export async function getSitemapIdFromShortUrl(shortId: string): Promise<string | null> {
  try {
    console.log('🔍 Looking up sitemap ID for short URL:', shortId);
    
    const mappingData = await retrieveShortUrlMapping(shortId);
    
    if (mappingData) {
      // Handle different response formats
      if (typeof mappingData === 'string') {
        // New simplified format: just the sitemap ID string
        console.log('✅ Short URL resolved to sitemap ID:', mappingData);
        return mappingData;
      } else if (mappingData.sitemapId) {
        // Object format with sitemapId property
        console.log('✅ Short URL resolved to sitemap ID:', mappingData.sitemapId);
        return mappingData.sitemapId;
      } else if (mappingData.id) {
        // Legacy format: full sitemap data with id property
        console.log('✅ Short URL resolved to sitemap ID (legacy):', mappingData.id);
        return mappingData.id;
      }
    }
    
    console.log('❌ Short URL not found:', shortId);
    return null;
    
  } catch (error) {
    console.error('❌ Error resolving short URL:', error);
    return null;
  }
}

// Get full sitemap data by ID from Sitemap Bin
export async function getFullSitemapData(sitemapId: string): Promise<SerializableSitemap | null> {
  try {
    console.log('📖 Loading full sitemap data for ID:', sitemapId);
    
    const allSitemaps = await loadCloudSitemaps();
    const sitemap = allSitemaps.find(s => s.id === sitemapId);
    
    if (sitemap) {
      console.log('✅ Full sitemap data loaded:', sitemap.name);
      return sitemap;
    } else {
      console.log('❌ Sitemap not found in storage:', sitemapId);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Error loading full sitemap data:', error);
    return null;
  }
}

// Combined function: resolve short URL to full sitemap data
export async function resolveShortUrlToSitemap(shortId: string): Promise<SerializableSitemap | null> {
  try {
    console.log('🔄 Resolving short URL to full sitemap:', shortId);
    
    // Step 1: Get sitemap ID from short URL
    const sitemapId = await getSitemapIdFromShortUrl(shortId);
    if (!sitemapId) {
      return null;
    }
    
    // Step 2: Get full sitemap data from sitemap ID
    const sitemapData = await getFullSitemapData(sitemapId);
    return sitemapData;
    
  } catch (error) {
    console.error('❌ Error resolving short URL to sitemap:', error);
    return null;
  }
}

// Check if a string looks like a short URL ID
export function isShortUrl(id: string): boolean {
  return id.length >= 4 && id.length <= 10 && !id.startsWith('data_');
}

// Debug function to test the simplified system
export async function debugSimpleUrlSystem(): Promise<void> {
  console.log('=== SIMPLE URL ROUTING DEBUG ===');
  
  try {
    // First, check if we have any sitemaps
    const allSitemaps = await loadCloudSitemaps();
    console.log(`📋 Found ${allSitemaps.length} sitemaps in storage`);
    
    if (allSitemaps.length > 0) {
      const testSitemap = allSitemaps[0];
      console.log(`🧪 Testing with sitemap: ${testSitemap.name} (${testSitemap.id})`);
      
      // Test checking for existing short URL first
      console.log('🔍 Checking for existing short URL...');
      const existingUrl = await findExistingShortUrl(testSitemap.id);
      if (existingUrl) {
        console.log('♻️ Found existing short URL:', existingUrl);
      } else {
        console.log('ℹ️ No existing short URL found');
      }
      
      // Test creating a short URL (should reuse existing if found)
      const shortUrl = await createSimpleShortUrl(testSitemap.id);
      console.log('🔗 Short URL (reused or new):', shortUrl);
      
      // Test creating again (should definitely reuse)
      console.log('🔄 Testing second creation (should reuse)...');
      const shortUrl2 = await createSimpleShortUrl(testSitemap.id);
      console.log('🔗 Second short URL:', shortUrl2);
      console.log('✅ URLs match:', shortUrl === shortUrl2 ? 'YES' : 'NO');
      
      // Extract short ID from URL
      const urlParams = new URLSearchParams(shortUrl.split('?')[1]);
      const shortId = urlParams.get('sitemap');
      
      if (shortId && isShortUrl(shortId)) {
        console.log('🔍 Testing resolution...');
        
        // Test resolving back to full data
        const resolvedData = await resolveShortUrlToSitemap(shortId);
        
        if (resolvedData) {
          console.log('✅ Successfully resolved to:', resolvedData.name);
        } else {
          console.log('❌ Failed to resolve short URL');
        }
      } else {
        console.log('❌ Generated URL does not contain valid short ID');
      }
    } else {
      console.log('ℹ️ No sitemaps available for testing');
    }
    
  } catch (error) {
    console.error('❌ Debug test failed:', error);
  }
  
  console.log('=== END DEBUG ===');
}

// Make functions available globally for testing
declare global {
  interface Window {
    vennSimpleUrlRouting: {
      createSimpleShortUrl: typeof createSimpleShortUrl;
      findExistingShortUrl: typeof findExistingShortUrl;
      getSitemapIdFromShortUrl: typeof getSitemapIdFromShortUrl;
      getFullSitemapData: typeof getFullSitemapData;
      resolveShortUrlToSitemap: typeof resolveShortUrlToSitemap;
      isShortUrl: typeof isShortUrl;
      debugSimpleUrlSystem: typeof debugSimpleUrlSystem;
    };
  }
}

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.vennSimpleUrlRouting = {
    createSimpleShortUrl,
    findExistingShortUrl,
    getSitemapIdFromShortUrl,
    getFullSitemapData,
    resolveShortUrlToSitemap,
    isShortUrl,
    debugSimpleUrlSystem
  };
}
