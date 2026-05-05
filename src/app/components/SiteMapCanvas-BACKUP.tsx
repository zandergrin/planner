import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { MoreHorizontal, Edit, Trash2, Copy, Plus, ChevronDown, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
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
import { SitePage, PageType } from '../utils/storage';

interface SiteMapCanvasProps {
  pages: SitePage[];
  onUpdatePage: (id: string, updates: Partial<SitePage>) => void;
  onDeletePage: (id: string) => void;
  onSelectPage: (id: string) => void;
  onAddChildPage: (parentId: string) => void;
  onAddSiblingPage: (siblingId: string) => void;
  onDragReorder: (draggedPageId: string, targetPageId: string | null, dropPosition: 'before' | 'after' | 'child' | 'root') => void;
  onAddLeftOfHome: () => void;
  onAddRightOfHome: () => void;
  selectedPageId?: string;
  rootPageOrder: string[];
  collapsedGroups: Set<string>;
  onToggleCollapse: (parentId: string) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  pageTypes: PageType[];
  isViewOnly?: boolean;
}

export function SiteMapCanvas({ 
  pages, 
  onUpdatePage, 
  onDeletePage, 
  onSelectPage, 
  onAddChildPage, 
  onAddSiblingPage,
  onDragReorder,
  onAddLeftOfHome,
  onAddRightOfHome,
  selectedPageId,
  rootPageOrder,
  collapsedGroups,
  onToggleCollapse,
  zoom,
  onZoomChange,
  pageTypes,
  isViewOnly = false
}: SiteMapCanvasProps) {
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ pageId: string; position: 'before' | 'after' | 'child' } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<string | null>(null);
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
    const homePage = pages.find(p => String(p.name).toLowerCase() === 'home');
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
      const homePage = pages.find(p => String(p.name).toLowerCase() === 'home');
      
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

  // Auto-recenter when pages layout changes (for better UX)
  useEffect(() => {
    if (isInitialized && pages.length > 0 && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const containerRect = container.getBoundingClientRect();
      const homePage = pages.find(p => String(p.name).toLowerCase() === 'home');
      
      if (homePage) {
        // Only recenter if home page position has changed significantly
        const currentCenterX = (containerRect.width / 2 - panOffset.x) / zoom;
        const currentCenterY = (TOP_GAP - panOffset.y) / zoom;
        const expectedHomeX = homePage.x + 144;
        const expectedHomeY = homePage.y;
        
        // If home page has moved more than 50px from center, recenter
        const deltaX = Math.abs(currentCenterX - expectedHomeX);
        const deltaY = Math.abs(currentCenterY - expectedHomeY);
        
        if (deltaX > 50 || deltaY > 50) {
          const targetX = containerRect.width / 2 - (homePage.x + 144) * zoom;
          const targetY = TOP_GAP - (homePage.y * zoom);
          
          const boundedOffset = applyScrollBounds({ x: targetX, y: targetY });
          setPanOffset(boundedOffset);
        }
      }
    }
  }, [pages.length, pages.map(p => `${p.id}-${p.x}-${p.y}`).join(','), zoom, isInitialized, applyScrollBounds, TOP_GAP]);

  // Helper function to get page level
  const getLevel = (page: SitePage): number => {
    if (!page.parent) return 0;
    const parent = pages.find(p => p.id === page.parent);
    if (!parent) return 0;
    return getLevel(parent) + 1;
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

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    
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
      if (!isViewOnly) {
        document.removeEventListener('dragover', handleDragMove);
      }
    };
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd, handleMouseMove, handleMouseLeave, handleDragMove, isViewOnly]);

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

  const contentStacks = useMemo(() => {
    const stacks: { [pageId: string]: { rootPage: SitePage; descendants: SitePage[]; bottomY: number } } = {};
    
    secondTierPages.forEach(secondTierPage => {
      const descendants = getAllDescendants(secondTierPage.id);
      const visibleDescendants = descendants.filter(desc => {
        return !collapsedGroups.has(secondTierPage.id);
      });
      
      if (visibleDescendants.length > 0) {
        const bottomMostY = Math.max(...visibleDescendants.map(d => d.y));
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

  const handleDeleteConfirm = (pageId: string) => {
    if (isViewOnly) return;
    setPageToDelete(pageId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setPageToDelete(null);
  };

  const handleDeleteExecute = () => {
    if (pageToDelete && !isViewOnly) {
      onDeletePage(pageToDelete);
      setDeleteDialogOpen(false);
      setPageToDelete(null);
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
    
    const homePage = pages.find(p => String(p.name).toLowerCase() === 'home');
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
    if (page && String(page.name).toLowerCase() === 'home') {
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

  const renderConnections = () => {
    return pages.map(page => {
      if (!page.parent) return null;
      
      const parent = pages.find(p => p.id === page.parent);
      if (!parent) return null;

      const level = getLevel(page);
      if (level !== 1) return null;

      const parentCenterX = parent.x + 144;
      const parentBottomY = parent.y + 100;
      const childCenterX = page.x + 144;
      const childTopY = page.y;

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

    pages.forEach(parentPage => {
      if (collapsedGroups.has(parentPage.id) || parentPage.children.length === 0) return;

      const parentLevel = getLevel(parentPage);
      if (parentLevel < 1) return;

      const children = parentPage.children
        .map(childId => pages.find(p => p.id === childId))
        .filter(Boolean) as SitePage[];

      if (children.length === 0) return;

      const parentCenterX = parentPage.x + 144;
      const parentCenterY = parentPage.y + 50;
      const connectionX = parentPage.x + 10;

      if (children.length > 1) {
        const firstChild = children[0];
        const lastChild = children[children.length - 1];
        const firstChildY = firstChild.y + 50;
        const lastChildY = lastChild.y + 50;

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
      const firstChildY = firstChild.y + 50;

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
        const childCenterY = child.y + 50;
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
            <line
              x1={connectionX}
              y1={childCenterY}
              x2={child.x}
              y2={childCenterY}
              stroke="currentColor"
              strokeWidth={1}
              className="text-muted-foreground"
            />
          </svg>
        );
      });
    });

    return connections;
  };

  // Rest of the component implementation...
  // [Note: This is a backup file to preserve the working canvas functionality]
  
  return null; // Placeholder - full implementation would continue here
}