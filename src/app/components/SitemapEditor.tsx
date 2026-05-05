import { useState, useCallback, useEffect, useRef } from 'react';
import { SitePlanSidebar, defaultPageTypes } from './SitePlanSidebar';
import { SiteMapCanvas } from './SiteMapCanvas';
import { PagePropertiesPanel, PagePropertiesPanelRef } from './PagePropertiesPanel';
import { ShareDialog } from './ShareDialog';
import { ExportDialog } from './ExportDialog';
import { VersionManager } from './VersionManager';
import { BuildNumber } from './BuildNumber';
import { SaveStatusIndicator } from './SaveStatusIndicator';
import { Button } from './ui/button';
import { ArrowLeft, Save, Share2, Eye, AlertCircle, Download, GitBranch, Loader2 } from 'lucide-react';
import type { Sitemap, SitePage, PageType, SitemapVersion } from '../utils/storage';
import { storage, generateUniqueId } from '../utils/storage';
import { compressForUrl, decompressFromUrl } from '../utils/compression';
import { createSimpleShortUrl, resolveShortUrlToSitemap, isShortUrl } from '../utils/simple-url-routing';
import { toast } from "sonner";
import { getAllCommentsForSitemap } from '../utils/cloud-storage';
import { createSitemapDataHash } from '../utils/change-detection';

// Helper function to find the homepage (root page with no parent)
const getHomePage = (pages: SitePage[]): SitePage | undefined => {
  return pages.find(p => !p.parent || p.parent === '' || p.parent === null);
};

interface SitemapEditorProps {
  sitemapId: string;
  onBack: () => void;
  isViewOnly?: boolean;
}

export function SitemapEditor({ sitemapId, onBack, isViewOnly = false }: SitemapEditorProps) {
  const [sitemap, setSitemap] = useState<Sitemap | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | undefined>();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cachedShareUrls, setCachedShareUrls] = useState<{ fullUrl: string; compressedUrl: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [centerOnPageId, setCenterOnPageId] = useState<string | undefined>();
  const [showVersionManager, setShowVersionManager] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | undefined>();
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  
  const propertiesPanelRef = useRef<PagePropertiesPanelRef>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sitemapRef = useRef<Sitemap | null>(null);
  const selectedPageIdRef = useRef<string | undefined>();
  const lastSavedDataHashRef = useRef<string>('');
  
  // Keep refs in sync with state
  useEffect(() => {
    sitemapRef.current = sitemap;
    selectedPageIdRef.current = selectedPageId;
  }, [sitemap, selectedPageId]);
  
  const selectedPage = sitemap?.pages.find(page => page.id === selectedPageId) || 
                      sitemap?.footerPages?.find(page => page.id === selectedPageId) || null;

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
    const loadSitemap = async () => {
      console.log('🔍 [DEBUG] Starting sitemap load:', sitemapId);
      try {
        // First try to load from localStorage/cloud storage
        let loadedSitemap = await storage.getSitemap(sitemapId);
        console.log('🔍 [DEBUG] Loaded from storage:', loadedSitemap ? 'SUCCESS' : 'NOT FOUND');
        
        // If not found and we're in view-only mode, try to decode from URL
        if (!loadedSitemap && isViewOnly) {
          try {
            // Check if this is a short URL (4-10 characters)
            if (isShortUrl(sitemapId)) {
              const resolvedSitemapData = await resolveShortUrlToSitemap(sitemapId);
              
              if (resolvedSitemapData) {
                // Convert the serialized data back to a proper sitemap
                const deserializedSitemap = {
                  ...resolvedSitemapData,
                  createdAt: new Date(resolvedSitemapData.createdAt),
                  updatedAt: new Date(resolvedSitemapData.updatedAt),
                  pages: resolvedSitemapData.pages.map((page: any) => ({
                    ...page,
                    icon: getIconComponent(page.iconKey || 'file')
                  })),
                  pageTypes: resolvedSitemapData.pageTypes.map((pageType: any) => ({
                    ...pageType,
                    name: String(pageType.name),
                    icon: getIconComponent(pageType.iconKey || 'file')
                  }))
                };
                
                loadedSitemap = deserializedSitemap;
              } else {
                if (isViewOnly) {
                  setLoadError('Short URL not found or expired');
                }
              }
            }
            // Check if this is legacy URL-encoded data
            else if (sitemapId.startsWith('data_')) {
              const encodedData = sitemapId.replace('data_', '');
              
              let decodedData: string;
              let sitemapData: any;
              
              // Try to decompress the data
              try {
                decodedData = decompressFromUrl(encodedData);
                sitemapData = JSON.parse(decodedData);
              } catch (compressionError) {
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
                } catch (base64Error) {
                  decodedData = decodeURIComponent(escape(atob(base64)));
                  sitemapData = JSON.parse(decodedData);
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
                  name: String(pageType.name),
                  icon: getIconComponent(pageType.iconKey || 'file')
                }))
              };
              
              loadedSitemap = deserializedSitemap;
            } else {
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
          // Check if there's a version parameter in the URL
          const urlParams = new URLSearchParams(window.location.search);
          const requestedVersion = urlParams.get('v');
          
          // If a specific version is requested and exists, switch to it
          if (requestedVersion && loadedSitemap.versions) {
            const targetVersion = loadedSitemap.versions.find(v => v.versionNumber === requestedVersion);
            if (targetVersion) {
              // Restore the sitemap state from the version snapshot
              loadedSitemap = {
                ...loadedSitemap,
                currentVersion: requestedVersion,
                pages: targetVersion.pages.map(page => ({
                  ...page,
                  icon: getIconComponent(page.iconKey || 'file'),
                })),
                pageTypes: targetVersion.pageTypes.map(pt => ({
                  ...pt,
                  name: String(pt.name),
                  icon: getIconComponent(pt.iconKey || 'file'),
                })),
                rootPageOrder: targetVersion.rootPageOrder,
                collapsedGroups: targetVersion.collapsedGroups,
                zoom: targetVersion.zoom,
                footerPages: targetVersion.footerPages?.map(page => ({
                  ...page,
                  icon: getIconComponent(page.iconKey || 'file'),
                })),
              };
            }
          }
          
          // Merge stored page types with safe defaults, prioritizing stored ones
          const mergedPageTypes = [...safeDefaultPageTypes];
          
          // Add any stored page types that aren't already in the defaults
          if (loadedSitemap.pageTypes && Array.isArray(loadedSitemap.pageTypes)) {
            loadedSitemap.pageTypes.forEach(storedType => {
              if (!mergedPageTypes.find(pt => pt.id === storedType.id)) {
                mergedPageTypes.push(storedType);
              }
            });
          }
          
          const updatedSitemap = {
            ...loadedSitemap,
            pageTypes: mergedPageTypes
          };
          console.log('🔍 [DEBUG] Setting sitemap with', updatedSitemap.pages?.length || 0, 'pages');
          setSitemap(updatedSitemap);
          setSelectedPageId(loadedSitemap.selectedPageId);
        } else {
          console.log('🔍 [DEBUG] No sitemap loaded!');
          if (isViewOnly) {
            // In view-only mode, show error instead of going back to dashboard
            setLoadError('Shared sitemap not found or could not be loaded');
          } else {
            toast.error('Sitemap not found');
            handleBack();
          }
        }
      } catch (error) {
        console.error('🔍 [DEBUG] Error loading sitemap:', error);
        if (isViewOnly) {
          setLoadError('Error loading sitemap');
        } else {
          toast.error('Error loading sitemap');
          handleBack();
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

  // Load all comments once and build a count map
  useEffect(() => {
    const loadCommentCounts = async () => {
      if (!sitemap) return;
      
      try {
        // Load all comments in a single API call
        const allComments = await getAllCommentsForSitemap(sitemap.id);
        
        // Build a map of pageId -> comment count
        const counts: Record<string, number> = {};
        allComments.forEach(comment => {
          counts[comment.pageId] = (counts[comment.pageId] || 0) + 1;
        });
        
        setCommentCounts(counts);
      } catch (error) {
        console.error('Error loading comment counts:', error);
        setCommentCounts({});
      }
    };

    loadCommentCounts();
  }, [sitemap?.id]);

  // Smart change detection using hash-based comparison (only if not view-only)
  useEffect(() => {
    if (sitemap && !isViewOnly) {
      const currentHash = createSitemapDataHash(sitemap);
      
      // Only mark as unsaved if actual data changed (not just UI state)
      if (currentHash !== lastSavedDataHashRef.current && lastSavedDataHashRef.current !== '') {
        setHasUnsavedChanges(true);
      }
    }
  }, [sitemap, isViewOnly]);

  const calculateTreeLayout = useCallback((pagesToLayout: SitePage[], rootOrder: string[], collapsedGroups: string[] = []) => {
    const CARD_WIDTH = 288;
    const CARD_HEIGHT = 95;
    const HORIZONTAL_SPACING = 32;
    const VERTICAL_SPACING = 120;
    const STACK_SPACING = 8;
    const CANVAS_CENTER_X = 1000;
    const CANVAS_PADDING_Y = 50;

    const updatedPages = [...pagesToLayout];

    const getLevel = (page: SitePage): number => {
      if (!page.parent) return 0;
      const parent = pagesToLayout.find(p => p.id === page.parent);
      if (!parent) return 0;
      return getLevel(parent) + 1;
    };

    const hasChildren = (pageId: string): boolean => {
      const page = pagesToLayout.find(p => p.id === pageId);
      return page ? page.children.length > 0 : false;
    };

    const getCardHeight = (pageId: string): number => {
      return hasChildren(pageId) ? CARD_HEIGHT : CARD_HEIGHT - 15;
    };

    // NEW: Build a hierarchical tree structure to process children properly
    const buildPageTree = (parentId: string | null = null): { page: SitePage; children: any[] }[] => {
      const directChildren = pagesToLayout.filter(p => p.parent === parentId);
      return directChildren.map(page => ({
        page,
        children: buildPageTree(page.id)
      }));
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

      const homePageInSiblings = getHomePage(orderedSiblings);
      const homeIndex = homePageInSiblings ? orderedSiblings.findIndex(p => p.id === homePageInSiblings.id) : -1;
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

      // NEW: Process each content stack individually to maintain proper parent-child relationships
      orderedSecondTier.forEach((secondTierPage) => {
        const isCollapsed = collapsedGroups.includes(secondTierPage.id);
        
        if (!isCollapsed) {
          const updatedSecondTierPage = updatedPages.find(p => p.id === secondTierPage.id);
          if (!updatedSecondTierPage) return;
          
          const stackX = updatedSecondTierPage.x;
          let currentStackY = currentY + CARD_HEIGHT + STACK_SPACING;
          
          // NEW: Process children in a tree-like manner to maintain groupings
          const processChildren = (parentId: string, indentLevel: number = 2) => {
            const children = pagesToLayout
              .filter(p => p.parent === parentId)
              .sort((a, b) => {
                const parent = pagesToLayout.find(p => p.id === parentId);
                if (!parent) return 0;
                return parent.children.indexOf(a.id) - parent.children.indexOf(b.id);
              });

            children.forEach(child => {
              const pageIndex = updatedPages.findIndex(p => p.id === child.id);
              if (pageIndex !== -1) {
                const indent = indentLevel === 2 ? 20 : 20 + (indentLevel - 2) * 20;
                
                updatedPages[pageIndex] = { 
                  ...child, 
                  x: stackX + indent, 
                  y: currentStackY 
                };
                
                const cardHeight = getCardHeight(child.id);
                currentStackY += Math.max(cardHeight, CARD_HEIGHT - 15) + STACK_SPACING;
                
                // Recursively process this child's children
                if (child.children.length > 0) {
                  processChildren(child.id, indentLevel + 1);
                }
              }
            });
          };
          
          // Start processing from the second-tier page
          processChildren(secondTierPage.id);
        }
      });
    }

    return updatedPages;
  }, []);

  // Helper function to get default page type (Content Page)
  const getDefaultPageType = () => {
    if (!sitemap) return safeDefaultPageTypes[0];
    
    // Use sitemap's page types - find "Content Page"
    const contentPageType = sitemap.pageTypes.find(pt => pt.id === 'content');
    if (contentPageType) return contentPageType;
    
    // Final fallback to first available page type
    return sitemap.pageTypes[0] || safeDefaultPageTypes[0];
  };

  const handleSave = useCallback(async () => {
    savePendingPropertyChangesImmediate();
    const currentSitemap = sitemapRef.current;
    const currentSelectedPageId = selectedPageIdRef.current;
    
    if (!currentSitemap || isViewOnly) {
      if (isViewOnly) {
        toast.error('Cannot save in view-only mode');
      }
      return;
    }

    setIsSaving(true);
    try {
      const updatedSitemap = {
        ...currentSitemap,
        selectedPageId: currentSelectedPageId,
        collapsedGroups: Array.from(new Set(currentSitemap.collapsedGroups))
      };
      await storage.saveSitemap(updatedSitemap);
      
      // Update hash after successful save
      const savedHash = createSitemapDataHash(updatedSitemap);
      lastSavedDataHashRef.current = savedHash;
      
      setHasUnsavedChanges(false);
      setLastSavedAt(new Date());
      toast.success('Sitemap saved');
    } catch (error) {
      console.error('Error saving sitemap:', error);
      toast.error('Failed to save sitemap');
    } finally {
      setIsSaving(false);
    }
  }, [isViewOnly]);

  // Auto-save functionality with smart debouncing (only if not view-only)
  useEffect(() => {
    if (!sitemap || !hasUnsavedChanges || isViewOnly || isSaving) return;

    // Debounce auto-save - clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set up new auto-save timeout
    saveTimeoutRef.current = setTimeout(() => {
      handleSave();
    }, 2000); // Save 2 seconds after last change

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [hasUnsavedChanges, isViewOnly, isSaving, sitemap, handleSave]);

  // Initialize data hash on first load
  useEffect(() => {
    if (sitemap && lastSavedDataHashRef.current === '') {
      lastSavedDataHashRef.current = createSitemapDataHash(sitemap);
    }
  }, [sitemap?.id]);

  // Cleanup: clear pending save timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const generateShareUrls = useCallback(async () => {
    if (!sitemap) return { fullUrl: '', compressedUrl: '' };
    
    // Return cached URLs if they exist
    if (cachedShareUrls) {
      return cachedShareUrls;
    }
    
    try {
      
      // Create ultra-short URL (6-8 characters)
      const shortUrl = await createSimpleShortUrl(sitemap.id);
      
      // NOTE: We intentionally DO NOT include the version parameter in share URLs
      // Share links should always show the current live state of the sitemap
      // If users want to share a specific version, they can manually copy the URL from their browser
      
      // Cache and return the short URL for both (since it's our primary method)
      const urls = { 
        fullUrl: shortUrl,
        compressedUrl: shortUrl
      };
      
      setCachedShareUrls(urls);
      return urls;
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
        
        const urls = {
          fullUrl: fallbackUrl,
          compressedUrl: fallbackUrl
        };
        
        setCachedShareUrls(urls);
        return urls;
      } catch (fallbackError) {
        console.error('❌ Fallback URL creation also failed:', fallbackError);
        toast.error('Failed to create share URL');
        return { fullUrl: '', compressedUrl: '' };
      }
    }
  }, [sitemap, cachedShareUrls]);

  const handleShare = () => {
    savePendingPropertyChangesImmediate();
    setShowShareDialog(true);
  };

  const handleExport = () => {
    savePendingPropertyChangesImmediate();
    setShowExportDialog(true);
  };

  const updateSitemap = useCallback((updates: Partial<Sitemap>) => {
    if (!sitemap) return;
    
    // Allow zoom and collapsed groups changes even in view-only mode (local state only)
    if (isViewOnly && Object.keys(updates).every(key => key === 'zoom' || key === 'collapsedGroups')) {
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
    if (!sitemap) return;
    
    const newCollapsedGroups = [...sitemap.collapsedGroups];
    const index = newCollapsedGroups.indexOf(parentId);
    
    if (index >= 0) {
      newCollapsedGroups.splice(index, 1);
    } else {
      newCollapsedGroups.push(parentId);
    }
    
    // In view-only mode, just update local state without saving
    // In edit mode, save to storage
    updateSitemap({ collapsedGroups: newCollapsedGroups });
  };

  // Helper to save pending changes from properties panel (debounced)
  const savePendingPropertyChanges = () => {
    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Set a new timeout to save after 1 second of inactivity
    saveTimeoutRef.current = setTimeout(() => {
      propertiesPanelRef.current?.savePendingChanges();
      saveTimeoutRef.current = null;
    }, 1000);
  };

  // Immediate save (no debounce) for critical actions
  const savePendingPropertyChangesImmediate = () => {
    // Clear any pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    // Save immediately
    propertiesPanelRef.current?.savePendingChanges();
  };

  // Wrapped onBack that saves pending changes first
  const handleBack = () => {
    savePendingPropertyChangesImmediate();
    onBack();
  };

  // Wrapped setSelectedPageId that saves pending changes first
  const handleSelectPage = (pageId: string | undefined) => {
    savePendingPropertyChanges();
    setSelectedPageId(pageId);
  };

  // Center the canvas on a specific page
  const handleCenterOnPage = (pageId: string) => {
    // Trigger canvas centering by updating state
    setCenterOnPageId(pageId);
    // Reset after a short delay to allow re-centering on the same page if clicked again
    setTimeout(() => setCenterOnPageId(undefined), 100);
  };

  // Version Management
  const handleCreateVersion = async (versionNumber: string, description?: string) => {
    if (!sitemap) return;

    // Create a snapshot of the current sitemap state (deep clone all arrays)
    const versionSnapshot: SitemapVersion = {
      versionNumber,
      createdAt: new Date().toISOString(),
      pages: sitemap.pages.map(page => ({
        id: page.id,
        name: page.name,
        iconKey: (page as any).iconKey || 'file',
        color: page.color,
        x: page.x,
        y: page.y,
        children: [...page.children],
        parent: page.parent,
        pageType: page.pageType,
        description: page.description,
        url: page.url,
        published: page.published,
        visualLevel: page.visualLevel,
      })),
      pageTypes: sitemap.pageTypes.map(pt => ({
        id: pt.id,
        name: pt.name,
        iconKey: pt.iconKey || 'file',
        color: pt.color,
        description: pt.description,
      })),
      rootPageOrder: [...sitemap.rootPageOrder],
      collapsedGroups: [...sitemap.collapsedGroups],
      zoom: sitemap.zoom,
      footerPages: sitemap.footerPages?.map(page => ({
        id: page.id,
        name: page.name,
        iconKey: (page as any).iconKey || 'file',
        color: page.color,
        x: page.x,
        y: page.y,
        children: [...page.children],
        parent: page.parent,
        pageType: page.pageType,
        description: page.description,
        url: page.url,
        published: page.published,
        visualLevel: page.visualLevel,
      })),
      description,
    };

    // Add the version to the versions array
    const updatedVersions = [...(sitemap.versions || []), versionSnapshot];

    // Update the sitemap with the new version
    const updatedSitemap = {
      ...sitemap,
      currentVersion: versionNumber,
      versions: updatedVersions,
    };

    setSitemap(updatedSitemap);
    await storage.saveSitemap(updatedSitemap);
  };

  const handleSwitchVersion = (versionNumber: string) => {
    if (!sitemap) return;

    const targetVersion = sitemap.versions?.find(v => v.versionNumber === versionNumber);
    if (!targetVersion) {
      toast.error('Version not found');
      return;
    }

    // CRITICAL FIX: Save the current version's state before switching
    let updatedVersions = sitemap.versions || [];
    
    if (sitemap.currentVersion && !isViewOnly) {
      // Find the current version in the versions array
      const currentVersionIndex = updatedVersions.findIndex(v => v.versionNumber === sitemap.currentVersion);
      
      if (currentVersionIndex !== -1) {
        // Update the current version's snapshot with the latest state (deep clone all arrays)
        const currentVersionSnapshot: SitemapVersion = {
          versionNumber: sitemap.currentVersion,
          createdAt: updatedVersions[currentVersionIndex].createdAt, // Keep original creation date
          description: updatedVersions[currentVersionIndex].description,
          pages: sitemap.pages.map(page => ({
            id: page.id,
            name: page.name,
            iconKey: (page as any).iconKey || 'file',
            color: page.color,
            x: page.x,
            y: page.y,
            children: [...page.children],
            parent: page.parent,
            pageType: page.pageType,
            description: page.description,
            url: page.url,
            published: page.published,
            visualLevel: page.visualLevel,
          })),
          pageTypes: sitemap.pageTypes.map(pt => ({
            id: pt.id,
            name: pt.name,
            iconKey: pt.iconKey || 'file',
            color: pt.color,
            description: pt.description,
          })),
          rootPageOrder: [...sitemap.rootPageOrder],
          collapsedGroups: [...sitemap.collapsedGroups],
          zoom: sitemap.zoom,
          footerPages: sitemap.footerPages?.map(page => ({
            id: page.id,
            name: page.name,
            iconKey: (page as any).iconKey || 'file',
            color: page.color,
            x: page.x,
            y: page.y,
            children: [...page.children],
            parent: page.parent,
            pageType: page.pageType,
            description: page.description,
            url: page.url,
            published: page.published,
            visualLevel: page.visualLevel,
          })),
        };
        
        // Update the versions array with the current state
        updatedVersions = [
          ...updatedVersions.slice(0, currentVersionIndex),
          currentVersionSnapshot,
          ...updatedVersions.slice(currentVersionIndex + 1)
        ];
      }
    }

    // Restore the sitemap state from the version snapshot (deep clone to prevent cross-version mutations)
    const restoredSitemap: Sitemap = {
      ...sitemap,
      currentVersion: versionNumber,
      versions: updatedVersions, // Use the updated versions array
      pages: targetVersion.pages.map(page => ({
        ...page,
        children: [...page.children],
        icon: getIconComponent(page.iconKey),
      })),
      pageTypes: targetVersion.pageTypes.map(pt => ({
        ...pt,
        icon: getIconComponent(pt.iconKey),
      })),
      rootPageOrder: [...targetVersion.rootPageOrder],
      collapsedGroups: [...targetVersion.collapsedGroups],
      zoom: targetVersion.zoom,
      footerPages: targetVersion.footerPages?.map(page => ({
        ...page,
        children: [...page.children],
        icon: getIconComponent(page.iconKey),
      })),
    };

    setSitemap(restoredSitemap);
    
    // In view-only mode, update the URL to reflect the version change
    if (isViewOnly) {
      const url = new URL(window.location.href);
      url.searchParams.set('v', versionNumber);
      window.history.replaceState({}, '', url.toString());
    } else {
      // In edit mode, save the sitemap with the updated currentVersion
      storage.saveSitemap(restoredSitemap);
    }
  };

  const handleDeleteVersion = (versionNumber: string) => {
    if (isViewOnly) {
      toast.error('Cannot delete versions in view-only mode');
      return;
    }
    if (!sitemap) return;
    
    // Prevent deleting the current version
    if (versionNumber === sitemap.currentVersion) {
      toast.error('Cannot delete the current active version. Switch to another version first.');
      return;
    }
    
    // Remove the version from the versions array
    const updatedVersions = (sitemap.versions || []).filter(v => v.versionNumber !== versionNumber);
    
    updateSitemap({
      versions: updatedVersions
    });
    
    toast.success(`Version ${versionNumber} deleted successfully`);
  };

  // All edit handlers - disabled in view-only mode
  const handleAddPage = (pageType: PageType) => {
    savePendingPropertyChangesImmediate();
    
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
    
    // Temporarily disable auto-centering during layout updates
    setIsDragging(true);
    updateSitemap({
      pages: calculateTreeLayout(newPages, newRootOrder, sitemap.collapsedGroups),
      rootPageOrder: newRootOrder
    });
    setTimeout(() => setIsDragging(false), 100);
    
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

  const handleDeletePage = (id: string, deleteChildren: boolean = false) => {
    savePendingPropertyChangesImmediate();
    if (isViewOnly) {
      toast.error('Cannot delete pages in view-only mode');
      return;
    }
    if (!sitemap) return;
    
    const pageToDelete = sitemap.pages.find(p => p.id === id);
    if (!pageToDelete) return;

    const homePage = getHomePage(sitemap.pages);
    if (homePage && pageToDelete.id === homePage.id) {
      toast.error('Cannot delete the homepage');
      return;
    }

    // Helper function to recursively collect all descendant IDs
    const getAllDescendants = (pageId: string, allPages: SitePage[]): string[] => {
      const page = allPages.find(p => p.id === pageId);
      if (!page || !page.children || page.children.length === 0) return [];
      
      let descendants: string[] = [...page.children];
      page.children.forEach(childId => {
        descendants = [...descendants, ...getAllDescendants(childId, allPages)];
      });
      return descendants;
    };

    let pagesToDelete = [id];
    
    if (deleteChildren) {
      // Get all descendants to delete
      const descendants = getAllDescendants(id, sitemap.pages);
      pagesToDelete = [id, ...descendants];
    }

    let updatedPages = sitemap.pages.filter(p => !pagesToDelete.includes(p.id));
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

    // Only reassign children if we're NOT deleting them
    if (!deleteChildren) {
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
              return { ...page, parent: undefined };
            }
            return page;
          });
        }
      }
    }

    setIsDragging(true);
    updateSitemap({
      pages: calculateTreeLayout(updatedPages, updatedRootOrder, sitemap.collapsedGroups),
      rootPageOrder: updatedRootOrder
    });
    setTimeout(() => setIsDragging(false), 100);

    if (selectedPageId === id) {
      setSelectedPageId(undefined);
    }

    const deletedCount = pagesToDelete.length;
    toast.success(`Deleted ${deletedCount} page${deletedCount !== 1 ? 's' : ''}`);
  };

  // All other edit handlers - with drag state management
  const handleAddChildPage = (parentId: string) => {
    if (isViewOnly) {
      toast.error('Cannot add pages in view-only mode');
      return;
    }
    if (!sitemap) return;
    
    // Use Content Page as default instead of first page type
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
    
    const parentPage = sitemap.pages.find(p => p.id === parentId);
    if (!parentPage) return;
    
    const updatedParent = {
      ...parentPage,
      children: [...parentPage.children, newPage.id]
    };
    
    const updatedPages = sitemap.pages.map(p => 
      p.id === parentId ? updatedParent : p
    );
    updatedPages.push(newPage);
    
    setIsDragging(true);
    updateSitemap({
      pages: calculateTreeLayout(updatedPages, sitemap.rootPageOrder, sitemap.collapsedGroups)
    });
    setTimeout(() => setIsDragging(false), 100);
    
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
    
    // Use Content Page as default instead of first page type
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
    
    const newPages = [...sitemap.pages, newPage];
    let newRootOrder = sitemap.rootPageOrder;
    
    if (siblingPage.parent) {
      const parentPage = sitemap.pages.find(p => p.id === siblingPage.parent);
      if (parentPage) {
        const siblingIndex = parentPage.children.indexOf(siblingId);
        const updatedParent = {
          ...parentPage,
          children: [
            ...parentPage.children.slice(0, siblingIndex + 1),
            newPage.id,
            ...parentPage.children.slice(siblingIndex + 1)
          ]
        };
        
        const updatedPages = newPages.map(p => 
          p.id === parentPage.id ? updatedParent : p
        );
        
        setIsDragging(true);
        updateSitemap({
          pages: calculateTreeLayout(updatedPages, sitemap.rootPageOrder, sitemap.collapsedGroups)
        });
        setTimeout(() => setIsDragging(false), 100);
      }
    } else {
      const siblingIndex = sitemap.rootPageOrder.indexOf(siblingId);
      newRootOrder = [
        ...sitemap.rootPageOrder.slice(0, siblingIndex + 1),
        newPage.id,
        ...sitemap.rootPageOrder.slice(siblingIndex + 1)
      ];
      
      setIsDragging(true);
      updateSitemap({
        pages: calculateTreeLayout(newPages, newRootOrder, sitemap.collapsedGroups),
        rootPageOrder: newRootOrder
      });
      setTimeout(() => setIsDragging(false), 100);
    }
    
    setSelectedPageId(newPage.id);
  };

  const handleDuplicatePage = (pageId: string) => {
    if (isViewOnly) {
      toast.error('Cannot duplicate pages in view-only mode');
      return;
    }
    if (!sitemap) return;
    
    const originalPage = sitemap.pages.find(p => p.id === pageId);
    if (!originalPage) return;
    
    // Recursive function to duplicate a page and all its children
    const duplicatePageRecursive = (page: SitePage, parentId?: string): { page: SitePage; allPages: SitePage[] } => {
      const newId = generateUniqueId('page');
      const duplicatedPage: SitePage = {
        ...page,
        id: newId,
        name: `${page.name} Copy`,
        children: [],
        parent: parentId,
      };
      
      // Copy iconKey if it exists
      if ((page as any).iconKey) {
        (duplicatedPage as any).iconKey = (page as any).iconKey;
      }
      
      const allPages: SitePage[] = [duplicatedPage];
      
      // Recursively duplicate children
      if (page.children && page.children.length > 0) {
        const childIds: string[] = [];
        page.children.forEach(childId => {
          const childPage = sitemap.pages.find(p => p.id === childId);
          if (childPage) {
            const { page: duplicatedChild, allPages: childPages } = duplicatePageRecursive(childPage, newId);
            childIds.push(duplicatedChild.id);
            allPages.push(...childPages);
          }
        });
        duplicatedPage.children = childIds;
      }
      
      return { page: duplicatedPage, allPages };
    };
    
    // Duplicate the page and its descendants
    const { page: duplicatedPage, allPages: newPages } = duplicatePageRecursive(originalPage, originalPage.parent);
    
    // Add all new pages to the sitemap
    const updatedPages = [...sitemap.pages, ...newPages];
    let newRootOrder = sitemap.rootPageOrder;
    
    // Insert the duplicate right after the original in the hierarchy
    if (originalPage.parent) {
      // If page has a parent, add it as a sibling
      const parentPage = sitemap.pages.find(p => p.id === originalPage.parent);
      if (parentPage) {
        const siblingIndex = parentPage.children.indexOf(pageId);
        const updatedParent = {
          ...parentPage,
          children: [
            ...parentPage.children.slice(0, siblingIndex + 1),
            duplicatedPage.id,
            ...parentPage.children.slice(siblingIndex + 1)
          ]
        };
        
        const finalPages = updatedPages.map(p => 
          p.id === parentPage.id ? updatedParent : p
        );
        
        setIsDragging(true);
        updateSitemap({
          pages: calculateTreeLayout(finalPages, sitemap.rootPageOrder, sitemap.collapsedGroups)
        });
        setTimeout(() => setIsDragging(false), 100);
      }
    } else {
      // If page is a root page, add it to root order
      const siblingIndex = sitemap.rootPageOrder.indexOf(pageId);
      newRootOrder = [
        ...sitemap.rootPageOrder.slice(0, siblingIndex + 1),
        duplicatedPage.id,
        ...sitemap.rootPageOrder.slice(siblingIndex + 1)
      ];
      
      setIsDragging(true);
      updateSitemap({
        pages: calculateTreeLayout(updatedPages, newRootOrder, sitemap.collapsedGroups),
        rootPageOrder: newRootOrder
      });
      setTimeout(() => setIsDragging(false), 100);
    }
    
    setSelectedPageId(duplicatedPage.id);
    toast.success('Page duplicated successfully');
  };

  const handleDragReorder = (draggedId: string, targetId: string | null, position: 'before' | 'after' | 'child' | 'root') => {
    if (isViewOnly) {
      toast.error('Cannot move pages in view-only mode');
      return;
    }
    if (!sitemap) return;
    
    const draggedPage = sitemap.pages.find(p => p.id === draggedId);
    if (!draggedPage) return;
    
    const homePage = getHomePage(sitemap.pages);
    if (homePage && draggedPage.id === homePage.id) {
      toast.error('Cannot move the homepage');
      return;
    }
    
    let updatedPages = [...sitemap.pages];
    let updatedRootOrder = [...sitemap.rootPageOrder];
    
    // Remove from current parent
    if (draggedPage.parent) {
      updatedPages = updatedPages.map(page => {
        if (page.id === draggedPage.parent) {
          return {
            ...page,
            children: page.children.filter(childId => childId !== draggedId)
          };
        }
        return page;
      });
    } else {
      updatedRootOrder = updatedRootOrder.filter(id => id !== draggedId);
    }
    
    // Add to new position
    if (position === 'root') {
      updatedPages = updatedPages.map(page => 
        page.id === draggedId ? { ...page, parent: undefined } : page
      );
      updatedRootOrder.push(draggedId);
    } else if (targetId) {
      const targetPage = sitemap.pages.find(p => p.id === targetId);
      if (targetPage) {
        if (position === 'child') {
          updatedPages = updatedPages.map(page => {
            if (page.id === targetId) {
              return { ...page, children: [...page.children, draggedId] };
            }
            if (page.id === draggedId) {
              return { ...page, parent: targetId };
            }
            return page;
          });
        } else {
          const newParent = targetPage.parent;
          updatedPages = updatedPages.map(page => 
            page.id === draggedId ? { ...page, parent: newParent } : page
          );
          
          if (newParent) {
            const parentPage = sitemap.pages.find(p => p.id === newParent);
            if (parentPage) {
              const targetIndex = parentPage.children.indexOf(targetId);
              const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
              
              updatedPages = updatedPages.map(page => {
                if (page.id === newParent) {
                  const newChildren = [...page.children];
                  newChildren.splice(insertIndex, 0, draggedId);
                  return { ...page, children: newChildren };
                }
                return page;
              });
            }
          } else {
            const targetIndex = updatedRootOrder.indexOf(targetId);
            const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
            updatedRootOrder.splice(insertIndex, 0, draggedId);
          }
        }
      }
    }
    
    setIsDragging(true);
    updateSitemap({
      pages: calculateTreeLayout(updatedPages, updatedRootOrder, sitemap.collapsedGroups),
      rootPageOrder: updatedRootOrder
    });
    setTimeout(() => setIsDragging(false), 100);
  };

  const handleAddLeftOfHome = () => {
    if (isViewOnly) {
      toast.error('Cannot add pages in view-only mode');
      return;
    }
    if (!sitemap) return;
    
    // Use Content Page as default instead of first page type
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
    
    const newPages = [...sitemap.pages, newPage];
    const homePage = getHomePage(sitemap.pages);
    const homeIndex = homePage ? sitemap.rootPageOrder.findIndex(id => id === homePage.id) : -1;
    
    const newRootOrder = [...sitemap.rootPageOrder];
    if (homeIndex >= 0) {
      newRootOrder.splice(homeIndex, 0, newPage.id);
    } else {
      newRootOrder.unshift(newPage.id);
    }
    
    setIsDragging(true);
    updateSitemap({
      pages: calculateTreeLayout(newPages, newRootOrder, sitemap.collapsedGroups),
      rootPageOrder: newRootOrder
    });
    setTimeout(() => setIsDragging(false), 100);
    
    setSelectedPageId(newPage.id);
  };

  const handleAddRightOfHome = () => {
    if (isViewOnly) {
      toast.error('Cannot add pages in view-only mode');
      return;
    }
    if (!sitemap) return;
    
    // Use Content Page as default instead of first page type
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
    
    const newPages = [...sitemap.pages, newPage];
    const homePage2 = getHomePage(sitemap.pages);
    const homeIndex2 = homePage2 ? sitemap.rootPageOrder.findIndex(id => id === homePage2.id) : -1;
    
    const newRootOrder = [...sitemap.rootPageOrder];
    if (homeIndex2 >= 0) {
      newRootOrder.splice(homeIndex2 + 1, 0, newPage.id);
    } else {
      newRootOrder.push(newPage.id);
    }
    
    setIsDragging(true);
    updateSitemap({
      pages: calculateTreeLayout(newPages, newRootOrder, sitemap.collapsedGroups),
      rootPageOrder: newRootOrder
    });
    setTimeout(() => setIsDragging(false), 100);
    
    setSelectedPageId(newPage.id);
  };

  const handleAddBelowHome = () => {
    if (isViewOnly) {
      toast.error('Cannot add pages in view-only mode');
      return;
    }
    if (!sitemap) return;

    // Find the home page
    const homePage = getHomePage(sitemap.pages);
    if (!homePage) return;

    // Use Content Page as default instead of first page type
    const defaultPageType = getDefaultPageType();
    
    const newPage: SitePage = {
      id: generateUniqueId('page'),
      name: String(defaultPageType.name),
      icon: defaultPageType.icon,
      color: String(defaultPageType.color),
      x: 200,
      y: 100,
      children: [],
      parent: homePage.id, // Make it a child of home
      pageType: defaultPageType.id
    };
    
    (newPage as any).iconKey = defaultPageType.iconKey || 'file';
    
    // Update home page to include this new child
    const updatedPages = sitemap.pages.map(p => 
      p.id === homePage.id ? { ...p, children: [...p.children, newPage.id] } : p
    );
    updatedPages.push(newPage);
    
    setIsDragging(true);
    updateSitemap({
      pages: calculateTreeLayout(updatedPages, sitemap.rootPageOrder, sitemap.collapsedGroups)
    });
    setTimeout(() => setIsDragging(false), 100);
    
    setSelectedPageId(newPage.id);
  };

  const handleAddLeftOfContentStacks = () => {
    if (isViewOnly) {
      toast.error('Cannot add pages in view-only mode');
      return;
    }
    if (!sitemap) return;

    // Find the home page to add a child (content stack)
    const homePage = getHomePage(sitemap.pages);
    if (!homePage) return;

    // Use Content Page as default instead of first page type
    const defaultPageType = getDefaultPageType();
    
    const newPage: SitePage = {
      id: generateUniqueId('page'),
      name: String(defaultPageType.name),
      icon: defaultPageType.icon,
      color: String(defaultPageType.color),
      x: 200,
      y: 100,
      children: [],
      parent: homePage.id, // Make it a child of Home
      pageType: defaultPageType.id
    };
    
    (newPage as any).iconKey = defaultPageType.iconKey || 'file';
    
    const newPages = [...sitemap.pages, newPage];
    
    // Update Home page's children - add to beginning (left side)
    const updatedPages = newPages.map(page => {
      if (page.id === homePage.id) {
        return {
          ...page,
          children: [newPage.id, ...page.children] // Add to beginning
        };
      }
      return page;
    });
    
    setIsDragging(true);
    updateSitemap({
      pages: calculateTreeLayout(updatedPages, sitemap.rootPageOrder, sitemap.collapsedGroups)
    });
    setTimeout(() => setIsDragging(false), 100);
    
    setSelectedPageId(newPage.id);
  };

  const handleAddRightOfContentStacks = () => {
    if (isViewOnly) {
      toast.error('Cannot add pages in view-only mode');
      return;
    }
    if (!sitemap) return;

    // Find the home page to add a child (content stack)
    const homePage = getHomePage(sitemap.pages);
    if (!homePage) return;

    // Use Content Page as default instead of first page type
    const defaultPageType = getDefaultPageType();
    
    const newPage: SitePage = {
      id: generateUniqueId('page'),
      name: String(defaultPageType.name),
      icon: defaultPageType.icon,
      color: String(defaultPageType.color),
      x: 200,
      y: 100,
      children: [],
      parent: homePage.id, // Make it a child of Home
      pageType: defaultPageType.id
    };
    
    (newPage as any).iconKey = defaultPageType.iconKey || 'file';
    
    const newPages = [...sitemap.pages, newPage];
    
    // Update Home page's children - add to end (right side)
    const updatedPages = newPages.map(page => {
      if (page.id === homePage.id) {
        return {
          ...page,
          children: [...page.children, newPage.id] // Add to end
        };
      }
      return page;
    });
    
    setIsDragging(true);
    updateSitemap({
      pages: calculateTreeLayout(updatedPages, sitemap.rootPageOrder, sitemap.collapsedGroups)
    });
    setTimeout(() => setIsDragging(false), 100);
    
    setSelectedPageId(newPage.id);
  };

  const handleReorderPages = (pageId: string, newIndex: number) => {
    if (isViewOnly) return;
    console.log('Reorder pages', pageId, newIndex);
  };

  const handleAddPageType = (pageType: PageType) => {
    savePendingPropertyChangesImmediate();
    if (isViewOnly) {
      toast.error('Cannot add page types in view-only mode');
      return;
    }
    if (!sitemap) return;
    
    const existingPageType = sitemap.pageTypes.find(pt => pt.id === pageType.id);
    if (existingPageType) {
      toast.error('Page type already exists');
      return;
    }
    
    const newPageTypes = [...sitemap.pageTypes, pageType];
    updateSitemap({ pageTypes: newPageTypes });
    toast.success('Page type added');
  };

  const handleEditPageType = (pageTypeId: string, updates: Partial<PageType>) => {
    savePendingPropertyChangesImmediate();
    if (isViewOnly) {
      toast.error('Cannot edit page types in view-only mode');
      return;
    }
    if (!sitemap) return;
    
    const updatedPageTypes = sitemap.pageTypes.map(pt => 
      pt.id === pageTypeId ? { ...pt, ...updates } : pt
    );
    
    updateSitemap({ pageTypes: updatedPageTypes });
    toast.success('Page type updated');
  };

  const handleDeletePageType = (pageTypeId: string) => {
    savePendingPropertyChangesImmediate();
    if (isViewOnly) {
      toast.error('Cannot delete page types in view-only mode');
      return;
    }
    if (!sitemap) return;
    
    // Check if any pages are using this page type
    const pagesUsingType = sitemap.pages.filter(page => page.pageType === pageTypeId);
    if (pagesUsingType.length > 0) {
      toast.error('Cannot delete page type - it is being used by existing pages');
      return;
    }
    
    const updatedPageTypes = sitemap.pageTypes.filter(pt => pt.id !== pageTypeId);
    updateSitemap({ pageTypes: updatedPageTypes });
    toast.success('Page type deleted');
  };

  // Footer page handlers
  const handleAddFooterPage = () => {
    if (isViewOnly) {
      toast.error('Cannot add footer pages in view-only mode');
      return;
    }
    if (!sitemap) return;
    
    const defaultPageType = getDefaultPageType();
    
    const newFooterPage: SitePage = {
      id: generateUniqueId('footer-page'),
      name: 'Footer Page',
      icon: defaultPageType.icon,
      color: String(defaultPageType.color),
      x: 0,
      y: 0,
      children: [],
      pageType: defaultPageType.id
    };
    
    (newFooterPage as any).iconKey = defaultPageType.iconKey || 'file';
    
    const newFooterPages = [...(sitemap.footerPages || []), newFooterPage];
    
    updateSitemap({
      footerPages: newFooterPages
    });
    
    setSelectedPageId(newFooterPage.id);
  };

  const handleUpdateFooterPage = (id: string, updates: Partial<SitePage>) => {
    if (isViewOnly) {
      toast.error('Cannot edit footer pages in view-only mode');
      return;
    }
    if (!sitemap) return;
    
    const updatedFooterPages = (sitemap.footerPages || []).map(page => 
      page.id === id ? { ...page, ...updates } : page
    );
    
    updateSitemap({
      footerPages: updatedFooterPages
    });
  };

  const handleDeleteFooterPage = (id: string) => {
    if (isViewOnly) {
      toast.error('Cannot delete footer pages in view-only mode');
      return;
    }
    if (!sitemap) return;
    
    const updatedFooterPages = (sitemap.footerPages || []).filter(p => p.id !== id);
    
    updateSitemap({
      footerPages: updatedFooterPages
    });
    
    if (selectedPageId === id) {
      setSelectedPageId(undefined);
    }
    
    toast.success('Footer page deleted');
  };

  const handleReorderFooterPages = (draggedId: string, targetId: string, position: 'before' | 'after') => {
    if (isViewOnly) {
      toast.error('Cannot reorder footer pages in view-only mode');
      return;
    }
    if (!sitemap) return;
    
    const currentFooterPages = [...(sitemap.footerPages || [])];
    const draggedIndex = currentFooterPages.findIndex(p => p.id === draggedId);
    const targetIndex = currentFooterPages.findIndex(p => p.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    // Remove the dragged page from its current position
    const [draggedPage] = currentFooterPages.splice(draggedIndex, 1);
    
    // Calculate the new insertion index
    let insertIndex = targetIndex;
    if (draggedIndex < targetIndex) {
      insertIndex = targetIndex; // Adjust for the removed item
    } else {
      insertIndex = targetIndex + (position === 'after' ? 1 : 0);
    }
    
    if (position === 'after' && draggedIndex > targetIndex) {
      insertIndex = targetIndex + 1;
    } else if (position === 'before' && draggedIndex > targetIndex) {
      insertIndex = targetIndex;
    }
    
    // Insert the dragged page at the new position
    currentFooterPages.splice(insertIndex, 0, draggedPage);
    
    updateSitemap({
      footerPages: currentFooterPages
    });
  };

  // Helper function to move pages from regular pages to footer pages
  const movePageToFooter = (pageId: string) => {
    if (!sitemap) return;
    
    const pageToMove = sitemap.pages.find(p => p.id === pageId);
    if (!pageToMove) return;
    
    // Remove from regular pages and update any references to this page
    const updatedPages = sitemap.pages.filter(p => p.id !== pageId).map(p => ({
      ...p,
      children: p.children.filter(childId => childId !== pageId)
    }));
    
    // Remove parent reference and children (footer pages are standalone)
    const footerPage = {
      ...pageToMove,
      parent: undefined,
      children: [],
      x: 0,
      y: 0
    };
    
    // Add to footer pages
    const updatedFooterPages = [...(sitemap.footerPages || []), footerPage];
    
    updateSitemap({
      pages: calculateTreeLayout(updatedPages, sitemap.rootPageOrder, sitemap.collapsedGroups),
      footerPages: updatedFooterPages
    });
    
    toast.success(`Moved "${pageToMove.name}" to footer pages`);
  };

  // Helper function to move pages from footer to regular pages
  const movePageToRegular = (pageId: string) => {
    if (!sitemap) return;
    
    const pageToMove = sitemap.footerPages?.find(p => p.id === pageId);
    if (!pageToMove) return;
    
    // Remove from footer pages
    const updatedFooterPages = (sitemap.footerPages || []).filter(p => p.id !== pageId);
    
    // Add to regular pages (as root level page)
    const regularPage = {
      ...pageToMove,
      parent: undefined,
      children: [],
      x: 0,
      y: 0
    };
    
    const updatedPages = [...sitemap.pages, regularPage];
    
    updateSitemap({
      pages: calculateTreeLayout(updatedPages, sitemap.rootPageOrder, sitemap.collapsedGroups),
      footerPages: updatedFooterPages
    });
    
    toast.success(`Moved "${pageToMove.name}" to regular pages`);
  };

  // Expose helper functions to window for debugging (only in development)
  useEffect(() => {
    if (typeof window !== 'undefined' && sitemap) {
      (window as any).sitemapDebug = {
        movePageToFooter,
        movePageToRegular,
        listRegularPages: () => {
          console.log('Regular Pages:', sitemap.pages.map(p => ({ id: p.id, name: p.name })));
          return sitemap.pages;
        },
        listFooterPages: () => {
          console.log('Footer Pages:', sitemap.footerPages?.map(p => ({ id: p.id, name: p.name })) || []);
          return sitemap.footerPages || [];
        },
        getCurrentSitemap: () => sitemap
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).sitemapDebug;
      }
    };
  }, [sitemap]);

  const handleBulkUpdatePages = (pageIds: string[], updates: Partial<SitePage>) => {
    if (isViewOnly) {
      toast.error('Cannot update pages in view-only mode');
      return;
    }
    if (!sitemap) return;
    
    const updatedPages = sitemap.pages.map(page => {
      if (pageIds.includes(page.id)) {
        return { ...page, ...updates };
      }
      return page;
    });
    
    updateSitemap({ pages: updatedPages });
    toast.success(`Updated ${pageIds.length} pages`);
  };

  const handleBulkDeletePages = (pageIds: string[]) => {
    if (isViewOnly) {
      toast.error('Cannot delete pages in view-only mode');
      return;
    }
    if (!sitemap) return;
    
    const remainingPages = sitemap.pages.filter(page => !pageIds.includes(page.id));
    
    // Update parent-child relationships
    const finalPages = remainingPages.map(page => {
      if (page.children) {
        page.children = page.children.filter(childId => !pageIds.includes(childId));
      }
      return page;
    });
    
    updateSitemap({ pages: finalPages });
    toast.success(`Deleted ${pageIds.length} pages`);
  };

  const handleOpenComments = () => {
    // Scroll to properties panel and ensure it's visible
    const propertiesPanel = document.querySelector('[data-testid="page-properties-panel"]');
    if (propertiesPanel) {
      propertiesPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  // Get all pages for the floating comment button
  const allPages = sitemap ? [
    ...sitemap.pages.map(p => ({ id: p.id, name: String(p.name) })),
    ...(sitemap.footerPages || []).map(p => ({ id: p.id, name: String(p.name) }))
  ] : [];



  // Convert to SerializableSitemap for the export dialog
  const serializableSitemap = sitemap ? {
    ...sitemap,
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
    }))
  } : null;

  // Show error state if there's a load error
  if (loadError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl mb-2">Unable to Load Sitemap</h2>
          <p className="text-muted-foreground mb-4">{loadError}</p>
          <div className="space-y-2">
            <Button onClick={() => window.location.reload()} className="w-full">
              Try Again
            </Button>
            {!isViewOnly && (
              <Button onClick={handleBack} variant="outline" className="w-full">
                Back to Dashboard
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show loading state while sitemap is loading
  if (!sitemap) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading sitemap...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            {!isViewOnly && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-medium">{String(sitemap.name)}</h1>
                {isViewOnly && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded-md">
                    <Eye className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">View Only</span>
                  </div>
                )}
              </div>
              {sitemap.description && (
                <p className="text-sm text-muted-foreground">{String(sitemap.description)}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isViewOnly && (
              <SaveStatusIndicator 
                isSaving={isSaving}
                hasUnsavedChanges={hasUnsavedChanges}
                lastSavedAt={lastSavedAt}
              />
            )}
            {sitemap.currentVersion && (
              <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md">
                <GitBranch className="h-3 w-3" />
                <span className="text-xs">v{sitemap.currentVersion}</span>
              </div>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setIsLoadingVersions(true);
                setTimeout(() => {
                  setShowVersionManager(true);
                  setIsLoadingVersions(false);
                }, 100);
              }}
              disabled={isLoadingVersions}
            >
              {isLoadingVersions ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <GitBranch className="h-4 w-4 mr-2" />
              )}
              Versions
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            {!isViewOnly && (
              <>
                <Button variant="outline" size="sm" onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex h-[calc(100vh-73px)]">
        <SitePlanSidebar 
          onAddPage={handleAddPage}
          pages={sitemap.pages || []}
          selectedPageId={selectedPageId}
          onSelectPage={handleSelectPage}
          onReorderPages={handleReorderPages}
          pageTypes={sitemap.pageTypes}
          onAddPageType={handleAddPageType}
          onEditPageType={handleEditPageType}
          onDeletePageType={handleDeletePageType}
          collapsedGroups={new Set(sitemap.collapsedGroups || [])}
          onToggleCollapse={handleToggleCollapse}
          isViewOnly={isViewOnly}
        />
        
        <SiteMapCanvas
            pages={sitemap.pages || []}
            onUpdatePage={handleUpdatePage}
            onDeletePage={handleDeletePage}
            onSelectPage={handleSelectPage}
            onAddChildPage={handleAddChildPage}
            onAddSiblingPage={handleAddSiblingPage}
            onDuplicatePage={handleDuplicatePage}
            onDragReorder={handleDragReorder}
            onAddLeftOfHome={handleAddLeftOfHome}
            onAddRightOfHome={handleAddRightOfHome}
            onAddBelowHome={handleAddBelowHome}
            onAddLeftOfContentStacks={handleAddLeftOfContentStacks}
            onAddRightOfContentStacks={handleAddRightOfContentStacks}
            selectedPageId={selectedPageId}
            rootPageOrder={sitemap.rootPageOrder || []}
            collapsedGroups={new Set(sitemap.collapsedGroups || [])}
            onToggleCollapse={handleToggleCollapse}
            zoom={sitemap.zoom || 1}
            onZoomChange={handleZoomChange}
            pageTypes={sitemap.pageTypes}
            isViewOnly={isViewOnly}
            isDragging={isDragging}
            footerPages={sitemap.footerPages || []}
            onAddFooterPage={handleAddFooterPage}
            onUpdateFooterPage={handleUpdateFooterPage}
            onDeleteFooterPage={handleDeleteFooterPage}
            onReorderFooterPages={handleReorderFooterPages}
            onBulkUpdatePages={handleBulkUpdatePages}
            onBulkDeletePages={handleBulkDeletePages}
            sitemapId={sitemap.id}
            commentCounts={commentCounts}
            centerOnPageId={centerOnPageId}
          />
        
        <div data-testid="page-properties-panel">
          <PagePropertiesPanel
            ref={propertiesPanelRef}
            page={selectedPage}
            onUpdatePage={selectedPage && sitemap?.footerPages?.find(p => p.id === selectedPage.id) 
              ? handleUpdateFooterPage 
              : handleUpdatePage}
            pageTypes={sitemap.pageTypes}
            isViewOnly={isViewOnly}
            sitemapId={sitemap.id}
            allPages={[...sitemap.pages, ...(sitemap.footerPages || [])]}
            onSelectPage={handleSelectPage}
            onCenterPage={handleCenterOnPage}
          />
        </div>
      </div>

      <ShareDialog
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        fullUrl={cachedShareUrls?.fullUrl || ''}
        compressedUrl={cachedShareUrls?.compressedUrl || ''}
        sitemapName={sitemap.name || 'Sitemap'}
        sitemapId={sitemap.id}
        currentVersion={sitemap.currentVersion}
        onGenerateUrls={generateShareUrls}
      />

      {serializableSitemap && (
        <ExportDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          sitemap={serializableSitemap}
        />
      )}

      <VersionManager
        open={showVersionManager}
        onClose={() => setShowVersionManager(false)}
        currentVersion={sitemap.currentVersion}
        versions={sitemap.versions || []}
        onCreateVersion={handleCreateVersion}
        onSwitchVersion={handleSwitchVersion}
        onDeleteVersion={handleDeleteVersion}
        isViewOnly={isViewOnly}
      />

      <BuildNumber />

    </div>
  );
}