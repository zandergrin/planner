// Simple URL-based sharing utilities
// No localStorage registry needed - data is encoded directly in the URL

import { compressForUrl } from './compression';

// Create a shareable URL with sitemap data encoded directly in the URL
export function createShareUrl(sitemapData: any): string {
  try {
    console.log('🔗 Creating share URL with embedded data');
    
    // Create a shareable version of the sitemap with encoded data
    const shareableData = {
      id: sitemapData.id,
      name: sitemapData.name,
      description: sitemapData.description,
      createdAt: typeof sitemapData.createdAt === 'string' ? sitemapData.createdAt : sitemapData.createdAt.toISOString(),
      updatedAt: typeof sitemapData.updatedAt === 'string' ? sitemapData.updatedAt : sitemapData.updatedAt.toISOString(),
      pages: sitemapData.pages.map((page: any) => ({
        ...page,
        icon: undefined, // Remove the React component
        iconKey: page.iconKey || 'file'
      })),
      pageTypes: sitemapData.pageTypes.map((pageType: any) => ({
        ...pageType,
        icon: undefined, // Remove the React component
        iconKey: pageType.iconKey || 'file'
      })),
      rootPageOrder: sitemapData.rootPageOrder,
      collapsedGroups: sitemapData.collapsedGroups,
      zoom: sitemapData.zoom,
      selectedPageId: sitemapData.selectedPageId
    };
    
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    
    // Use URL compression for reliable sharing
    try {
      const jsonData = JSON.stringify(shareableData);
      const encodedData = compressForUrl(jsonData);
      const shareUrl = `${baseUrl}?mode=view&sitemap=${encodeURIComponent('data_' + encodedData)}`;
      console.log('✅ Created compressed share URL, length:', shareUrl.length);
      return shareUrl;
    } catch (compressionError) {
      console.warn('Compression failed, using base64:', compressionError);
      const jsonData = JSON.stringify(shareableData);
      const encodedData = btoa(unescape(encodeURIComponent(jsonData)));
      const shareUrl = `${baseUrl}?mode=view&sitemap=${encodeURIComponent('data_' + encodedData)}`;
      console.log('✅ Created base64 share URL, length:', shareUrl.length);
      return shareUrl;
    }
  } catch (error) {
    console.error('❌ Error creating share URL:', error);
    throw error;
  }
}

// Helper function to check if a sitemap ID is URL-encoded data
export function isEncodedSitemapData(sitemapId: string): boolean {
  return sitemapId.startsWith('data_');
}

// Debug function to test share URLs
export function testShareUrl(sitemapData: any): string {
  try {
    const url = createShareUrl(sitemapData);
    console.log('🧪 Test share URL created:', url);
    return url;
  } catch (error) {
    console.error('Failed to create test share URL:', error);
    return '';
  }
}

// Make debug functions available globally for testing
declare global {
  interface Window {
    vennShareDebug: {
      createShareUrl: typeof createShareUrl;
      testShareUrl: typeof testShareUrl;
      isEncodedSitemapData: typeof isEncodedSitemapData;
    };
  }
}

// Expose debug functions globally
if (typeof window !== 'undefined') {
  window.vennShareDebug = {
    createShareUrl: createShareUrl,
    testShareUrl: testShareUrl,
    isEncodedSitemapData: isEncodedSitemapData
  };
}