import { useEffect } from 'react';

const BUILD_NUMBER = '178.10-HOMEPAGE-FIX'; // Update this with each significant change
const BUILD_TIMESTAMP = '2025-01-23 16:45 UTC';

export function BuildNumber() {
  useEffect(() => {
    // Get version from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const sitemapVersion = urlParams.get('v');
    
    const versionInfo = sitemapVersion ? ` | Sitemap Version: ${sitemapVersion}` : '';
    console.log(`🔧 Sitemap Builder v${BUILD_NUMBER} | Built: ${BUILD_TIMESTAMP}${versionInfo}`);
  }, []);

  return (
    <div className="fixed bottom-2 right-2 text-[10px] text-muted-foreground/40 pointer-events-none select-none font-mono">
      v{BUILD_NUMBER}
    </div>
  );
}