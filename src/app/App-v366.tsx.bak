import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { SitemapEditor } from './components/SitemapEditor';
import { SitePlanHeader } from './components/SitePlanHeader';
import { AuthProvider, AuthGuard } from './components/AuthProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from "sonner";

type AppState = 
  | { mode: 'dashboard' }
  | { mode: 'editor'; sitemapId: string }
  | { mode: 'viewer'; sitemapId: string };

// Helper function to parse the current URL and determine initial state
function getInitialAppState(): AppState {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    const fullUrl = window.location.href;
    
    // Check URL parameters first (most reliable)
    const mode = urlParams.get('mode');
    const sitemapId = urlParams.get('sitemap');
    
    // Enhanced detection for viewer mode
    if (mode === 'view' && sitemapId) {
      return { mode: 'viewer', sitemapId: sitemapId.trim() };
    }
    
    if (mode === 'edit' && sitemapId) {
      return { mode: 'editor', sitemapId: sitemapId.trim() };
    }
    
    // Fallback to hash-based routing for backward compatibility
    if (hash.startsWith('#/edit/')) {
      const hashSitemapId = hash.replace('#/edit/', '');
      if (hashSitemapId && hashSitemapId.trim()) {
        return { mode: 'editor', sitemapId: hashSitemapId.trim() };
      }
    } else if (hash.startsWith('#/view/')) {
      const hashSitemapId = hash.replace('#/view/', '');
      if (hashSitemapId && hashSitemapId.trim()) {
        return { mode: 'viewer', sitemapId: hashSitemapId.trim() };
      }
    }
    
    // Check if URL contains mode=view anywhere (in case of URL encoding issues)
    if (fullUrl.includes('mode=view') || fullUrl.includes('mode%3Dview')) {
      // Try to extract sitemap parameter with various methods
      let extractedSitemapId = urlParams.get('sitemap');
      
      if (!extractedSitemapId) {
        const sitemapMatch = fullUrl.match(/sitemap=([^&\s#]+)/);
        if (sitemapMatch) {
          extractedSitemapId = decodeURIComponent(sitemapMatch[1]);
        }
      }
      
      if (!extractedSitemapId) {
        const shortIdMatch = fullUrl.match(/sitemap=([A-Za-z0-9]{4,10})(?:[&\s#]|$)/);
        if (shortIdMatch) {
          extractedSitemapId = shortIdMatch[1];
        }
      }
      
      if (!extractedSitemapId) {
        const urlParts = fullUrl.split('sitemap=');
        if (urlParts.length > 1) {
          const afterSitemap = urlParts[1].split(/[&\s#]/)[0];
          if (afterSitemap && afterSitemap.length >= 4) {
            extractedSitemapId = afterSitemap;
          }
        }
      }
      
      if (extractedSitemapId && extractedSitemapId.trim()) {
        return { mode: 'viewer', sitemapId: extractedSitemapId.trim() };
      }
    }
    
    return { mode: 'dashboard' };
  } catch (error) {
    console.error('Error parsing initial URL:', error);
    return { mode: 'dashboard' };
  }
}

function SitemapApp() {
  const [appState, setAppState] = useState<AppState>(() => getInitialAppState());
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize after a brief delay to ensure URL parsing is complete
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialized(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Handle URL routing
  useEffect(() => {
    const handleUrlChange = () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const hash = window.location.hash;
        const fullUrl = window.location.href;
        
        const mode = urlParams.get('mode');
        const sitemapId = urlParams.get('sitemap');
        
        // Enhanced viewer mode detection
        if (mode === 'view' && sitemapId) {
          setAppState({ mode: 'viewer', sitemapId: sitemapId.trim() });
          return;
        }
        
        if (mode === 'edit' && sitemapId) {
          setAppState({ mode: 'editor', sitemapId: sitemapId.trim() });
          return;
        }
        
        // Fallback to hash-based routing
        if (hash.startsWith('#/edit/')) {
          const hashSitemapId = hash.replace('#/edit/', '');
          if (hashSitemapId && hashSitemapId.trim()) {
            setAppState({ mode: 'editor', sitemapId: hashSitemapId.trim() });
          } else {
            setAppState({ mode: 'dashboard' });
          }
        } else if (hash.startsWith('#/view/')) {
          const hashSitemapId = hash.replace('#/view/', '');
          if (hashSitemapId && hashSitemapId.trim()) {
            setAppState({ mode: 'viewer', sitemapId: hashSitemapId.trim() });
          } else {
            setAppState({ mode: 'dashboard' });
          }
        } else {
          // Check for view mode in URL string as fallback
          if (fullUrl.includes('mode=view') || fullUrl.includes('mode%3Dview')) {
            let extractedSitemapId = urlParams.get('sitemap');
            
            if (!extractedSitemapId) {
              const sitemapMatch = fullUrl.match(/sitemap=([^&\s#]+)/);
              if (sitemapMatch) {
                extractedSitemapId = decodeURIComponent(sitemapMatch[1]);
              }
            }
            
            if (!extractedSitemapId) {
              const shortIdMatch = fullUrl.match(/sitemap=([A-Za-z0-9]{4,10})(?:[&\s#]|$)/);
              if (shortIdMatch) {
                extractedSitemapId = shortIdMatch[1];
              }
            }
            
            if (extractedSitemapId && extractedSitemapId.trim()) {
              setAppState({ mode: 'viewer', sitemapId: extractedSitemapId.trim() });
              return;
            }
          }
          
          setAppState({ mode: 'dashboard' });
        }
      } catch (error) {
        console.error('Error handling URL change:', error);
        setAppState({ mode: 'dashboard' });
      }
    };

    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  const handleOpenSitemap = (sitemapId: string) => {
    try {
      if (sitemapId && sitemapId.trim()) {
        const newUrl = `${window.location.origin}${window.location.pathname}?mode=edit&sitemap=${encodeURIComponent(sitemapId.trim())}`;
        window.history.pushState({}, '', newUrl);
        setAppState({ mode: 'editor', sitemapId: sitemapId.trim() });
      }
    } catch (error) {
      console.error('Error opening sitemap:', error);
    }
  };

  const handleBackToDashboard = () => {
    try {
      const newUrl = `${window.location.origin}${window.location.pathname}`;
      window.history.pushState({}, '', newUrl);
      setAppState({ mode: 'dashboard' });
    } catch (error) {
      console.error('Error navigating to dashboard:', error);
      setAppState({ mode: 'dashboard' });
    }
  };

  // Render based on current app state
  const renderContent = () => {
    try {
      if (appState.mode === 'editor') {
        return (
          <SitemapEditor 
            key={`editor-${appState.sitemapId}`}
            sitemapId={appState.sitemapId} 
            onBack={handleBackToDashboard}
            isViewOnly={false}
          />
        );
      }

      if (appState.mode === 'viewer') {
        return (
          <SitemapEditor 
            key={`viewer-${appState.sitemapId}`}
            sitemapId={appState.sitemapId} 
            onBack={handleBackToDashboard}
            isViewOnly={true}
          />
        );
      }

      // Dashboard mode (default)
      return (
        <>
          <SitePlanHeader />
          <Dashboard onOpenSitemap={handleOpenSitemap} />
        </>
      );
    } catch (error) {
      console.error('Error rendering content:', error);
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-4">
            <h2 className="text-xl mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4">Please try refreshing the page.</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
  };

  // Show loading state until initialization is complete
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // For viewer mode, render without authentication
  if (appState.mode === 'viewer') {
    return (
      <div className="min-h-screen bg-background text-foreground">
        {renderContent()}
        <Toaster 
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'hsl(var(--background))',
              color: 'hsl(var(--foreground))',
              border: '1px solid hsl(var(--border))',
            },
          }}
        />
      </div>
    );
  }

  // For editor and dashboard modes, wrap with authentication
  return (
    <AuthProvider>
      <AuthGuard>
        <div className="min-h-screen bg-background text-foreground">
          {renderContent()}
          <Toaster 
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                border: '1px solid hsl(var(--border))',
              },
            }}
          />
        </div>
      </AuthGuard>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SitemapApp />
    </ErrorBoundary>
  );
}