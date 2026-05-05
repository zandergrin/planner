import { useState, useCallback, useEffect } from 'react';
import { SitePlanSidebar, defaultPageTypes } from './SitePlanSidebar';
import { SiteMapCanvas } from './SiteMapCanvas';
import { PagePropertiesPanel } from './PagePropertiesPanel';
import { ShareDialog } from './ShareDialog';
import { ExportDialog } from './ExportDialog';
import { Button } from './ui/button';
import { ArrowLeft, Save, Share2, Eye, AlertCircle, Download } from 'lucide-react';
import { storage, Sitemap, SitePage, PageType, generateUniqueId } from '../utils/storage';
import { compressForUrl, decompressFromUrl } from '../utils/compression';
import { createShortUrl, getShortUrlData, isShortUrl } from '../utils/short-url-service';
import { toast } from "sonner";

interface SitemapEditorProps {
  sitemapId: string;
  onBack: () => void;
  isViewOnly?: boolean;
}

export function SitemapEditor({ sitemapId, onBack, isViewOnly = false }: SitemapEditorProps) {
  const [sitemap, setSitemap] = useState<Sitemap | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | undefined>();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Ensure defaultPageTypes is available and valid
  const safeDefaultPageTypes = defaultPageTypes && Array.isArray(defaultPageTypes) 
    ? defaultPageTypes 
    : [
        {
          id: 'home',
          name: 'Home Page',
          icon: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>,
          color: 'bg-blue-500',
          description: 'The main landing page of your website.',
          iconKey: 'home',
        },
        {
          id: 'content',
          name: 'Content Page',
          icon: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>,
          color: 'bg-green-500',
          description: 'A general content page with text and media.',
          iconKey: 'file',
        }
      ];

  // Load sitemap on mount
  useEffect(() => {
    console.log('📋 SitemapEditor loading sitemap:', { sitemapId, isViewOnly });
    
    const loadSitemap = async () => {
      try {
        // First try to load from localStorage/cloud storage
        let loadedSitemap = await storage.getSitemap(sitemapId);
        console.log('💾 Loaded from storage:', loadedSitemap ? 'Found' : 'Not found');
        
        // If not found and we're in view-only mode, try to decode from URL
        if (!loadedSitemap && isViewOnly) {
          console.log('🔍 Attempting to decode from URL...');
          
          try {
            // Check if this is a short URL (4-10 characters)
            if (isShortUrl(sitemapId)) {
              console.log('🔗 Detected short URL, looking up:', sitemapId);
              const shortUrlData = await getShortUrlData(sitemapId);
              
              if (shortUrlData) {
                console.log('✅ Found sitemap data from short URL');
                // Convert the serialized data back to a proper sitemap
                const deserializedSitemap = {
                  ...shortUrlData,
                  createdAt: new Date(shortUrlData.createdAt),
                  updatedAt: new Date(shortUrlData.updatedAt),
                  pages: shortUrlData.pages.map((page: any) => ({
                    ...page,
                    icon: getIconComponent(page.iconKey || 'file')
                  })),
                  pageTypes: shortUrlData.pageTypes.map((pageType: any) => ({
                    ...pageType,
                    icon: getIconComponent(pageType.iconKey || 'file')
                  }))
                };
                
                loadedSitemap = deserializedSitemap;
              } else {
                console.log('❌ Short URL not found in lookup table');
                if (isViewOnly) {
                  setLoadError('Short URL not found or expired');
                }
              }
            }
            // Check if this is legacy URL-encoded data
            else if (sitemapId.startsWith('data_')) {
              console.log('🔓 Decoding sitemap data from legacy URL');
              const encodedData = sitemapId.replace('data_', '');
              
              let decodedData: string;
              let sitemapData: any;
              
              // Try to decompress the data
              try {
                console.log('🔄 Trying compression decode...');
                decodedData = decompressFromUrl(encodedData);
                sitemapData = JSON.parse(decodedData);
                console.log('✅ Successfully decoded with compression');
              } catch (compressionError) {
                console.log('🔄 Compression decode failed, trying base64...');
                // Convert from URL-safe base64 and try regular decoding
                let base64 = encodedData
                  .replace(/-/g, '+')
                  .replace(/_/g, '/');
                
                while (base64.length % 4) {
                  base64 += '=';
                }
                
                try {
                  decodedData = atob(base64);
                  sitemapData = JSON.parse(decodedData);
                  console.log('✅ Successfully decoded with base64');
                } catch (base64Error) {
                  console.log('🔄 Base64 failed, trying UTF-8 decode...');
                  decodedData = decodeURIComponent(escape(atob(base64)));
                  sitemapData = JSON.parse(decodedData);
                  console.log('✅ Successfully decoded with UTF-8');
                }
              }
              
              // Convert the serialized data back to a proper sitemap
              const deserializedSitemap = {
                ...sitemapData,
                createdAt: new Date(sitemapData.createdAt),
                updatedAt: new Date(sitemapData.updatedAt),
                pages: sitemapData.pages.map((page: any) => ({
                  ...page,
                  icon: getIconComponent(page.iconKey || 'file')
                })),
                pageTypes: sitemapData.pageTypes.map((pageType: any) => ({
                  ...pageType,
                  icon: getIconComponent(pageType.iconKey || 'file')
                }))
              };
              
              loadedSitemap = deserializedSitemap;
              console.log('✅ Legacy sitemap decoded and ready to display');
            } else {
              console.log('❌ Unknown sitemap ID format:', sitemapId);
              if (isViewOnly) {
                setLoadError('Invalid share link format');
              }
            }
          } catch (decodeError) {
            console.error('❌ Failed to decode sitemap from URL:', decodeError);
            if (isViewOnly) {
              setLoadError('Failed to load shared sitemap. The link may be corrupted or invalid.');
            } else {
              toast.error('Failed to load shared sitemap. The link may be corrupted or invalid.');
            }
          }
        }
        
        if (loadedSitemap) {
          console.log('✅ Setting sitemap in state');
          // ALWAYS use the safeDefaultPageTypes instead of stored ones
          const updatedSitemap = {
            ...loadedSitemap,
            pageTypes: safeDefaultPageTypes
          };
          setSitemap(updatedSitemap);
          setSelectedPageId(loadedSitemap.selectedPageId);
        } else {
          console.log('❌ No sitemap found');
          if (isViewOnly) {
            // In view-only mode, show error instead of going back to dashboard
            setLoadError('Shared sitemap not found or could not be loaded');
            console.log('🔒 Staying in viewer mode with error message');
          } else {
            toast.error('Sitemap not found');
            onBack();
          }
        }
      } catch (error) {
        console.error('Error loading sitemap:', error);
        if (isViewOnly) {
          setLoadError('Error loading sitemap');
        } else {
          toast.error('Error loading sitemap');
          onBack();
        }
      }
    };

    loadSitemap();
  }, [sitemapId, onBack, isViewOnly, safeDefaultPageTypes]);

  // Helper function to get icon component
  const getIconComponent = (iconKey: string) => {
    const iconMap: any = {
      'home': <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>,
      'file': <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>,
      'mail': <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>,
      'info': <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>,
      'shopping': <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zM8 6v1h4V6a2 2 0 10-4 0z" clipRule="evenodd" /></svg>,
      'user': <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>,
      'search': <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>,
      'grid': <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
      'blocks': <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" /></svg>
    };
    return iconMap[iconKey] || iconMap['file'];
  };

  // Mark as having unsaved changes when data changes (only if not view-only)
  useEffect(() => {
    if (sitemap && !isViewOnly) {
      setHasUnsavedChanges(true);
    }
  }, [sitemap?.pages, sitemap?.pageTypes, sitemap?.rootPageOrder, sitemap?.collapsedGroups, sitemap?.zoom, isViewOnly]);

  const calculateTreeLayout = useCallback((pagesToLayout: SitePage[], rootOrder: string[], collapsedGroups: string[] = []) => {
    const CARD_WIDTH = 288;
    const CARD_HEIGHT = 95; // Increased from 80 to 95 to account for badge height
    const HORIZONTAL_SPACING = 50;
    const VERTICAL_SPACING = 120;
    const STACK_SPACING = 8; // 8px consistent spacing between all content stack elements
    const CANVAS_CENTER_X = 1000;
    const CANVAS_PADDING_Y = 50; // Reduced from 150 to 50 for tighter layout

    const updatedPages = [...pagesToLayout];

    const getLevel = (page: SitePage): number => {
      if (!page.parent) return 0;
      const parent = pagesToLayout.find(p => p.id === page.parent);
      if (!parent) return 0;
      return getLevel(parent) + 1;
    };

    // Helper function to check if a page has children (affects card height)
    const hasChildren = (pageId: string): boolean => {
      const page = pagesToLayout.find(p => p.id === pageId);
      return page ? page.children.length > 0 : false;
    };

    // Dynamic card height calculation based on whether page has children
    const getCardHeight = (pageId: string): number => {
      return hasChildren(pageId) ? CARD_HEIGHT : CARD_HEIGHT - 15; // Subtract badge height if no children
    };

    // Fixed getAllDescendants function to maintain proper order and prevent overlapping
    const getAllDescendants = (pageId: string): SitePage[] => {
      const descendants: SitePage[] = [];
      const queue: string[] = [pageId];
      const visited = new Set<string>();
      
      while (queue.length > 0) {
        const currentPageId = queue.shift()!;
        if (visited.has(currentPageId)) continue;
        visited.add(currentPageId);
        
        const currentPage = pagesToLayout.find(p => p.id === currentPageId);
        if (!currentPage) continue;
        
        // Add direct children to descendants (but not the parent itself)
        if (currentPageId !== pageId) {
          descendants.push(currentPage);
        }
        
        // Add children to queue in order
        const children = currentPage.children
          .map(childId => pagesToLayout.find(p => p.id === childId))
          .filter(Boolean) as SitePage[];
        
        children.forEach(child => {
          queue.push(child.id);
        });
      }
      
      // Sort descendants by level first, then by order within children arrays
      return descendants.sort((a, b) => {
        const levelA = getLevel(a);
        const levelB = getLevel(b);
        if (levelA !== levelB) return levelA - levelB;
        
        // Within same level, maintain parent's children order
        const parentA = pagesToLayout.find(p => p.id === a.parent);
        const parentB = pagesToLayout.find(p => p.id === b.parent);
        
        if (parentA && parentB && parentA.id === parentB.id) {
          return parentA.children.indexOf(a.id) - parentA.children.indexOf(b.id);
        }
        
        return 0;
      });
    };

    let currentY = CANVAS_PADDING_Y;

    // Level 0: Root level (Home-centered)
    const rootPages = pagesToLayout.filter(p => !p.parent);
    if (rootPages.length > 0) {
      let orderedSiblings = rootOrder
        .map(id => rootPages.find(p => p.id === id))
        .filter(Boolean) as SitePage[];
      
      const remainingPages = rootPages.filter(p => !rootOrder.includes(p.id));
      orderedSiblings = [...orderedSiblings, ...remainingPages];

      const homeIndex = orderedSiblings.findIndex(p => String(p.name).toLowerCase() === 'home');
      if (homeIndex !== -1) {
        const homePage = orderedSiblings[homeIndex];
        const leftPages = orderedSiblings.slice(0, homeIndex);
        const rightPages = orderedSiblings.slice(homeIndex + 1);
        
        const homeX = CANVAS_CENTER_X - CARD_WIDTH / 2;
        const homePageIndex = updatedPages.findIndex(p => p.id === homePage.id);
        if (homePageIndex !== -1) {
          updatedPages[homePageIndex] = { ...homePage, x: homeX, y: currentY };
        }

        leftPages.reverse().forEach((page, index) => {
          const pageIndex = updatedPages.findIndex(p => p.id === page.id);
          if (pageIndex !== -1) {
            const pageX = homeX - (index + 1) * (CARD_WIDTH + HORIZONTAL_SPACING);
            updatedPages[pageIndex] = { ...page, x: pageX, y: currentY };
          }
        });

        rightPages.forEach((page, index) => {
          const pageIndex = updatedPages.findIndex(p => p.id === page.id);
          if (pageIndex !== -1) {
            const pageX = homeX + CARD_WIDTH + HORIZONTAL_SPACING + index * (CARD_WIDTH + HORIZONTAL_SPACING);
            updatedPages[pageIndex] = { ...page, x: pageX, y: currentY };
          }
        });
      }
      
      // Use maximum card height for level spacing to ensure consistency
      currentY += CARD_HEIGHT + VERTICAL_SPACING;
    }

    // Level 1: Second tier
    const secondTierPages = pagesToLayout.filter(p => {
      if (!p.parent) return false;
      const parent = pagesToLayout.find(parent => parent.id === p.parent);
      return parent && !parent.parent;
    });

    if (secondTierPages.length > 0) {
      const orderedSecondTier: SitePage[] = [];
      
      const rootPages = pagesToLayout.filter(p => !p.parent);
      rootOrder.forEach(rootId => {
        const rootPage = rootPages.find(p => p.id === rootId);
        if (rootPage && rootPage.children.length > 0) {
          rootPage.children.forEach(childId => {
            const childPage = secondTierPages.find(p => p.id === childId);
            if (childPage) {
              orderedSecondTier.push(childPage);
            }
          });
        }
      });

      secondTierPages.forEach(page => {
        if (!orderedSecondTier.find(p => p.id === page.id)) {
          orderedSecondTier.push(page);
        }
      });

      const totalWidth = orderedSecondTier.length * CARD_WIDTH + (orderedSecondTier.length - 1) * HORIZONTAL_SPACING;
      const startX = CANVAS_CENTER_X - totalWidth / 2;

      orderedSecondTier.forEach((page, index) => {
        const pageIndex = updatedPages.findIndex(p => p.id === page.id);
        if (pageIndex !== -1) {
          const pageX = startX + index * (CARD_WIDTH + HORIZONTAL_SPACING);
          updatedPages[pageIndex] = { ...page, x: pageX, y: currentY };
        }
      });

      // Create content stacks with proper spacing
      orderedSecondTier.forEach((secondTierPage) => {
        const descendants = getAllDescendants(secondTierPage.id);
        
        if (descendants.length > 0) {
          const isCollapsed = collapsedGroups.includes(secondTierPage.id);
          
          if (!isCollapsed) {
            const updatedSecondTierPage = updatedPages.find(p => p.id === secondTierPage.id);
            if (!updatedSecondTierPage) return;
            
            const stackX = updatedSecondTierPage.x;
            let currentStackY = currentY + CARD_HEIGHT + STACK_SPACING;
            
            descendants.forEach((descendant) => {
              const pageIndex = updatedPages.findIndex(p => p.id === descendant.id);
              if (pageIndex !== -1) {
                const level = getLevel(descendant);
                const indent = level === 2 ? 20 : 20 + (level - 2) * 20;
                
                updatedPages[pageIndex] = { 
                  ...descendant, 
                  x: stackX + indent, 
                  y: currentStackY 
                };
                
                // Use dynamic card height but ensure minimum spacing
                const cardHeight = getCardHeight(descendant.id);
                currentStackY += Math.max(cardHeight, CARD_HEIGHT - 15) + STACK_SPACING;
              }
            });
          }
        }
      });
    }

    return updatedPages;
  }, []);

  // Helper function to get default page type (Content Page)
  const getDefaultPageType = () => {
    // Always use safeDefaultPageTypes - find "Content Page"
    const contentPageType = safeDefaultPageTypes.find(pt => pt.id === 'content');
    if (contentPageType) return contentPageType;
    
    // Final fallback to first available page type
    return safeDefaultPageTypes[0];
  };

  const handleSave = useCallback(async () => {
    if (!sitemap || isViewOnly) {
      if (isViewOnly) {
        toast.error('Cannot save in view-only mode');
      }
      return;
    }

    try {
      const updatedSitemap = {
        ...sitemap,
        selectedPageId,
        collapsedGroups: Array.from(new Set(sitemap.collapsedGroups))
      };
      await storage.saveSitemap(updatedSitemap);
      setHasUnsavedChanges(false);
      toast.success('Sitemap saved');
    } catch (error) {
      console.error('Error saving sitemap:', error);
      toast.error('Failed to save sitemap');
    }
  }, [sitemap, selectedPageId, isViewOnly]);

  // Auto-save functionality (only if not view-only)
  useEffect(() => {
    if (!sitemap || !hasUnsavedChanges || isViewOnly) return;

    const autoSaveTimeout = setTimeout(() => {
      handleSave();
    }, 2000);

    return () => clearTimeout(autoSaveTimeout);
  }, [hasUnsavedChanges, isViewOnly, sitemap, handleSave]);

  const generateShareUrls = () => {
    if (!sitemap) return { fullUrl: '', compressedUrl: '' };
    
    const generateUrls = async () => {
      try {
        console.log('🔗 Creating share URLs for sitemap:', sitemap.name);
        
        // Create ultra-short URL (6-8 characters)
        const shortUrl = await createShortUrl(sitemap);
        
        console.log('📊 URL lengths:');
        console.log('  Ultra-short URL:', shortUrl.length, 'characters');
        
        // Return the short URL for both (since it's our primary method)
        return { 
          fullUrl: shortUrl,
          compressedUrl: shortUrl
        };
      } catch (error) {
        console.error('❌ Error creating short URL, falling back to legacy method:', error);
        
        // Fallback to legacy URL encoding if short URL service fails
        try {
          const shareableData = {
            id: sitemap.id,
            name: sitemap.name,
            description: sitemap.description,
            createdAt: sitemap.createdAt.toISOString(),
            updatedAt: sitemap.updatedAt.toISOString(),
            pages: sitemap.pages.map(page => ({
              ...page,
              icon: undefined,
              iconKey: (page as any).iconKey || 'file'
            })),
            pageTypes: sitemap.pageTypes.map(pageType => ({
              ...pageType,
              icon: undefined,
              iconKey: pageType.iconKey || 'file'
            })),
            rootPageOrder: sitemap.rootPageOrder,
            collapsedGroups: sitemap.collapsedGroups,
            zoom: sitemap.zoom,
            selectedPageId: sitemap.selectedPageId
          };
          
          const baseUrl = `${window.location.origin}${window.location.pathname}`;
          const jsonData = JSON.stringify(shareableData);
          const encodedData = compressForUrl(jsonData);
          const fallbackUrl = `${baseUrl}?mode=view&sitemap=${encodeURIComponent('data_' + encodedData)}`;
          
          console.log('🔄 Created fallback URL:', fallbackUrl.length, 'characters');
          
          return {
            fullUrl: fallbackUrl,
            compressedUrl: fallbackUrl
          };
        } catch (fallbackError) {
          console.error('❌ Fallback URL creation also failed:', fallbackError);
          toast.error('Failed to create share URL');
          return { fullUrl: '', compressedUrl: '' };
        }
      }
    };

    // Return a promise that resolves to the URLs
    return generateUrls();
  };

  const handleShare = () => {
    setShowShareDialog(true);
  };

  const handleExport = () => {
    setShowExportDialog(true);
  };

  const updateSitemap = useCallback((updates: Partial<Sitemap>) => {
    if (!sitemap) return;
    
    // Allow zoom changes even in view-only mode
    if (isViewOnly && Object.keys(updates).length === 1 && 'zoom' in updates) {
      setSitemap({ ...sitemap, ...updates });
      return;
    }
    
    if (isViewOnly) {
      toast.error('Cannot edit in view-only mode');
      return;
    }
    
    setSitemap({ ...sitemap, ...updates });
  }, [sitemap, isViewOnly]);

  const handleZoomChange = (newZoom: number) => {
    let finalZoom = newZoom;
    const DETENT_THRESHOLD = 0.05;
    
    if (Math.abs(newZoom - 1.0) < DETENT_THRESHOLD) {
      finalZoom = 1.0;
    }
    
    updateSitemap({ zoom: Math.max(0.25, Math.min(3, finalZoom)) });
  };

  const handleToggleCollapse = (parentId: string) => {
    if (!sitemap || isViewOnly) return; // Disable in view-only mode
    
    const newCollapsedGroups = [...sitemap.collapsedGroups];
    const index = newCollapsedGroups.indexOf(parentId);
    
    if (index >= 0) {
      newCollapsedGroups.splice(index, 1);
    } else {
      newCollapsedGroups.push(parentId);
    }
    
    updateSitemap({ collapsedGroups: newCollapsedGroups });
  };

  // All edit handlers - disabled in view-only mode
  const handleAddPage = (pageType: PageType) => {
    if (isViewOnly) {
      toast.error('Cannot add pages in view-only mode');
      return;
    }
    if (!sitemap) return;
    
    const newPage: SitePage = {
      id: generateUniqueId('page'),
      name: String(pageType.name),
      icon: pageType.icon,
      color: String(pageType.color),
      x: 200,
      y: 100,
      children: [],
      pageType: pageType.id
    };
    
    (newPage as any).iconKey = pageType.iconKey || 'file';
    
    const newPages = [...sitemap.pages, newPage];
    const newRootOrder = [...sitemap.rootPageOrder, newPage.id];
    
    updateSitemap({
      pages: calculateTreeLayout(newPages, newRootOrder, sitemap.collapsedGroups),
      rootPageOrder: newRootOrder
    });
    
    setSelectedPageId(newPage.id);
  };

  const handleUpdatePage = (id: string, updates: Partial<SitePage>) => {
    if (isViewOnly) {
      toast.error('Cannot edit pages in view-only mode');
      return;
    }
    if (!sitemap) return;
    
    const updatedPages = sitemap.pages.map(page => 
      page.id === id ? { ...page, ...updates } : page
    );
    
    updateSitemap({ 
      pages: calculateTreeLayout(updatedPages, sitemap.rootPageOrder, sitemap.collapsedGroups)
    });
  };

  const handleDeletePage = (id: string) => {
    if (isViewOnly) {
      toast.error('Cannot delete pages in view-only mode');
      return;
    }
    if (!sitemap) return;
    
    const pageToDelete = sitemap.pages.find(p => p.id === id);
    if (!pageToDelete) return;

    if (String(pageToDelete.name).toLowerCase() === 'home') {
      toast.error('Cannot delete the Home page');
      return;
    }

    let updatedPages = sitemap.pages.filter(p => p.id !== id);
    let updatedRootOrder = sitemap.rootPageOrder.filter(rid => rid !== id);

    if (pageToDelete.parent) {
      updatedPages = updatedPages.map(page => {
        if (page.id === pageToDelete.parent) {
          return {
            ...page,
            children: page.children.filter(childId => childId !== id)
          };
        }
        return page;
      });
    }

    const childrenToReassign = pageToDelete.children;
    if (childrenToReassign.length > 0) {
      if (pageToDelete.parent) {
        const parentPage = updatedPages.find(p => p.id === pageToDelete.parent);
        if (parentPage) {
          const updatedParent = {
            ...parentPage,
            children: [...parentPage.children, ...childrenToReassign]
          };
          updatedPages = updatedPages.map(p => 
            p.id === parentPage.id ? updatedParent : p
          );
        }
        
        updatedPages = updatedPages.map(page => {
          if (childrenToReassign.includes(page.id)) {
            return { ...page, parent: pageToDelete.parent };
          }
          return page;
        });
      } else {
        updatedRootOrder = [...updatedRootOrder, ...childrenToReassign];
        
        updatedPages = updatedPages.map(page => {
          if (childrenToReassign.includes(page.id)) {
            const { parent, ...pageWithoutParent } = page;
            return pageWithoutParent as SitePage;
          }
          return page;
        });
      }
    }

    updateSitemap({
      pages: calculateTreeLayout(updatedPages, updatedRootOrder, sitemap.collapsedGroups),
      rootPageOrder: updatedRootOrder
    });

    if (selectedPageId === id) {
      setSelectedPageId(undefined);
    }
  };

  const handleAddChildPage = (parentId: string) => {
    if (isViewOnly) {
      toast.error('Cannot add pages in view-only mode');
      return;
    }
    if (!sitemap) return;

    const defaultPageType = getDefaultPageType();
    const newPage: SitePage = {
      id: generateUniqueId('page'),
      name: String(defaultPageType.name),
      icon: defaultPageType.icon,
      color: String(defaultPageType.color),
      x: 200,
      y: 100,
      children: [],
      parent: parentId,
      pageType: defaultPageType.id
    };
    
    (newPage as any).iconKey = defaultPageType.iconKey || 'file';

    const updatedPages = [...sitemap.pages, newPage];
    const updatedPagesWithChildren = updatedPages.map(page => {
      if (page.id === parentId) {
        return {
          ...page,
          children: [...page.children, newPage.id]
        };
      }
      return page;
    });

    updateSitemap({
      pages: calculateTreeLayout(updatedPagesWithChildren, sitemap.rootPageOrder, sitemap.collapsedGroups)
    });

    setSelectedPageId(newPage.id);
  };

  const handleAddSiblingPage = (siblingId: string) => {
    if (isViewOnly) {
      toast.error('Cannot add pages in view-only mode');
      return;
    }
    if (!sitemap) return;

    const siblingPage = sitemap.pages.find(p => p.id === siblingId);
    if (!siblingPage) return;

    const defaultPageType = getDefaultPageType();
    const newPage: SitePage = {
      id: generateUniqueId('page'),
      name: String(defaultPageType.name),
      icon: defaultPageType.icon,
      color: String(defaultPageType.color),
      x: 200,
      y: 100,
      children: [],
      parent: siblingPage.parent,
      pageType: defaultPageType.id
    };
    
    (newPage as any).iconKey = defaultPageType.iconKey || 'file';

    const updatedPages = [...sitemap.pages, newPage];
    
    if (siblingPage.parent) {
      const updatedPagesWithChildren = updatedPages.map(page => {
        if (page.id === siblingPage.parent) {
          const siblingIndex = page.children.indexOf(siblingId);
          const newChildren = [...page.children];
          newChildren.splice(siblingIndex + 1, 0, newPage.id);
          return {
            ...page,
            children: newChildren
          };
        }
        return page;
      });

      updateSitemap({
        pages: calculateTreeLayout(updatedPagesWithChildren, sitemap.rootPageOrder, sitemap.collapsedGroups)
      });
    } else {
      const siblingIndex = sitemap.rootPageOrder.indexOf(siblingId);
      const newRootOrder = [...sitemap.rootPageOrder];
      newRootOrder.splice(siblingIndex + 1, 0, newPage.id);

      updateSitemap({
        pages: calculateTreeLayout(updatedPages, newRootOrder, sitemap.collapsedGroups),
        rootPageOrder: newRootOrder
      });
    }

    setSelectedPageId(newPage.id);
  };

  const handleAddLeftOfHome = () => {
    if (isViewOnly) {
      toast.error('Cannot add pages in view-only mode');
      return;
    }
    if (!sitemap) return;

    const homePage = sitemap.pages.find(p => String(p.name).toLowerCase() === 'home');
    if (!homePage) return;

    const defaultPageType = getDefaultPageType();
    const newPage: SitePage = {
      id: generateUniqueId('page'),
      name: String(defaultPageType.name),
      icon: defaultPageType.icon,
      color: String(defaultPageType.color),
      x: 200,
      y: 100,
      children: [],
      pageType: defaultPageType.id
    };
    
    (newPage as any).iconKey = defaultPageType.iconKey || 'file';

    const updatedPages = [...sitemap.pages, newPage];
    const homeIndex = sitemap.rootPageOrder.indexOf(homePage.id);
    const newRootOrder = [...sitemap.rootPageOrder];
    newRootOrder.splice(homeIndex, 0, newPage.id);

    updateSitemap({
      pages: calculateTreeLayout(updatedPages, newRootOrder, sitemap.collapsedGroups),
      rootPageOrder: newRootOrder
    });

    setSelectedPageId(newPage.id);
  };

  const handleAddRightOfHome = () => {
    if (isViewOnly) {
      toast.error('Cannot add pages in view-only mode');
      return;
    }
    if (!sitemap) return;

    const homePage = sitemap.pages.find(p => String(p.name).toLowerCase() === 'home');
    if (!homePage) return;

    const defaultPageType = getDefaultPageType();
    const newPage: SitePage = {
      id: generateUniqueId('page'),
      name: String(defaultPageType.name),
      icon: defaultPageType.icon,
      color: String(defaultPageType.color),
      x: 200,
      y: 100,
      children: [],
      pageType: defaultPageType.id
    };
    
    (newPage as any).iconKey = defaultPageType.iconKey || 'file';

    const updatedPages = [...sitemap.pages, newPage];
    const homeIndex = sitemap.rootPageOrder.indexOf(homePage.id);
    const newRootOrder = [...sitemap.rootPageOrder];
    newRootOrder.splice(homeIndex + 1, 0, newPage.id);

    updateSitemap({
      pages: calculateTreeLayout(updatedPages, newRootOrder, sitemap.collapsedGroups),
      rootPageOrder: newRootOrder
    });

    setSelectedPageId(newPage.id);
  };

  const handleDragReorder = (draggedPageId: string, targetPageId: string | null, dropPosition: 'before' | 'after' | 'child' | 'root') => {
    if (isViewOnly) {
      toast.error('Cannot reorder pages in view-only mode');
      return;
    }
    if (!sitemap) return;

    const draggedPage = sitemap.pages.find(p => p.id === draggedPageId);
    if (!draggedPage) return;

    if (String(draggedPage.name).toLowerCase() === 'home' && dropPosition !== 'root') {
      toast.error('Home page must remain at the root level');
      return;
    }

    let updatedPages = [...sitemap.pages];
    let updatedRootOrder = [...sitemap.rootPageOrder];

    if (draggedPage.parent) {
      updatedPages = updatedPages.map(page => {
        if (page.id === draggedPage.parent) {
          return {
            ...page,
            children: page.children.filter(childId => childId !== draggedPageId)
          };
        }
        return page;
      });
    } else {
      updatedRootOrder = updatedRootOrder.filter(id => id !== draggedPageId);
    }

    if (dropPosition === 'root') {
      const { parent, ...draggedWithoutParent } = draggedPage;
      updatedPages = updatedPages.map(p => 
        p.id === draggedPageId ? draggedWithoutParent as SitePage : p
      );
      updatedRootOrder.push(draggedPageId);
    } else if (targetPageId) {
      const targetPage = sitemap.pages.find(p => p.id === targetPageId);
      if (!targetPage) return;

      if (dropPosition === 'child') {
        const updatedDraggedPage = {
          ...draggedPage,
          parent: targetPageId
        };
        updatedPages = updatedPages.map(p => 
          p.id === draggedPageId ? updatedDraggedPage : p
        );

        updatedPages = updatedPages.map(page => {
          if (page.id === targetPageId) {
            return {
              ...page,
              children: [...page.children, draggedPageId]
            };
          }
          return page;
        });
      } else {
        const updatedDraggedPage = {
          ...draggedPage,
          parent: targetPage.parent
        };
        updatedPages = updatedPages.map(p => 
          p.id === draggedPageId ? updatedDraggedPage : p
        );

        if (targetPage.parent) {
          updatedPages = updatedPages.map(page => {
            if (page.id === targetPage.parent) {
              const targetIndex = page.children.indexOf(targetPageId);
              const insertIndex = dropPosition === 'before' ? targetIndex : targetIndex + 1;
              const newChildren = [...page.children];
              newChildren.splice(insertIndex, 0, draggedPageId);
              return {
                ...page,
                children: newChildren
              };
            }
            return page;
          });
        } else {
          const targetIndex = updatedRootOrder.indexOf(targetPageId);
          const insertIndex = dropPosition === 'before' ? targetIndex : targetIndex + 1;
          updatedRootOrder.splice(insertIndex, 0, draggedPageId);
        }
      }
    }

    updateSitemap({
      pages: calculateTreeLayout(updatedPages, updatedRootOrder, sitemap.collapsedGroups),
      rootPageOrder: updatedRootOrder
    });
  };

  if (loadError) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto px-6">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl">Unable to Load Sitemap</h2>
          <p className="text-muted-foreground">{loadError}</p>
          <Button onClick={onBack} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!sitemap) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading sitemap...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      {!isViewOnly && (
        <SitePlanSidebar
          pageTypes={sitemap.pageTypes}
          onAddPage={handleAddPage}
          selectedPageId={selectedPageId}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col h-full">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
          <div className="flex items-center justify-between h-14 px-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-lg leading-6">{sitemap.name}</h1>
                {sitemap.description && (
                  <p className="text-sm text-muted-foreground">{sitemap.description}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {isViewOnly && (
                <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-full">
                  <Eye className="h-4 w-4" />
                  <span className="text-sm">View Only</span>
                </div>
              )}
              
              {!isViewOnly && hasUnsavedChanges && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                  Auto-saving...
                </div>
              )}
              
              {!isViewOnly && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSave}
                  disabled={!hasUnsavedChanges}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              )}
              
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Canvas and Properties */}
        <div className="flex-1 flex">
          {/* Main Canvas */}
          <div className="flex-1 relative">
            <SiteMapCanvas
              pages={sitemap.pages}
              onUpdatePage={handleUpdatePage}
              onDeletePage={handleDeletePage}
              onSelectPage={setSelectedPageId}
              onAddChildPage={handleAddChildPage}
              onAddSiblingPage={handleAddSiblingPage}
              onDragReorder={handleDragReorder}
              onAddLeftOfHome={handleAddLeftOfHome}
              onAddRightOfHome={handleAddRightOfHome}
              selectedPageId={selectedPageId}
              rootPageOrder={sitemap.rootPageOrder}
              collapsedGroups={new Set(sitemap.collapsedGroups)}
              onToggleCollapse={handleToggleCollapse}
              zoom={sitemap.zoom}
              onZoomChange={handleZoomChange}
              pageTypes={sitemap.pageTypes}
              isViewOnly={isViewOnly}
            />
          </div>

          {/* Properties Panel */}
          {selectedPageId && !isViewOnly && (
            <PagePropertiesPanel
              page={sitemap.pages.find(p => p.id === selectedPageId)}
              pageTypes={sitemap.pageTypes}
              onUpdatePage={handleUpdatePage}
              onClose={() => setSelectedPageId(undefined)}
            />
          )}
        </div>
      </div>

      {/* Share Dialog */}
      <ShareDialog
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        sitemap={sitemap}
        onGenerateUrls={generateShareUrls}
      />

      {/* Export Dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        sitemap={sitemap}
      />
    </div>
  );
}