import { useState } from 'react';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { Button } from './ui/button';
import { SitePage } from './SiteMapCanvas';

interface PageListViewProps {
  pages: SitePage[];
  selectedPageId?: string;
  onSelectPage: (id: string) => void;
  onReorderPages: (pageId: string, newIndex: number) => void;
  pageType?: string;
}

export function PageListView({ pages, selectedPageId, onSelectPage, onReorderPages, pageType }: PageListViewProps) {
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set(['1'])); // Expand home by default
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);

  const toggleExpanded = (pageId: string) => {
    const newExpanded = new Set(expandedPages);
    if (newExpanded.has(pageId)) {
      newExpanded.delete(pageId);
    } else {
      newExpanded.add(pageId);
    }
    setExpandedPages(newExpanded);
  };

  const getPageTypeFromName = (pageName: string, isRoot: boolean): string => {
    if (isRoot) return 'home'; // Root page is always home type
    const name = pageName.toLowerCase();
    if (name.includes('about')) return 'about';
    if (name.includes('contact')) return 'contact';
    if (name.includes('product')) return 'product';
    if (name.includes('profile')) return 'profile';
    if (name.includes('search')) return 'search';
    return 'content';
  };

  const filteredPages = pageType === 'overview' 
    ? pages 
    : pages.filter(page => getPageTypeFromName(page.name, !page.parent) === pageType);

  const rootPages = filteredPages.filter(page => !page.parent);

  const handleDragStart = (e: React.DragEvent, pageId: string) => {
    setDraggedPageId(pageId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetPageId: string) => {
    e.preventDefault();
    if (!draggedPageId || draggedPageId === targetPageId) return;

    const draggedPage = pages.find(p => p.id === draggedPageId);
    const targetPage = pages.find(p => p.id === targetPageId);
    
    if (!draggedPage || !targetPage) return;

    // Only allow reordering within the same parent level
    if (draggedPage.parent === targetPage.parent) {
      const siblings = pages.filter(p => p.parent === draggedPage.parent);
      const targetIndex = siblings.findIndex(p => p.id === targetPageId);
      onReorderPages(draggedPageId, targetIndex);
    }

    setDraggedPageId(null);
  };

  const renderPageItem = (page: SitePage, level = 0) => {
    const children = filteredPages.filter(p => p.parent === page.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedPages.has(page.id);
    const isSelected = selectedPageId === page.id;
    const isDragging = draggedPageId === page.id;

    return (
      <div key={page.id} className="space-y-1">
        <div 
          className={`flex items-center space-x-2 p-2 rounded hover:bg-accent/50 cursor-pointer transition-colors ${
            isSelected ? 'bg-accent' : ''
          } ${isDragging ? 'opacity-50' : ''}`}
          style={{ paddingLeft: `${8 + level * 16}px` }}
          onClick={() => onSelectPage(page.id)}
          draggable={level > 0} // Allow dragging for non-root pages
          onDragStart={(e) => handleDragStart(e, page.id)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, page.id)}
        >
          {level > 0 && (
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          )}
          
          {hasChildren ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(page.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          ) : (
            <div className="w-4" />
          )}
          
          <div className={`${page.color} text-white p-1 rounded`}>
            {page.icon}
          </div>
          
          <span className="text-sm truncate flex-1">{page.name}</span>
        </div>
        
        {hasChildren && isExpanded && (
          <div className="space-y-1">
            {children.map(child => renderPageItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (filteredPages.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-4">
        <p className="text-sm">No pages created yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {rootPages.map(page => renderPageItem(page))}
    </div>
  );
}