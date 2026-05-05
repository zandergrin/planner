// Data cleanup utility for clearing all stored data from cloud storage
import { saveCloudSitemaps, saveCloudPageTypes } from './cloud-storage';

export async function clearAllData(): Promise<void> {
  console.log('🧹 Starting comprehensive data cleanup...');
  
  try {
    // Clear sitemaps from cloud storage (set to empty array)
    console.log('🗑️ Clearing all sitemaps from cloud storage...');
    await saveCloudSitemaps([]);
    
    // Clear page types from cloud storage (set to empty array)
    console.log('🗑️ Clearing page types from cloud storage...');
    await saveCloudPageTypes([]);
    
    // Clear short URL mappings by saving empty data structure
    console.log('🗑️ Clearing short URL mappings...');
    try {
      // Use the cloud storage API to clear the short URL bin
      const CLOUD_STORAGE_CONFIG = {
        API_BASE: "https://api.jsonbin.io/v3",
        API_KEY: "$2a$10$gxCvk9ANvIiozJX987t7TOalHI3WyUIE.nlondWqiGmv0YvpcnZiW",
        SHORT_URLS_BIN_ID: "684a24198561e97a5022add1",
        ORG_ID: "784812546842757295",
      };

      const emptyShortUrlData = {
        version: "1.0",
        organizationId: CLOUD_STORAGE_CONFIG.ORG_ID,
        mappings: [],
        lastUpdated: new Date().toISOString(),
      };

      const response = await fetch(`${CLOUD_STORAGE_CONFIG.API_BASE}/b/${CLOUD_STORAGE_CONFIG.SHORT_URLS_BIN_ID}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": CLOUD_STORAGE_CONFIG.API_KEY,
          "X-Bin-Versioning": "false",
        },
        body: JSON.stringify(emptyShortUrlData),
      });

      if (!response.ok) {
        console.warn('⚠️ Failed to clear short URL bin, but continuing...');
      } else {
        console.log('✅ Short URL mappings cleared');
      }
    } catch (shortUrlError) {
      console.warn('⚠️ Error clearing short URL mappings:', shortUrlError);
      // Continue with other cleanup even if this fails
    }
    
    // Clear localStorage and sessionStorage
    console.log('🗑️ Clearing local browser storage...');
    if (typeof window !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
    }
    
    console.log('✅ All data cleared successfully');
  } catch (error) {
    console.error('❌ Error during data cleanup:', error);
    throw new Error('Failed to clear all data');
  }
}

// Debug function to show what data exists
export async function showCurrentData(): Promise<void> {
  console.log('📊 Current data status:');
  
  try {
    // Import functions dynamically to avoid circular dependencies
    const { loadCloudSitemaps, loadCloudPageTypes } = await import('./cloud-storage');
    
    const sitemaps = await loadCloudSitemaps();
    console.log(`📋 Sitemaps: ${sitemaps.length} found`);
    
    const pageTypes = await loadCloudPageTypes();
    console.log(`🏷️ Page Types: ${pageTypes.length} found`);
    
    if (typeof window !== 'undefined') {
      console.log('💾 Local Storage items:', localStorage.length);
      console.log('🔄 Session Storage items:', sessionStorage.length);
    }
    
  } catch (error) {
    console.error('❌ Error checking data:', error);
  }
}

// Force refresh after data clear
export async function clearAllDataAndRefresh(): Promise<void> {
  try {
    await clearAllData();
    
    // Clear any cached modules/data
    if (typeof window !== 'undefined') {
      // Clear any window-level caches
      if ((window as any).vennSimpleUrlRouting) {
        delete (window as any).vennSimpleUrlRouting;
      }
      if ((window as any).vennCloudDebug) {
        delete (window as any).vennCloudDebug;
      }
      
      // Force a page refresh to ensure clean state
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  } catch (error) {
    console.error('❌ Error during full cleanup:', error);
    throw error;
  }
}

// Make functions available globally for easy testing
declare global {
  interface Window {
    vennDataCleanup: {
      clearAllData: typeof clearAllData;
      showCurrentData: typeof showCurrentData;
      clearAllDataAndRefresh: typeof clearAllDataAndRefresh;
    };
  }
}

if (typeof window !== 'undefined') {
  window.vennDataCleanup = {
    clearAllData,
    showCurrentData,
    clearAllDataAndRefresh
  };
}