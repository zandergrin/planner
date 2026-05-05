// Ultra-short URL service using cloud storage lookup table
// NO LOCALHOST FALLBACKS - Cloud storage is required

import { storeShortUrlMapping, retrieveShortUrlMapping } from './cloud-storage';
import { compressForUrl } from './compression';

interface ShortUrlMapping {
  id: string;
  sitemapData: any;
  createdAt: string;
  expiresAt?: string;
}

// Generate a short ID (6-8 characters) using safe characters
function generateShortId(length: number = 6): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Store a sitemap with a short ID in cloud storage
export async function createShortUrl(sitemapData: any): Promise<string> {
  try {
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
    
    // Prepare the shareable data (remove React components)
    const shareableData = {
      id: sitemapData.id,
      name: sitemapData.name,
      description: sitemapData.description,
      createdAt: typeof sitemapData.createdAt === 'string' ? sitemapData.createdAt : sitemapData.createdAt.toISOString(),
      updatedAt: typeof sitemapData.updatedAt === 'string' ? sitemapData.updatedAt : sitemapData.updatedAt.toISOString(),
      pages: sitemapData.pages.map((page: any) => ({
        ...page,
        name: String(page.name),
        icon: undefined,
        iconKey: page.iconKey || 'file'
      })),
      pageTypes: sitemapData.pageTypes.map((pageType: any) => ({
        id: pageType.id,
        name: String(pageType.name),
        iconKey: pageType.iconKey || 'file',
        color: pageType.color,
        description: pageType.description,
        icon: undefined
      })),
      rootPageOrder: sitemapData.rootPageOrder,
      collapsedGroups: sitemapData.collapsedGroups,
      zoom: sitemapData.zoom,
      selectedPageId: sitemapData.selectedPageId
    };
    
    // Store in cloud storage
    await storeShortUrlMapping(shortId, shareableData);
    
    // Create the final URL
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const shortUrl = `${baseUrl}?mode=view&sitemap=${shortId}`;
    
    return shortUrl;
  } catch (error) {
    console.error('Error creating short URL with cloud storage:', error);
    
    // Fallback to compressed URL encoding if cloud storage fails
    try {
      const shareableData = {
        id: sitemapData.id,
        name: sitemapData.name,
        description: sitemapData.description,
        createdAt: typeof sitemapData.createdAt === 'string' ? sitemapData.createdAt : sitemapData.createdAt.toISOString(),
        updatedAt: typeof sitemapData.updatedAt === 'string' ? sitemapData.updatedAt : sitemapData.updatedAt.toISOString(),
        pages: sitemapData.pages.map((page: any) => ({
          ...page,
          name: String(page.name),
          icon: undefined,
          iconKey: page.iconKey || 'file'
        })),
        pageTypes: sitemapData.pageTypes.map((pageType: any) => ({
          id: pageType.id,
          name: String(pageType.name),
          iconKey: pageType.iconKey || 'file',
          color: pageType.color,
          description: pageType.description,
          icon: undefined
        })),
        rootPageOrder: sitemapData.rootPageOrder,
        collapsedGroups: sitemapData.collapsedGroups,
        zoom: sitemapData.zoom,
        selectedPageId: sitemapData.selectedPageId
      };
      
      const baseUrl = `${window.location.origin}${window.location.pathname}`;
      const jsonData = JSON.stringify(shareableData);
      const encodedData = compressForUrl(jsonData);
      const fallbackUrl = `${baseUrl}?mode=view&sitemap=${encodeURIComponent('data_' + encodedData)}`;
      
      return fallbackUrl;
    } catch (fallbackError) {
      console.error('Fallback URL creation also failed:', fallbackError);
      throw new Error('Failed to create share URL - cloud storage required');
    }
  }
}

// Retrieve sitemap data from short ID using cloud storage
export async function getShortUrlData(shortId: string): Promise<any | null> {
  try {
    const sitemapData = await retrieveShortUrlMapping(shortId);
    return sitemapData;
  } catch (error) {
    console.error('Error retrieving short URL data:', error);
    return null;
  }
}

// Check if a sitemap ID is a short URL
export function isShortUrl(sitemapId: string): boolean {
  return sitemapId.length >= 4 && sitemapId.length <= 10 && !sitemapId.startsWith('data_');
}

// Utility to generate a test short URL (for development)
export async function createTestShortUrl(): Promise<string> {
  const testSitemap = {
    id: 'test-sitemap',
    name: 'Test Sitemap',
    description: 'A test sitemap for debugging',
    createdAt: new Date(),
    updatedAt: new Date(),
    pages: [
      {
        id: 'home',
        name: 'Home',
        iconKey: 'home',
        color: 'bg-blue-500',
        x: 856,
        y: 50,
        children: [],
        pageType: 'home'
      }
    ],
    pageTypes: [
      {
        id: 'home',
        name: 'Home Page',
        iconKey: 'home',
        color: 'bg-blue-500'
      }
    ],
    rootPageOrder: ['home'],
    collapsedGroups: [],
    zoom: 1,
    selectedPageId: undefined
  };
  
  return await createShortUrl(testSitemap);
}

// Debug function to test the short URL system
export async function debugShortUrlSystem(): Promise<void> {
  console.log('=== SHORT URL SYSTEM DEBUG ===');
  
  try {
    // Test creating a short URL
    console.log('1. Testing short URL creation...');
    const testUrl = await createTestShortUrl();
    console.log('   Created test URL:', testUrl);
    
    // Extract short ID from URL
    const urlParams = new URLSearchParams(testUrl.split('?')[1]);
    const shortId = urlParams.get('sitemap');
    
    if (shortId && isShortUrl(shortId)) {
      console.log('2. Testing short URL retrieval...');
      const retrievedData = await getShortUrlData(shortId);
      
      if (retrievedData) {
        console.log('   Successfully retrieved data for ID:', shortId);
        console.log('   Retrieved sitemap name:', retrievedData.name);
      } else {
        console.log('   Failed to retrieve data for ID:', shortId);
      }
    } else if (shortId && shortId.startsWith('data_')) {
      console.log('   Created fallback compressed URL (cloud storage not available)');
    } else {
      console.log('   Generated URL does not contain valid short ID or compressed data');
    }
    
  } catch (error) {
    console.error('Debug test failed:', error);
  }
  
  console.log('=== END DEBUG ===');
}

// Health check for short URL system
export async function healthCheck(): Promise<{
  shortUrlService: boolean;
  cloudStorage: boolean;
  fallbackWorking: boolean;
  errorDetails?: string;
}> {
  const result = {
    shortUrlService: false,
    cloudStorage: false,
    fallbackWorking: false,
    errorDetails: undefined as string | undefined
  };
  
  try {
    const testUrl = await createShortUrl({
      id: 'health-check',
      name: 'Health Check',
      description: 'System health check',
      createdAt: new Date(),
      updatedAt: new Date(),
      pages: [],
      pageTypes: [],
      rootPageOrder: [],
      collapsedGroups: [],
      zoom: 1
    });
    
    result.shortUrlService = true;
    
    const urlParams = new URLSearchParams(testUrl.split('?')[1]);
    const shortId = urlParams.get('sitemap');
    
    if (shortId && isShortUrl(shortId)) {
      result.cloudStorage = true;
    } else if (shortId && shortId.startsWith('data_')) {
      result.fallbackWorking = true;
    }
    
  } catch (error) {
    result.errorDetails = error instanceof Error ? error.message : 'Unknown error';
  }
  
  return result;
}

// Make functions available globally for testing
declare global {
  interface Window {
    vennShortUrl: {
      createShortUrl: typeof createShortUrl;
      getShortUrlData: typeof getShortUrlData;
      createTestShortUrl: typeof createTestShortUrl;
      isShortUrl: typeof isShortUrl;
      debugShortUrlSystem: typeof debugShortUrlSystem;
      healthCheck: typeof healthCheck;
    };
  }
}

// Expose debug functions globally (dev only)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.vennShortUrl = {
    createShortUrl,
    getShortUrlData,
    createTestShortUrl,
    isShortUrl,
    debugShortUrlSystem,
    healthCheck
  };
}
