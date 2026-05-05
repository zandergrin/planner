import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Checkbox } from "./ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { MoreHorizontal, Edit, Trash2, Copy, Plus, ChevronDown, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Files } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import type { SitePage, PageType } from '../utils/storage';
import { CommentIndicator } from './CommentIndicator';

// Helper function to find the homepage (root page with no parent)
const getHomePage = (pages: SitePage[]): SitePage | undefined => {
  return pages.find(p => !p.parent || p.parent === '' || p.parent === null);
};

interface SiteMapCanvasProps {
  pages: SitePage[];
  onUpdatePage: (id: string, updates: Partial<SitePage>) => void;
  onDeletePage: (id: string, deleteChildren?: boolean) => void;
  onSelectPage: (id: string) => void;
  onAddChildPage: (parentId: string) => void;
  onAddSiblingPage: (siblingId: string) => void;
  onDuplicatePage: (pageId: string) => void;
  onDragReorder: (draggedPageId: string, targetPageId: string | null, dropPosition: 'before' | 'after' | 'child' | 'root') => void;
  onAddLeftOfHome: () => void;
  onAddRightOfHome: () => void;
  onAddBelowHome: () => void;
  onAddLeftOfContentStacks: () => void;
  onAddRightOfContentStacks: () => void;
  selectedPageId?: string;
  rootPageOrder: string[];
  collapsedGroups: Set<string>;
  onToggleCollapse: (parentId: string) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  pageTypes: PageType[];
  isViewOnly?: boolean;
  isDragging?: boolean;
  footerPages?: SitePage[];
  onAddFooterPage?: () => void;
  onUpdateFooterPage?: (id: string, updates: Partial<SitePage>) => void;
  onDeleteFooterPage?: (id: string) => void;
  onReorderFooterPages?: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  onBulkUpdatePages?: (pageIds: string[], updates: Partial<SitePage>) => void;
  onBulkDeletePages?: (pageIds: string[]) => void;
  sitemapId?: string;
  commentCounts?: Record<string, number>;
  centerOnPageId?: string; // ID of page to center on
}

export function SiteMapCanvas({ 
  pages, 
  onUpdatePage, 
  onDeletePage, 
  onSelectPage, 
  onAddChildPage, 
  onAddSiblingPage,
  onDuplicatePage,
  onDragReorder,
  onAddLeftOfHome,
  onAddRightOfHome,
  onAddBelowHome,
  onAddLeftOfContentStacks,
  onAddRightOfContentStacks,
  selectedPageId,
  rootPageOrder,
  collapsedGroups,
  onToggleCollapse,
  zoom,
  onZoomChange,
  pageTypes,
  isViewOnly = false,
  isDragging = false,
  footerPages = [],
  onAddFooterPage,
  onUpdateFooterPage,
  onDeleteFooterPage,
  onReorderFooterPages,
  onBulkUpdatePages,
  onBulkDeletePages,
  sitemapId,
  commentCounts = {},
  centerOnPageId
}: SiteMapCanvasProps) {
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ pageId: string; position: 'before' | 'after' | 'child' } | null>(null);
  const [draggedFooterPageId, setDraggedFooterPageId] = useState<string | null>(null);
  const [footerDropTarget, setFooterDropTarget] = useState<{ pageId: string; position: 'before' | 'after' } | null>(null);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<string | null>(null);
  const [deleteChildrenOption, setDeleteChildrenOption] = useState<'move' | 'delete'>('move');
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastAutoScrollTime, setLastAutoScrollTime] = useState(0);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef<number | null>(null);

  // Constants for positioning and bounds
  const TOP_GAP = 120; // Increased from 40px to 120px
  
  // Helper function to apply scroll bounds
  const applyScrollBounds = useCallback((offset: { x: number; y: number }) => {
    const homePage = getHomePage(pages);
    if (!homePage || !scrollContainerRef.current) return offset;

    // Calculate the maximum Y offset (prevents scrolling higher than TOP_GAP)
    const maxY = TOP_GAP - (homePage.y * zoom);
    
    return {
      x: offset.x,
      y: Math.min(offset.y, maxY) // Prevent scrolling higher than the gap
    };
  }, [pages, zoom, TOP_GAP]);

  // Initialize Home position at top edge of screen with center alignment
  useEffect(() => {
    if (!isInitialized && pages.length > 0 && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const containerRect = container.getBoundingClientRect();
      const homePage = getHomePage(pages);
      
      if (homePage) {
        // Center horizontally and position at top edge with 40px gap
        const targetX = containerRect.width / 2 - (homePage.x + 144) * zoom;
        const targetY = TOP_GAP - (homePage.y * zoom);
        
        const boundedOffset = applyScrollBounds({ x: targetX, y: targetY });
        setPanOffset(boundedOffset);
        setIsInitialized(true);
      }
    }
  }, [pages, zoom, isInitialized, applyScrollBounds, TOP_GAP]);

  // Center on a specific page when requested
  useEffect(() => {
    if (centerOnPageId && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const containerRect = container.getBoundingClientRect();
      
      // Find the page in either regular pages or footer pages
      const targetPage = [...pages, ...footerPages].find(p => p.id === centerOnPageId);
      
      if (targetPage) {
        // Calculate the center position for this page
        // Page card width is 288px (w-72), so center is at x + 144
        const targetX = containerRect.width / 2 - (targetPage.x + 144) * zoom;
        const targetY = containerRect.height / 2 - (targetPage.y + 40) * zoom; // 40 is half the card height (80px)
        
        const boundedOffset = applyScrollBounds({ x: targetX, y: targetY });
        setPanOffset(boundedOffset);
      }
    }
  }, [centerOnPageId, pages, footerPages, zoom, applyScrollBounds]);

  // Auto-recenter when pages layout changes (for better UX) - but NOT during drag operations
  // Note: We intentionally do NOT include this recenter logic to preserve user's canvas position
  // during background saves. The canvas only recenters on initial load (above useEffect).

  // Helper function to get page level
  const getLevel = (page: SitePage): number => {
    // Use manual visual level if set
    if (page.visualLevel !== undefined) {
      return page.visualLevel;
    }
    // Otherwise calculate from parent hierarchy
    if (!page.parent) return 0;
    const parent = pages.find(p => p.id === page.parent);
    if (!parent) return 0;
    return getLevel(parent) + 1;
  };

  // Helper function to check if any ancestor is collapsed
  const isAnyAncestorCollapsed = (page: SitePage): boolean => {
    if (!page.parent) return false;
    if (collapsedGroups.has(page.parent)) return true;
    const parent = pages.find(p => p.id === page.parent);
    if (!parent) return false;
    return isAnyAncestorCollapsed(parent);
  };

  // Get all descendants of a page in order
  const getAllDescendants = (pageId: string): SitePage[] => {
    const page = pages.find(p => p.id === pageId);
    if (!page) return [];
    
    const descendants: SitePage[] = [];
    const children = page.children
      .map(childId => pages.find(p => p.id === childId))
      .filter(Boolean) as SitePage[];
    
    children.forEach(child => {
      descendants.push(child);
      descendants.push(...getAllDescendants(child.id));
    });
    
    return descendants;
  };

  // Get page type info
  const getPageTypeInfo = (page: SitePage) => {
    return pageTypes.find(pt => pt.id === page.pageType) || pageTypes[0];
  };

  // Auto-scroll implementation (disabled in view-only mode)
  const handleAutoScroll = useCallback((clientX: number, clientY: number) => {
    if (isViewOnly || !scrollContainerRef.current || !draggedPageId) {
      if (autoScrollRef.current) {
        cancelAnimationFrame(autoScrollRef.current);
        autoScrollRef.current = null;
      }
      return;
    }

    const container = scrollContainerRef.current;
    const rect = container.getBoundingClientRect();
    const scrollSpeed = 8;
    const edgeThreshold = 30;
    const maxScrollSpeed = 20;

    let scrollX = 0;
    let scrollY = 0;

    const leftDistance = clientX - rect.left;
    const rightDistance = rect.right - clientX;
    const topDistance = clientY - rect.top;
    const bottomDistance = rect.bottom - clientY;

    if (leftDistance > 0 && leftDistance < edgeThreshold) {
      const intensity = 1 - (leftDistance / edgeThreshold);
      scrollX = Math.min(scrollSpeed * intensity, maxScrollSpeed);
    } else if (rightDistance > 0 && rightDistance < edgeThreshold) {
      const intensity = 1 - (rightDistance / edgeThreshold);
      scrollX = -Math.min(scrollSpeed * intensity, maxScrollSpeed);
    }

    if (topDistance > 0 && topDistance < edgeThreshold) {
      const intensity = 1 - (topDistance / edgeThreshold);
      scrollY = Math.min(scrollSpeed * intensity, maxScrollSpeed);
    } else if (bottomDistance > 0 && bottomDistance < edgeThreshold) {
      const intensity = 1 - (bottomDistance / edgeThreshold);
      scrollY = -Math.min(scrollSpeed * intensity, maxScrollSpeed);
    }

    if (Math.abs(scrollX) > 0.1 || Math.abs(scrollY) > 0.1) {
      const now = Date.now();
      
      if (now - lastAutoScrollTime > 16) {
        setPanOffset(prev => {
          const newOffset = {
            x: prev.x + scrollX,
            y: prev.y + scrollY
          };
          return applyScrollBounds(newOffset);
        });
        setLastAutoScrollTime(now);
      }

      autoScrollRef.current = requestAnimationFrame(() => {
        handleAutoScroll(clientX, clientY);
      });
    } else {
      if (autoScrollRef.current) {
        cancelAnimationFrame(autoScrollRef.current);
        autoScrollRef.current = null;
      }
    }
  }, [draggedPageId, lastAutoScrollTime, isViewOnly, applyScrollBounds]);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (scrollContainerRef.current) {
      const rect = scrollContainerRef.current.getBoundingClientRect();
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }

    if (draggedPageId && !isViewOnly) {
      stopAutoScroll();
      handleAutoScroll(e.clientX, e.clientY);
    }
  }, [draggedPageId, handleAutoScroll, stopAutoScroll, isViewOnly]);

  const handleDragMove = useCallback((e: DragEvent) => {
    if (draggedPageId && !isViewOnly) {
      stopAutoScroll();
      handleAutoScroll(e.clientX, e.clientY);
    }
  }, [draggedPageId, handleAutoScroll, stopAutoScroll, isViewOnly]);

  const handleMouseLeave = useCallback(() => {
    stopAutoScroll();
  }, [stopAutoScroll]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(0.25, Math.min(3, zoom + delta));
      
      if (newZoom !== zoom && scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const rect = container.getBoundingClientRect();
        
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const canvasX = (mouseX - panOffset.x) / zoom;
        const canvasY = (mouseY - panOffset.y) / zoom;
        
        const newPanX = mouseX - canvasX * newZoom;
        const newPanY = mouseY - canvasY * newZoom;
        
        const boundedOffset = applyScrollBounds({ x: newPanX, y: newPanY });
        setPanOffset(boundedOffset);
        onZoomChange(newZoom);
      }
    } else {
      setPanOffset(prev => {
        const newOffset = {
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY
        };
        return applyScrollBounds(newOffset);
      });
    }
  }, [zoom, onZoomChange, panOffset, isViewOnly, applyScrollBounds]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      setLastPanPoint({ x: distance, y: 0 });
    } else if (e.touches.length === 1 && !draggedPageId) {
      const touch = e.touches[0];
      setLastPanPoint({ x: touch.clientX, y: touch.clientY });
      setIsPanning(true);
    }
  }, [draggedPageId]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      
      const delta = (distance - lastPanPoint.x) * 0.005;
      const newZoom = Math.max(0.25, Math.min(3, zoom + delta));
      onZoomChange(newZoom);
      setLastPanPoint({ x: distance, y: 0 });
    } else if (e.touches.length === 1 && isPanning && !draggedPageId) {
      e.preventDefault();
      const touch = e.touches[0];
      const deltaX = touch.clientX - lastPanPoint.x;
      const deltaY = touch.clientY - lastPanPoint.y;
      
      setPanOffset(prev => {
        const newOffset = {
          x: prev.x + deltaX,
          y: prev.y + deltaY
        };
        return applyScrollBounds(newOffset);
      });
      
      setLastPanPoint({ x: touch.clientX, y: touch.clientY });
    }
  }, [lastPanPoint, isPanning, zoom, onZoomChange, draggedPageId, isViewOnly, applyScrollBounds]);

  const handleTouchEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Mouse panning handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only pan with left mouse button and not when dragging a page
    // Allow panning when clicking on the scroll container or canvas div, but not on page cards or buttons
    const target = e.target as HTMLElement;
    const isClickOnBackground = target === scrollContainerRef.current || target === canvasRef.current;
    
    if (e.button === 0 && !draggedPageId && isClickOnBackground) {
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  }, [draggedPageId]);

  const handleMouseMoveForPanning = useCallback((e: MouseEvent) => {
    if (isPanning && !draggedPageId) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      
      setPanOffset(prev => {
        const newOffset = {
          x: prev.x + deltaX,
          y: prev.y + deltaY
        };
        return applyScrollBounds(newOffset);
      });
      
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  }, [isPanning, lastPanPoint, draggedPageId, applyScrollBounds]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mousemove', handleMouseMoveForPanning);
    document.addEventListener('mouseup', handleMouseUp);
    
    if (!isViewOnly) {
      document.addEventListener('dragover', handleDragMove);
    }

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mousemove', handleMouseMoveForPanning);
      document.removeEventListener('mouseup', handleMouseUp);
      if (!isViewOnly) {
        document.removeEventListener('dragover', handleDragMove);
      }
    };
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd, handleMouseMove, handleMouseLeave, handleMouseMoveForPanning, handleMouseUp, handleDragMove, isViewOnly]);

  useEffect(() => {
    if (!draggedPageId) {
      stopAutoScroll();
    }
    
    return stopAutoScroll;
  }, [draggedPageId, stopAutoScroll]);

  // Group siblings for floating plus positioning
  const siblingGroups = useMemo(() => {
    const groups: { [key: string]: SitePage[] } = {};
    
    const rootPages = rootPageOrder.map(id => pages.find(p => p.id === id)).filter(Boolean) as SitePage[];
    if (rootPages.length > 0) {
      groups['root'] = rootPages;
    }
    
    return groups;
  }, [pages, rootPageOrder]);

  const secondTierPages = useMemo(() => {
    return pages.filter(page => {
      const level = getLevel(page);
      return level === 1;
    });
  }, [pages]);

  // Pre-calculate adjusted Y positions for all pages
  const adjustedYPositions = useMemo(() => {
    const positions = new Map<string, number>();
    const VERTICAL_SPACING = 15; // Spacing between all cards
    const PARENT_TO_CHILD_GAP = 150; // Gap from Home to first tier only
    
    // Helper to get card height based on whether page has children
    const getCardHeight = (page: SitePage): number => {
      return page.children.length > 0 ? 90 : 80;
    };
    
    // Process each second-tier page and its content stack
    secondTierPages.forEach(secondTierPage => {
      const allDescendants = getAllDescendants(secondTierPage.id);
      const sortedDescendants = allDescendants.sort((a, b) => a.y - b.y);
      
      // Filter to only visible descendants
      const visibleDescendants = sortedDescendants.filter(desc => !isAnyAncestorCollapsed(desc));
      
      // Reposition visible descendants sequentially
      if (visibleDescendants.length > 0) {
        visibleDescendants.forEach((desc, index) => {
          if (index === 0) {
            // Position first child below parent with standard spacing
            const parentHeight = getCardHeight(secondTierPage);
            positions.set(desc.id, secondTierPage.y + parentHeight + VERTICAL_SPACING);
          } else {
            // Position relative to the previous visible page
            const prevPage = visibleDescendants[index - 1];
            const prevY = positions.get(prevPage.id) || prevPage.y;
            const prevHeight = getCardHeight(prevPage);
            positions.set(desc.id, prevY + prevHeight + VERTICAL_SPACING);
          }
        });
      }
    });
    
    return positions;
  }, [pages, collapsedGroups, secondTierPages]);

  // Calculate adjusted Y position for a page
  const getAdjustedY = (page: SitePage): number => {
    const level = getLevel(page);
    if (level <= 1) return page.y;
    return adjustedYPositions.get(page.id) || page.y;
  };

  // Calculate adjusted X position for a page based on visual level
  const getAdjustedX = (page: SitePage): number => {
    const INDENT_AMOUNT = 40; // pixels to indent per level
    
    // If page has a manual visual level set, apply the indent
    if (page.visualLevel !== undefined) {
      // Calculate the difference from auto level
      const getAutoLevel = (p: SitePage): number => {
        if (!p.parent) return 0;
        const parent = pages.find(pg => pg.id === p.parent);
        if (!parent) return 0;
        return getAutoLevel(parent) + 1;
      };
      
      const autoLevel = getAutoLevel(page);
      const visualOffset = page.visualLevel - autoLevel;
      return page.x + (visualOffset * INDENT_AMOUNT);
    }
    
    return page.x;
  };

  const contentStacks = useMemo(() => {
    const stacks: { [pageId: string]: { rootPage: SitePage; descendants: SitePage[]; bottomY: number } } = {};
    
    secondTierPages.forEach(secondTierPage => {
      const descendants = getAllDescendants(secondTierPage.id);
      const visibleDescendants = descendants.filter(desc => {
        return !isAnyAncestorCollapsed(desc);
      });
      
      if (visibleDescendants.length > 0) {
        const bottomMostY = Math.max(...visibleDescendants.map(d => getAdjustedY(d)));
        stacks[secondTierPage.id] = {
          rootPage: secondTierPage,
          descendants: visibleDescendants,
          bottomY: bottomMostY + 100 + 15
        };
      } else {
        stacks[secondTierPage.id] = {
          rootPage: secondTierPage,
          descendants: [],
          bottomY: secondTierPage.y + 100 + 15
        };
      }
    });
    
    return stacks;
  }, [secondTierPages, pages, collapsedGroups]);

  // Calculate footer pages positioning
  const footerSectionData = useMemo(() => {
    const homePage = getHomePage(pages);
    if (!homePage) {
      return { y: 600, centerX: 1000, width: 600 };
    }

    let lowestY = 600; // Default fallback
    let sectionWidth = 600; // Default width
    let centerX = homePage.x + 144; // Center under home page

    // Find the absolute lowest Y position across all pages (except footer pages)
    if (pages.length === 0) {
      lowestY = homePage.y + 100 + 150; // Home height + gap
      sectionWidth = 600; // Minimum width
    } else {
      // Get all visible pages (not collapsed) - inline check to avoid stale function reference
      const visiblePages = pages.filter(p => {
        if (!p.parent) return false; // Skip home
        let current = p;
        while (current.parent) {
          if (collapsedGroups.has(current.parent)) return false;
          const parent = pages.find(pg => pg.id === current.parent);
          if (!parent) break;
          current = parent;
        }
        return true;
      });
      
      if (visiblePages.length === 0) {
        // Only home page visible
        lowestY = homePage.y + 100 + 150;
      } else {
        // Find the lowest Y position among all visible pages - inline calculation
        const allBottomYs = visiblePages.map(p => {
          // Inline getLevel calculation
          const level = p.visualLevel !== undefined ? p.visualLevel : (() => {
            if (!p.parent) return 0;
            const parent = pages.find(pg => pg.id === p.parent);
            if (!parent) return 0;
            let lvl = 1;
            let curr = parent;
            while (curr.parent) {
              lvl++;
              const pr = pages.find(pg => pg.id === curr.parent);
              if (!pr) break;
              curr = pr;
            }
            return lvl;
          })();
          
          // Inline getAdjustedY calculation
          const adjustedY = level <= 1 ? p.y : (adjustedYPositions.get(p.id) || p.y);
          const cardHeight = p.children.length > 0 ? 90 : 80;
          const bottomY = adjustedY + cardHeight;
          
          return bottomY;
        });
        lowestY = Math.max(...allBottomYs) + 100; // 100px gap below the lowest page
      }
      
      // Calculate the width based on the content spread
      if (secondTierPages.length > 0) {
        const leftMost = Math.min(...secondTierPages.map(p => p.x));
        const rightMost = Math.max(...secondTierPages.map(p => p.x + 288)); // 288 is card width
        sectionWidth = Math.max(600, rightMost - leftMost); // At least 600px wide
        centerX = leftMost + sectionWidth / 2; // Center of the content area
      }
    }

    return { y: lowestY, centerX, width: sectionWidth };
  }, [pages, secondTierPages, collapsedGroups, adjustedYPositions]);

  const handleDeleteConfirm = (pageId: string) => {
    if (isViewOnly) return;
    setPageToDelete(pageId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setPageToDelete(null);
    setDeleteChildrenOption('move'); // Reset to default
  };

  const handleDeleteExecute = () => {
    if (pageToDelete && !isViewOnly) {
      onDeletePage(pageToDelete, deleteChildrenOption === 'delete');
      setDeleteDialogOpen(false);
      setPageToDelete(null);
      setDeleteChildrenOption('move'); // Reset to default
    }
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(3, zoom + 0.25);
    if (newZoom !== zoom && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const rect = container.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const canvasX = (centerX - panOffset.x) / zoom;
      const canvasY = (centerY - panOffset.y) / zoom;
      
      const newPanX = centerX - canvasX * newZoom;
      const newPanY = centerY - canvasY * newZoom;
      
      const boundedOffset = applyScrollBounds({ x: newPanX, y: newPanY });
      setPanOffset(boundedOffset);
      onZoomChange(newZoom);
    }
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.25, zoom - 0.25);
    if (newZoom !== zoom && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const rect = container.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const canvasX = (centerX - panOffset.x) / zoom;
      const canvasY = (centerY - panOffset.y) / zoom;
      
      const newPanX = centerX - canvasX * newZoom;
      const newPanY = centerY - canvasY * newZoom;
      
      const boundedOffset = applyScrollBounds({ x: newPanX, y: newPanY });
      setPanOffset(boundedOffset);
      onZoomChange(newZoom);
    }
  };

  const handleResetZoom = () => {
    onZoomChange(1);
    
    const homePage = getHomePage(pages);
    if (homePage && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const rect = container.getBoundingClientRect();
      // Center horizontally and position with 40px gap from top
      const targetX = rect.width / 2 - (homePage.x + 144);
      const targetY = TOP_GAP - homePage.y;
      
      const boundedOffset = applyScrollBounds({ x: targetX, y: targetY });
      setPanOffset(boundedOffset);
    } else {
      setPanOffset({ x: 0, y: 0 });
    }
  };

  const handleSliderZoomChange = (newZoom: number) => {
    if (newZoom !== zoom && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const rect = container.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const canvasX = (centerX - panOffset.x) / zoom;
      const canvasY = (centerY - panOffset.y) / zoom;
      
      const newPanX = centerX - canvasX * newZoom;
      const newPanY = centerY - canvasY * newZoom;
      
      const boundedOffset = applyScrollBounds({ x: newPanX, y: newPanY });
      setPanOffset(boundedOffset);
      onZoomChange(newZoom);
    } else {
      onZoomChange(newZoom);
    }
  };

  const handleDragStart = (e: React.DragEvent, pageId: string) => {
    if (isViewOnly) {
      e.preventDefault();
      return;
    }
    
    const page = pages.find(p => p.id === pageId);
    const homePage = getHomePage(pages);
    if (page && homePage && page.id === homePage.id) {
      e.preventDefault();
      return;
    }
    
    setDraggedPageId(pageId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', pageId);
    
    stopAutoScroll();
  };

  const handleDragEnd = () => {
    setDraggedPageId(null);
    setDropTarget(null);
    setDraggedFooterPageId(null);
    setFooterDropTarget(null);
    stopAutoScroll();
  };

  const handleDragOver = (e: React.DragEvent, targetPageId: string) => {
    if (isViewOnly || !draggedPageId || draggedPageId === targetPageId) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;
    
    const targetPage = pages.find(p => p.id === targetPageId);
    const draggedPage = pages.find(p => p.id === draggedPageId);
    
    let position: 'before' | 'after' | 'child';
    
    const targetLevel = targetPage ? getLevel(targetPage) : 0;
    const draggedLevel = draggedPage ? getLevel(draggedPage) : 0;
    const bothInContentStack = targetLevel >= 2 && draggedLevel >= 2;
    
    if (bothInContentStack) {
      if (y < height * 0.5) {
        position = 'before';
      } else {
        position = 'after';
      }
    } else {
      const horizontalThreshold = width * 0.25;
      const verticalThreshold = height * 0.25;

      if (x < horizontalThreshold) {
        position = 'before';
      } else if (x > width - horizontalThreshold) {
        position = 'after';
      } else if (y < verticalThreshold) {
        position = 'before';
      } else if (y > height - verticalThreshold) {
        position = 'after';
      } else {
        position = 'child';
      }
    }

    setDropTarget({ pageId: targetPageId, position });
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropTarget(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetPageId: string) => {
    if (isViewOnly) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    stopAutoScroll();
    
    if (!draggedPageId || !dropTarget || draggedPageId === targetPageId) return;

    const isDescendant = (pageId: string, ancestorId: string): boolean => {
      const page = pages.find(p => p.id === pageId);
      if (!page || !page.parent) return false;
      if (page.parent === ancestorId) return true;
      return isDescendant(page.parent, ancestorId);
    };

    if (isDescendant(targetPageId, draggedPageId)) {
      setDropTarget(null);
      setDraggedPageId(null);
      return;
    }

    onDragReorder(draggedPageId, targetPageId, dropTarget.position);
    setDropTarget(null);
    setDraggedPageId(null);
  };

  // Footer page drag handlers
  const handleFooterDragStart = (e: React.DragEvent, pageId: string) => {
    if (isViewOnly) {
      e.preventDefault();
      return;
    }
    
    setDraggedFooterPageId(pageId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', pageId);
    
    stopAutoScroll();
  };

  const handleFooterDragOver = (e: React.DragEvent, targetPageId: string) => {
    if (isViewOnly || !draggedFooterPageId || draggedFooterPageId === targetPageId) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    
    const position = x < width / 2 ? 'before' : 'after';
    setFooterDropTarget({ pageId: targetPageId, position });
  };

  const handleFooterDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setFooterDropTarget(null);
    }
  };

  const handleFooterDrop = (e: React.DragEvent, targetPageId: string) => {
    if (isViewOnly) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    stopAutoScroll();
    
    if (!draggedFooterPageId || !footerDropTarget || draggedFooterPageId === targetPageId) return;

    if (onReorderFooterPages) {
      onReorderFooterPages(draggedFooterPageId, targetPageId, footerDropTarget.position);
    }
    
    setFooterDropTarget(null);
    setDraggedFooterPageId(null);
  };

  // Bulk edit handlers
  const handleCheckboxToggle = (pageId: string) => {
    setSelectedPageIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pageId)) {
        newSet.delete(pageId);
      } else {
        newSet.add(pageId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const homePage = getHomePage(pages);
    const allSelectablePages = pages.filter(p => !homePage || p.id !== homePage.id);

    setSelectedPageIds(new Set(allSelectablePages.map(p => p.id)));
  };

  const handleDeselectAll = () => {
    setSelectedPageIds(new Set());
  };

  const handleBulkColorChange = (color: string) => {
    if (selectedPageIds.size > 0 && onBulkUpdatePages) {
      onBulkUpdatePages(Array.from(selectedPageIds), { color });
      // Keep pages selected to allow multiple operations
    }
  };

  const handleBulkPageTypeChange = (pageTypeId: string) => {
    if (selectedPageIds.size > 0 && onBulkUpdatePages) {
      // Find the page type to get its icon and color
      const pageType = pageTypes.find(pt => pt.id === pageTypeId);
      if (pageType) {
        onBulkUpdatePages(Array.from(selectedPageIds), { 
          pageType: pageTypeId,
          icon: pageType.icon,
          color: String(pageType.color)
        });
      } else {
        // Fallback if page type not found
        onBulkUpdatePages(Array.from(selectedPageIds), { pageType: pageTypeId });
      }
      // Keep pages selected to allow multiple operations
    }
  };

  const handleBulkDeleteConfirm = () => {
    if (selectedPageIds.size > 0) {
      setBulkDeleteDialogOpen(true);
    }
  };

  const handleBulkDeleteExecute = () => {
    if (selectedPageIds.size > 0 && onBulkDeletePages) {
      onBulkDeletePages(Array.from(selectedPageIds));
      setSelectedPageIds(new Set()); // Clear selection after delete
      setBulkDeleteDialogOpen(false);
    }
  };

  const handleBulkDeleteCancel = () => {
    setBulkDeleteDialogOpen(false);
  };

  // Show bulk edit when pages are selected
  useEffect(() => {
    setShowBulkEdit(selectedPageIds.size > 0);
  }, [selectedPageIds]);

  const renderConnections = () => {
    return pages.map(page => {
      if (!page.parent) return null;
      
      const parent = pages.find(p => p.id === page.parent);
      if (!parent) return null;

      const level = getLevel(page);
      if (level !== 1) return null;

      // Don't render connection lines if any ancestor is collapsed
      if (isAnyAncestorCollapsed(page)) return null;

      const parentCenterX = getAdjustedX(parent) + 144;
      const parentBottomY = parent.y + 100;
      const childCenterX = getAdjustedX(page) + 144;
      const childTopY = getAdjustedY(page);

      const midY = parentBottomY + 40;

      return (
        <svg
          key={`connection-${page.id}`}
          className="absolute pointer-events-none"
          style={{
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            zIndex: 1
          }}
        >
          <line
            x1={parentCenterX}
            y1={parentBottomY}
            x2={parentCenterX}
            y2={midY}
            stroke="currentColor"
            strokeWidth={2}
            className="text-border"
          />
          
          <line
            x1={parentCenterX}
            y1={midY}
            x2={childCenterX}
            y2={midY}
            stroke="currentColor"
            strokeWidth={2}
            className="text-border"
          />
          
          <line
            x1={childCenterX}
            y1={midY}
            x2={childCenterX}
            y2={childTopY}
            stroke="currentColor"
            strokeWidth={2}
            className="text-border"
          />
          
          <polygon
            points={`${childCenterX-4},${childTopY-8} ${childCenterX+4},${childTopY-8} ${childCenterX},${childTopY}`}
            fill="currentColor"
            className="text-border"
          />
        </svg>
      );
    });
  };

  const renderContentStackConnections = () => {
    const connections: JSX.Element[] = [];

    // Helper to get card height based on whether page has children
    const getCardHeight = (page: SitePage): number => {
      return page.children.length > 0 ? 90 : 80;
    };

    // Helper to get center Y position of a card
    const getCenterY = (page: SitePage): number => {
      return getAdjustedY(page) + (getCardHeight(page) / 2);
    };

    pages.forEach(parentPage => {
      if (collapsedGroups.has(parentPage.id) || parentPage.children.length === 0) return;

      const parentLevel = getLevel(parentPage);
      if (parentLevel < 1) return;

      // Don't render if the parent itself has a collapsed ancestor
      if (isAnyAncestorCollapsed(parentPage)) return;

      const children = parentPage.children
        .map(childId => pages.find(p => p.id === childId))
        .filter(Boolean) as SitePage[];

      if (children.length === 0) return;

      const parentCenterX = getAdjustedX(parentPage) + 144;
      const parentCenterY = getCenterY(parentPage);
      const connectionX = getAdjustedX(parentPage) + 10;

      if (children.length > 1) {
        const firstChild = children[0];
        const lastChild = children[children.length - 1];
        const firstChildY = getCenterY(firstChild);
        const lastChildY = getCenterY(lastChild);

        connections.push(
          <svg
            key={`parent-children-${parentPage.id}`}
            className="absolute pointer-events-none"
            style={{
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              zIndex: 1
            }}
          >
            <line
              x1={connectionX}
              y1={firstChildY}
              x2={connectionX}
              y2={lastChildY}
              stroke="currentColor"
              strokeWidth={1}
              className="text-muted-foreground"
            />
          </svg>
        );
      }

      const firstChild = children[0];
      const firstChildY = getCenterY(firstChild);

      connections.push(
        <svg
          key={`parent-to-children-${parentPage.id}`}
          className="absolute pointer-events-none"
          style={{
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            zIndex: 1
          }}
        >
          <line
            x1={parentPage.x}
            y1={parentCenterY}
            x2={connectionX}
            y2={parentCenterY}
            stroke="currentColor"
            strokeWidth={1}
            className="text-muted-foreground"
          />
          
          <line
            x1={connectionX}
            y1={parentCenterY}
            x2={connectionX}
            y2={firstChildY}
            stroke="currentColor"
            strokeWidth={1}
            className="text-muted-foreground"
          />
        </svg>
      );

      children.forEach(child => {
        const childCenterY = getCenterY(child);
        const isIndented = child.visualLevel !== undefined;
        
        connections.push(
          <svg
            key={`child-connection-${child.id}`}
            className="absolute pointer-events-none"
            style={{
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              zIndex: 1
            }}
          >
            {/* Define arrow marker for indented pages */}
            {isIndented && (
              <defs>
                <marker
                  id={`arrow-${child.id}`}
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path
                    d="M0,0 L0,6 L9,3 z"
                    fill="currentColor"
                    className="text-muted-foreground"
                  />
                </marker>
              </defs>
            )}
            <line
              x1={connectionX}
              y1={childCenterY}
              x2={getAdjustedX(child)}
              y2={childCenterY}
              stroke="currentColor"
              strokeWidth={1}
              className="text-muted-foreground"
              markerEnd={isIndented ? `url(#arrow-${child.id})` : undefined}
            />
          </svg>
        );
      });
    });

    return connections;
  };

  // Get homepage once for render logic
  const homePage = getHomePage(pages);
  const homePageId = homePage?.id;

  return (
    <div className="flex-1 relative overflow-hidden bg-background" data-canvas-container>
      {/* Zoom Controls - Always visible */}
      <div className="absolute top-4 left-4 z-40 flex items-center gap-2 bg-background/90 backdrop-blur-sm border rounded-lg p-2 shadow-sm">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleZoomOut}
            disabled={zoom <= 0.25}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-2 px-2">
            <Slider
              value={[zoom]}
              onValueChange={([value]) => handleSliderZoomChange(value)}
              min={0.25}
              max={3}
              step={0.25}
              className="w-24"
            />
            <span className="text-sm font-mono w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleZoomIn}
            disabled={zoom >= 3}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          
          <div className="h-4 w-px bg-border mx-1" />
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={handleResetZoom}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset zoom and center Home page</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

      {/* Main Canvas */}
      <div
        ref={scrollContainerRef}
        className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        onMouseDown={handleMouseDown}
      >
        <div
          ref={canvasRef}
          className="relative"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: '4000px',
            height: '3000px',
          }}
          data-sitemap-content
        >
          {/* Connection lines */}
          {renderConnections()}
          {renderContentStackConnections()}

          {/* Pages */}
          {pages.map((page) => {
            const isSelected = selectedPageId === page.id;
            const isDragging = draggedPageId === page.id;
            const isDropTargetPage = dropTarget?.pageId === page.id;
            const level = getLevel(page);
            const hasChildren = page.children.length > 0;
            const isCollapsed = collapsedGroups.has(page.id);
            const isHidden = isAnyAncestorCollapsed(page);
            const isExpanded = expandedCardId === page.id;
            const isSelectedForBulkEdit = selectedPageIds.has(page.id);

            if (isHidden) return null;

            let dropClasses = '';
            if (isDropTargetPage && !isViewOnly) {
              const targetPage = pages.find(p => p.id === page.id);
              const targetLevel = targetPage ? getLevel(targetPage) : 0;
              
              // For first-tier pages (horizontal siblings), use vertical drop indicators
              const useVerticalIndicator = targetLevel === 1 && (dropTarget.position === 'before' || dropTarget.position === 'after');
              
              if (useVerticalIndicator) {
                dropClasses = `drop-target drop-${dropTarget.position}-vertical`;
              } else {
                dropClasses = `drop-target drop-${dropTarget.position}`;
              }
            }

            return (
              <Card
                key={page.id}
                data-page-card
                data-page-id={page.id}
                className={`absolute w-72 ${hasChildren ? 'h-[90px]' : 'h-[80px]'} cursor-pointer transition-all duration-200 hover:shadow-md ${
                  isSelected ? 'ring-2 ring-primary shadow-lg' : ''
                } ${isSelectedForBulkEdit ? 'ring-2 ring-blue-400 shadow-md bg-blue-50/50' : ''} ${isDragging ? 'opacity-50 scale-105 z-50' : ''} ${dropClasses} ${isExpanded ? 'z-[60] bg-card' : ''}`}
                style={{
                  left: getAdjustedX(page),
                  top: getAdjustedY(page),
                  zIndex: isSelected ? 30 : isDragging ? 50 : isExpanded ? 60 : 10,
                }}
                onClick={(e) => {
                  // Prevent selection if clicking on buttons, checkboxes, or expanded actions
                  if (e.target instanceof HTMLElement) {
                    const isButton = e.target.closest('button');
                    const isCheckbox = e.target.closest('[role="checkbox"]') || e.target.type === 'checkbox';
                    if (isButton || isCheckbox) {
                      return;
                    }
                  }
                  onSelectPage(page.id);
                }}
                draggable={!isViewOnly && page.id !== homePageId}
                onDragStart={(e) => handleDragStart(e, page.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, page.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, page.id)}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {!isViewOnly && page.id !== homePageId && (
                        <Checkbox
                          checked={selectedPageIds.has(page.id)}
                          onCheckedChange={() => handleCheckboxToggle(page.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      <div className={`${page.color} text-white p-2 rounded`}>
                        {page.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">{String(page.name)}</h3>
                          <CommentIndicator
                            commentCount={commentCounts[page.id] || 0}
                            className="flex-shrink-0"
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {String(getPageTypeInfo(page)?.name || 'Page')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {hasChildren && level >= 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleCollapse(page.id);
                          }}
                        >
                          {isCollapsed ? (
                            <ChevronRight className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                      
                      {/* Simple button that expands the card to show actions */}
                      {!isViewOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-accent/80"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedCardId(isExpanded ? null : page.id);
                          }}
                          title="Page actions"
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Expanded actions - show inline */}
                  {!isViewOnly && isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border space-y-2 bg-card">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddChildPage(page.id);
                          setExpandedCardId(null);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-2" />
                        Add Child Page
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddSiblingPage(page.id);
                          setExpandedCardId(null);
                        }}
                      >
                        <Copy className="h-3 w-3 mr-2" />
                        Add Sibling Page
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicatePage(page.id);
                          setExpandedCardId(null);
                        }}
                      >
                        <Files className="h-3 w-3 mr-2" />
                        Duplicate Page
                      </Button>
                      
                      {page.id !== homePageId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-sm text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConfirm(page.id);
                            setExpandedCardId(null);
                          }}
                        >
                          <Trash2 className="h-3 w-3 mr-2" />
                          Delete Page
                        </Button>
                      )}
                    </div>
                  )}
                  
                  {page.children.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {page.children.length} child page{page.children.length !== 1 ? 's' : ''}
                      {isCollapsed && ' (collapsed)'}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}

          {/* NEW: Plus button below home when no second-tier pages exist */}
          {!isViewOnly && siblingGroups['root'] && homePage && secondTierPages.length === 0 && (
                  <TooltipProvider key="home-below-plus">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="absolute floating-plus bg-background border-2 border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5 rounded-full h-8 w-8 p-0"
                          style={{
                            left: homePage.x + 144 - 16,
                            top: homePage.y + 100 + 20,
                            zIndex: 20,
                          }}
                          onClick={onAddBelowHome}
                        >
                          <Plus className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add content stack</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
          )}

          {/* Left and right plus buttons for adding new first tier items */}
          {!isViewOnly && secondTierPages.length > 0 && (
            (() => {
              const leftMost = Math.min(...secondTierPages.map(p => p.x));
              const rightMost = Math.max(...secondTierPages.map(p => p.x + 288)); // 288 is card width
              const centerY = secondTierPages.length > 0 ? secondTierPages[0].y + 50 : 0;
              
              return (
                <>
                  {/* Left plus button */}
                  <TooltipProvider key="content-left-plus">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="absolute floating-plus bg-background border-2 border-dashed border-muted-foreground/20 hover:border-primary hover:bg-primary/5 rounded-full h-8 w-8 p-0"
                          style={{
                            left: leftMost - 50,
                            top: centerY - 16,
                            zIndex: 20,
                          }}
                          onClick={onAddLeftOfContentStacks}
                        >
                          <Plus className="h-4 w-4 text-muted-foreground/50" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add page to left</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Right plus button */}
                  <TooltipProvider key="content-right-plus">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="absolute floating-plus bg-background border-2 border-dashed border-muted-foreground/20 hover:border-primary hover:bg-primary/5 rounded-full h-8 w-8 p-0"
                          style={{
                            left: rightMost + 18,
                            top: centerY - 16,
                            zIndex: 20,
                          }}
                          onClick={onAddRightOfContentStacks}
                        >
                          <Plus className="h-4 w-4 text-muted-foreground/50" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add page to right</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              );
            })()
          )}

          {/* Content Stack Plus Buttons - Only show in edit mode */}
          {!isViewOnly && Object.entries(contentStacks).map(([pageId, stack]) => (
            <TooltipProvider key={`${pageId}-stack-plus`}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    className="absolute floating-plus bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-full h-8 w-8 p-0"
                    style={{
                      left: stack.rootPage.x + 144 - 16,
                      top: stack.bottomY,
                      zIndex: 20,
                    }}
                    onClick={() => onAddChildPage(pageId)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add page to content stack</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
          
          {/* Footer Pages Section */}
          <div 
            className="absolute"
            style={{
              left: footerSectionData.centerX - footerSectionData.width / 2,
              top: footerSectionData.y,
              width: footerSectionData.width,
              zIndex: 10
            }}
          >
            {/* Footer Pages Divider Line */}
            <div className="relative w-full flex items-center justify-center mb-8">
              <div className="absolute left-0 right-0 h-px bg-gray-300 dark:bg-gray-600"></div>
              <div className="relative bg-background px-4 py-2 text-sm text-muted-foreground">
                Footer Pages
              </div>
            </div>
            
            {/* Footer Pages Container */}
            <div className="flex flex-wrap gap-4 justify-center items-start">
              {footerPages.length === 0 && !isViewOnly && onAddFooterPage ? (
                /* Initial Add Footer Page Button when no footer pages exist */
                <div className="relative flex items-center justify-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="floating-plus h-12 w-12 rounded-full border-2 border-dashed border-muted-foreground/50 hover:border-primary hover:bg-primary/5 bg-background/80 backdrop-blur-sm"
                          onClick={onAddFooterPage}
                        >
                          <Plus className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add first footer page</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              ) : (
                <>
                  {footerPages.map((footerPage) => {
                    const isDraggingFooter = draggedFooterPageId === footerPage.id;
                    const isFooterDropTarget = footerDropTarget?.pageId === footerPage.id;
                    
                    let footerDropClasses = '';
                    if (isFooterDropTarget && !isViewOnly) {
                      footerDropClasses = `drop-target drop-${footerDropTarget.position}-vertical`;
                    }
                    
                    return (
                      <div
                        key={footerPage.id}
                        data-page-id={footerPage.id}
                        className={`relative ${
                          selectedPageId === footerPage.id ? 'ring-2 ring-primary' : ''
                        } ${isDraggingFooter ? 'opacity-50 scale-105 z-50' : ''} ${footerDropClasses}`}
                        style={{
                          width: 288,
                          height: 80
                        }}
                      >
                        <Card
                          className={`h-full cursor-pointer transition-all duration-200 hover:shadow-lg group ${
                            selectedPageId === footerPage.id 
                              ? 'ring-2 ring-primary shadow-lg' 
                              : 'hover:shadow-md'
                          }`}
                          onClick={() => onSelectPage(footerPage.id)}
                          draggable={!isViewOnly}
                          onDragStart={(e) => handleFooterDragStart(e, footerPage.id)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleFooterDragOver(e, footerPage.id)}
                          onDragLeave={handleFooterDragLeave}
                          onDrop={(e) => handleFooterDrop(e, footerPage.id)}
                        >
                        <div className="p-4 h-full">
                          <div className="flex items-center justify-between h-full">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`${footerPage.color} text-white p-2 rounded flex-shrink-0`}>
                                {footerPage.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium truncate text-sm">
                                    {String(footerPage.name)}
                                  </p>
                                  <CommentIndicator
                                    commentCount={commentCounts[footerPage.id] || 0}
                                    className="flex-shrink-0"
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground truncate">
                                  Footer Page
                                </p>
                              </div>
                            </div>
                            
                            {!isViewOnly && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 hover:bg-muted"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (onDeleteFooterPage) {
                                            onDeleteFooterPage(footerPage.id);
                                          }
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete footer page</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    </div>
                  );
                  })}
                  
                  {/* Add Another Footer Page Button */}
                  {!isViewOnly && onAddFooterPage && (
                    <div
                      className="relative flex items-center justify-center"
                      style={{
                        width: 288,
                        height: 80
                      }}
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="floating-plus h-10 w-10 rounded-full border-2 border-dashed border-muted-foreground/50 hover:border-primary hover:bg-primary/5 bg-background/80 backdrop-blur-sm"
                              onClick={onAddFooterPage}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Add footer page</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Edit Panel */}
      {!isViewOnly && showBulkEdit && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-background/95 backdrop-blur-sm border rounded-lg p-4 shadow-lg min-w-[600px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium">Bulk Edit ({selectedPageIds.size} pages selected)</h3>
              <p className="text-sm text-muted-foreground">
                Selected: {Array.from(selectedPageIds).map(id => {
                  const page = pages.find(p => p.id === id);
                  return page?.name;
                }).filter(Boolean).join(', ') || 'None'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedPageIds(new Set())}
              className="h-8 w-8 p-0"
            >
              ×
            </Button>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeselectAll}
              >
                Deselect All
              </Button>
            </div>
            
            <div className="h-4 w-px bg-border" />
            
            <div className="flex items-center gap-2">
              <span className="text-sm">Color:</span>
              <div className="flex gap-1">
                {[
                  'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500',
                  'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-gray-500'
                ].map(color => (
                  <button
                    key={color}
                    className={`w-6 h-6 rounded ${color} border-2 border-white hover:scale-110 transition-transform`}
                    onClick={() => handleBulkColorChange(color)}
                  />
                ))}
              </div>
            </div>
            
            <div className="h-4 w-px bg-border" />
            
            <div className="flex items-center gap-2">
              <span className="text-sm">Page Type:</span>
              <Select onValueChange={handleBulkPageTypeChange}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {pageTypes.map(type => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="h-4 w-px bg-border" />
            
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDeleteConfirm}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog - Only show in edit mode */}
      {!isViewOnly && (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Page</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this page? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            {pageToDelete && pages.find(p => p.id === pageToDelete)?.children.length ? (
              <div className="py-4">
                <Label className="text-sm font-medium mb-3 block">What should happen to the child pages?</Label>
                <RadioGroup value={deleteChildrenOption} onValueChange={(value) => setDeleteChildrenOption(value as 'move' | 'delete')}>
                  <div className="flex items-center space-x-2 mb-2">
                    <RadioGroupItem value="move" id="move" />
                    <Label htmlFor="move" className="font-normal cursor-pointer">
                      Move child pages to parent (keep them)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="delete" id="delete" />
                    <Label htmlFor="delete" className="font-normal cursor-pointer text-destructive">
                      Delete all child pages as well
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            ) : null}
            
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleDeleteCancel}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteExecute}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Page
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      {!isViewOnly && (
        <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Multiple Pages</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedPageIds.size} selected page{selectedPageIds.size !== 1 ? 's' : ''}?
                <span className="block mt-2 font-semibold text-destructive">
                  This action cannot be undone and cannot be restored.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleBulkDeleteCancel}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkDeleteExecute}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete {selectedPageIds.size} Page{selectedPageIds.size !== 1 ? 's' : ''}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

// Export types for backward compatibility
export type { SitePage, PageType };
