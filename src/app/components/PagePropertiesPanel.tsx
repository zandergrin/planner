import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { 
  Settings, 
  Type,
  Palette,
  FileText,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Layers,
  MessageCircle,
  ChevronRight,
  ChevronLeft,
  Indent,
  Eye
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import type { SitePage, PageType } from '../utils/storage';
import { CommentsPanel } from './CommentsPanel';
import { AllCommentsViewer } from './AllCommentsViewer';

interface PagePropertiesPanelProps {
  page: SitePage | null;
  onUpdatePage: (id: string, updates: Partial<SitePage>) => void;
  pageTypes: PageType[];
  isViewOnly?: boolean;
  sitemapId?: string;
  allPages?: SitePage[];
  onSelectPage?: (pageId: string) => void;
  onCenterPage?: (pageId: string) => void; // Optional callback to center canvas on page
}

export interface PagePropertiesPanelRef {
  savePendingChanges: () => void;
}

export const PagePropertiesPanel = forwardRef<PagePropertiesPanelRef, PagePropertiesPanelProps>(
  function PagePropertiesPanel({ page, onUpdatePage, pageTypes, isViewOnly = false, sitemapId, allPages = [], onSelectPage, onCenterPage }, ref) {
    const [localName, setLocalName] = useState('');
    const [localDescription, setLocalDescription] = useState('');
    const [localUrl, setLocalUrl] = useState('');
    const [isPublished, setIsPublished] = useState(true);
    const [viewMode, setViewMode] = useState<'properties' | 'comments'>('properties');
    const [commentsRefreshKey, setCommentsRefreshKey] = useState(0);
    const editorRef = useRef<HTMLDivElement>(null);
    
    // Auto-save timer and pending changes
    const pendingChangesRef = useRef<Partial<SitePage>>({});
    const pendingPageIdRef = useRef<string | null>(null);
    
    // Track pending changes and save when explicitly called
    const savePendingChanges = useCallback(() => {
      if (pendingPageIdRef.current && !isViewOnly && Object.keys(pendingChangesRef.current).length > 0) {
        onUpdatePage(pendingPageIdRef.current, pendingChangesRef.current);
        pendingChangesRef.current = {};
        pendingPageIdRef.current = null;
      }
    }, [onUpdatePage, isViewOnly]);

    // Cleanup on unmount - save any pending changes
    useEffect(() => {
      return () => {
        if (pendingPageIdRef.current && !isViewOnly && Object.keys(pendingChangesRef.current).length > 0) {
          onUpdatePage(pendingPageIdRef.current, pendingChangesRef.current);
        }
      };
    }, []);

    // Build parent URL path recursively
    const getParentUrlPath = useCallback((pageId: string): string => {
      const currentPage = allPages.find(p => p.id === pageId);
      if (!currentPage || !currentPage.parent) {
        return '';
      }
      
      const parent = allPages.find(p => p.id === currentPage.parent);
      if (!parent) {
        return '';
      }
      
      // If parent has no parent itself, it's a root page - don't include it
      if (!parent.parent) {
        return '';
      }
      
      const parentUrl = (parent as any).url || `/${generateCleanSlug(parent.name)}`;
      const parentPath = getParentUrlPath(parent.id);
      
      // Combine parent path with current parent URL, removing duplicate slashes
      const combinedPath = parentPath + parentUrl;
      return combinedPath.replace(/\/+/g, '/');
    }, [allPages]);

    // Generate a clean URL slug from a name
    const generateCleanSlug = (name: string): string => {
      return name
        .toLowerCase()
        // Replace non-alphanumeric characters with spaces first
        .replace(/[^a-z0-9]+/g, ' ')
        // Trim leading/trailing spaces
        .trim()
        // Replace spaces with dashes
        .replace(/\s+/g, '-')
        // Replace multiple consecutive dashes with a single dash
        .replace(/-{2,}/g, '-');
    };

    // Get just the page's own URL slug (without parent path)
    const getOwnUrlSlug = useCallback((fullUrl: string, parentPath: string): string => {
      if (!parentPath) {
        return fullUrl.startsWith('/') ? fullUrl.slice(1) : fullUrl;
      }
      
      // Remove parent path from full URL
      const withoutParent = fullUrl.replace(parentPath, '');
      return withoutParent.startsWith('/') ? withoutParent.slice(1) : withoutParent;
    }, []);

    // Initialize local state when page changes
    useEffect(() => {
      if (page) {
        setLocalName(String(page.name));
        setLocalDescription(String((page as any).description || ''));
        
        // Use stored URL if available, otherwise generate from name
        const storedUrl = (page as any).url;
        if (storedUrl) {
          setLocalUrl(storedUrl);
        } else {
          const parentPath = getParentUrlPath(page.id);
          const generatedSlug = generateCleanSlug(String(page.name));
          const fullUrl = parentPath 
            ? `${parentPath}${parentPath.endsWith('/') ? '' : '/'}${generatedSlug}`
            : `/${generatedSlug}`;
          setLocalUrl(fullUrl);
        }
        
        setIsPublished((page as any).published !== false);
        
        // Initialize editor content if it exists
        if (editorRef.current) {
          editorRef.current.innerHTML = String((page as any).description || '');
        }
      }
    }, [page?.id, getParentUrlPath]); // Only re-run when page ID changes, not on other updates

    const handleNameChange = (value: string) => {
      if (isViewOnly) return;
      
      setLocalName(value);
      
      // Generate new URL with parent path if applicable
      const parentPath = page ? getParentUrlPath(page.id) : '';
      const newSlug = generateCleanSlug(value);
      const newUrl = parentPath 
        ? `${parentPath}${parentPath.endsWith('/') ? '' : '/'}${newSlug}`
        : `/${newSlug}`;
      setLocalUrl(newUrl);
      
      // Update immediately for live preview on canvas
      if (page) {
        onUpdatePage(page.id, { name: value, url: newUrl } as any);
      }
    };

    const handleUrlChange = (value: string) => {
      if (isViewOnly) return;
      
      setLocalUrl(value);
      
      // Update immediately for live preview on canvas
      if (page) {
        onUpdatePage(page.id, { url: value } as any);
      }
    };
    
    // Removed blur handlers - saves are now handled by parent's debounced system
    // This prevents cursor jumping during typing
    
    const handlePublishedChange = (value: boolean) => {
      if (isViewOnly || !page) return;
      
      setIsPublished(value);
      onUpdatePage(page.id, { ...page, published: value } as any);
    };

    const handleIndentChange = (newLevel: number) => {
      if (isViewOnly || !page) return;
      onUpdatePage(page.id, { visualLevel: newLevel });
    };

    const handlePageTypeChange = (pageTypeId: string) => {
      if (isViewOnly || !page) return;
      
      // Save any pending changes first
      savePendingChanges();
      
      const pageType = pageTypes.find(pt => pt.id === pageTypeId);
      if (pageType) {
        onUpdatePage(page.id, { 
          pageType: pageTypeId,
          icon: pageType.icon,
          color: String(pageType.color)
        });
      }
    };

    const formatText = (command: string) => {
      if (isViewOnly || !editorRef.current) return;
      
      editorRef.current.focus();
      
      try {
        document.execCommand(command, false);
      } catch (error) {
        console.warn('Document.execCommand not supported for:', command);
      }
    };

    // Handle editor input without losing cursor position
    const handleEditorInput = (e: React.FormEvent<HTMLDivElement>) => {
      if (isViewOnly) return;
      
      const content = (e.target as HTMLDivElement).innerHTML;
      setLocalDescription(content);
      
      // Track pending changes
      pendingChangesRef.current.description = content;
      pendingPageIdRef.current = page?.id || null;
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (isViewOnly) return;
      
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      
      try {
        document.execCommand('insertText', false, text);
      } catch (error) {
        // Fallback for browsers that don't support insertText
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const textNode = document.createTextNode(text);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      
      // Update local state with the current content
      if (editorRef.current) {
        const content = editorRef.current.innerHTML;
        setLocalDescription(content);
        // Track pending changes
        pendingChangesRef.current.description = content;
        pendingPageIdRef.current = page?.id || null;
      }
    };

    // Allow standard keyboard shortcuts in the editor
    const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Allow all standard text editing shortcuts
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      
      // Standard shortcuts that should always work
      const allowedShortcuts = ['a', 'c', 'v', 'x', 'z', 'y'];
      
      if (isCtrlOrCmd && allowedShortcuts.includes(e.key.toLowerCase())) {
        // Let the browser handle these shortcuts naturally
        return;
      }
    };

    useImperativeHandle(ref, () => ({
      savePendingChanges
    }));

    // If in comments view mode and not in view-only mode, show all comments viewer
    if (viewMode === 'comments' && !isViewOnly && sitemapId && onSelectPage) {
      return (
        <div className="w-80 border-l bg-background p-4 space-y-4 overflow-y-auto">
          {/* Header with toggle */}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">All Comments</h2>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setViewMode('properties')}
              title="Switch to page properties"
            >
              <FileText className="h-4 w-4 mr-2" />
              Properties
            </Button>
          </div>

          <Separator />

          <AllCommentsViewer
            sitemapId={sitemapId}
            pages={allPages}
            onSelectPage={onSelectPage}
            onCenterPage={onCenterPage}
            selectedPageId={page?.id}
            refreshKey={commentsRefreshKey}
          />
        </div>
      );
    }

    if (!page) {
      return (
        <div className="w-80 border-l bg-background p-4">
          {/* Header with toggle button even when no page is selected */}
          {!isViewOnly && sitemapId && onSelectPage && allPages.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Page Properties</h2>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setViewMode('comments')}
                  title="View all comments"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Comments
                </Button>
              </div>
              <Separator className="mb-8" />
            </>
          )}
          <div className="text-center text-muted-foreground py-8">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="font-medium mb-2">No page selected</h3>
            <p className="text-sm">Select a page to view{!isViewOnly ? ' and edit' : ''} its properties</p>
          </div>
        </div>
      );
    }

    const currentPageType = pageTypes.find(pt => pt.id === page.pageType) || pageTypes[0];

    return (
      <div className="w-80 border-l bg-background p-4 space-y-4 h-screen overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Page Properties</h2>
          {isViewOnly && (
            <Badge variant="outline" className="text-xs">
              <Eye className="h-3 w-3 mr-1" />
              View Only
            </Badge>
          )}
          {!isViewOnly && sitemapId && onSelectPage && allPages.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setCommentsRefreshKey(prev => prev + 1);
                setViewMode('comments');
              }}
              title="View all comments"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Basic Information */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Type className="h-4 w-4" />
            <h3 className="font-medium">Basic Information</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="page-name">Page Name</Label>
              <Input
                id="page-name"
                value={localName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Enter page name"
                readOnly={isViewOnly}
                className={isViewOnly ? "bg-muted/50" : ""}
              />
            </div>

            <div>
              <Label htmlFor="page-url">URL Slug</Label>
              {(() => {
                const parentPath = page ? getParentUrlPath(page.id) : '';
                const ownSlug = getOwnUrlSlug(localUrl, parentPath);
                
                return (
                  <div className="flex">
                    {parentPath ? (
                      <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                        {parentPath}
                        {!parentPath.endsWith('/') && '/'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                        /
                      </span>
                    )}
                    <Input
                      id="page-url"
                      value={ownSlug}
                      onChange={(e) => {
                        const newOwnSlug = e.target.value;
                        const fullUrl = parentPath 
                          ? `${parentPath}${parentPath.endsWith('/') ? '' : '/'}${newOwnSlug}`
                          : `/${newOwnSlug}`;
                        handleUrlChange(fullUrl);
                      }}
                      className={`rounded-l-none ${isViewOnly ? "bg-muted/50" : ""}`}
                      placeholder="page-url"
                      readOnly={isViewOnly}
                    />
                  </div>
                );
              })()}
            </div>

            <div>
              <Label htmlFor="page-description">Description</Label>
              
              {!isViewOnly ? (
                <div className="space-y-2">
                  {/* Formatting Toolbar */}
                  <div className="flex items-center gap-1 p-2 border rounded-md bg-muted/50">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0" 
                      onClick={() => formatText('bold')} 
                      title="Bold"
                      type="button"
                    >
                      <Bold className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0" 
                      onClick={() => formatText('italic')} 
                      title="Italic"
                      type="button"
                    >
                      <Italic className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0" 
                      onClick={() => formatText('underline')} 
                      title="Underline"
                      type="button"
                    >
                      <Underline className="h-3 w-3" />
                    </Button>
                    <Separator orientation="vertical" className="h-4 mx-1" />
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0" 
                      onClick={() => formatText('insertUnorderedList')} 
                      title="Bullet List"
                      type="button"
                    >
                      <List className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0" 
                      onClick={() => formatText('insertOrderedList')} 
                      title="Numbered List"
                      type="button"
                    >
                      <ListOrdered className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  {/* Rich Text Editor */}
                  <div 
                    className="rich-editor-container"
                    dir="ltr"
                    style={{
                      direction: 'ltr',
                      textAlign: 'left'
                    }}
                  >
                    <div
                      ref={editorRef}
                      contentEditable={true}
                      className="min-h-[100px] p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-background cursor-text"
                      onInput={handleEditorInput}
                      onPaste={handlePaste}
                      onKeyDown={handleEditorKeyDown}
                      suppressContentEditableWarning={true}
                      dir="ltr"
                      style={{
                        minHeight: '100px',
                        direction: 'ltr',
                        textAlign: 'left',
                        outline: 'none'
                      }}
                      // onBlur={handleDescriptionBlur}
                    />
                  </div>
                </div>
              ) : (
                /* View-only mode */
                <div 
                  className="min-h-[100px] p-3 border rounded-md bg-muted/50"
                  dangerouslySetInnerHTML={{ __html: localDescription || 'No description provided' }}
                />
              )}
            </div>


          </div>
        </Card>

        {/* Page Type */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-4 w-4" />
            <h3 className="font-medium">Page Type</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="page-type">Type</Label>
              <Select 
                value={page.pageType || currentPageType.id} 
                onValueChange={handlePageTypeChange}
                disabled={isViewOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded ${type.color}`} />
                        {String(type.name)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {currentPageType && (
              <div className="p-3 bg-muted/50 rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`${currentPageType.color} text-white p-1.5 rounded`}>
                    {currentPageType.icon}
                  </div>
                  <span className="font-medium text-sm">{String(currentPageType.name)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {String(currentPageType.description)}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Visual Indent - Only show for pages with one parent (not counting homepage) */}
        {!isViewOnly && (() => {
          // Check if page is at level 2 (grandchild of homepage)
          const isLevelTwo = () => {
            if (!page.parent) return false;
            const parent = allPages.find(p => p.id === page.parent);
            if (!parent || !parent.parent) return false;
            const grandparent = allPages.find(p => p.id === parent.parent);
            if (!grandparent) return false;
            // Grandparent must be homepage (root page with no parent)
            if (grandparent.parent) return false;
            return true;
          };
          
          // Check if page has any children
          const hasChildren = allPages.some(p => p.parent === page.id);
          
          if (!isLevelTwo() || hasChildren) return null;
          
          // Calculate current level
          const getPageLevel = (p: SitePage): number => {
            if (!p.parent) return 0;
            const parent = allPages.find(pg => pg.id === p.parent);
            if (!parent) return 0;
            return getPageLevel(parent) + 1;
          };
          
          const currentLevel = getPageLevel(page);
          const isIndented = page.visualLevel !== undefined;
          
          return (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Indent className="h-4 w-4" />
                <h3 className="font-medium">Visual Indent</h3>
              </div>
              
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Indent this page by one level without changing its parent relationship.
                </p>
                
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Indent</Label>
                  <Switch 
                    checked={isIndented} 
                    onCheckedChange={(checked) => {
                      if (checked) {
                        handleIndentChange(currentLevel + 1);
                      } else {
                        onUpdatePage(page.id, { visualLevel: undefined });
                      }
                    }}
                    disabled={isViewOnly}
                  />
                </div>
              </div>
            </Card>
          );
        })()}

        {/* Page Status - Hide in view-only mode */}
        {!isViewOnly && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded ${page.color}`} />
                <h3 className="font-medium">Status</h3>
              </div>
              <Badge variant={isPublished ? "default" : "secondary"}>
                {isPublished ? "Published" : "Draft"}
              </Badge>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Published</Label>
                <Switch 
                  checked={isPublished} 
                  onCheckedChange={handlePublishedChange}
                  disabled={isViewOnly}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label className="text-sm">Searchable</Label>
                <Switch defaultChecked disabled={isViewOnly} />
              </div>
              
              <div className="flex items-center justify-between">
                <Label className="text-sm">Password Protected</Label>
                <Switch disabled={isViewOnly} />
              </div>
            </div>
          </Card>
        )}

        {/* Page Settings - Hide in view-only mode */}
        {!isViewOnly && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="h-4 w-4" />
              <h3 className="font-medium">Page Settings</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="page-color">Page Color</Label>
                <div className="flex gap-2 mt-2">
                  {['bg-blue-500', 'bg-green-500', 'bg-red-500', 'bg-purple-500', 'bg-orange-500', 'bg-indigo-500', 'bg-yellow-500'].map((color) => (
                    <button
                      key={color}
                      className={`w-6 h-6 rounded ${color} ${page.color === color ? 'ring-2 ring-ring ring-offset-2' : ''} ${isViewOnly ? 'cursor-default' : 'cursor-pointer'}`}
                      onClick={() => !isViewOnly && onUpdatePage(page.id, { color })}
                      disabled={isViewOnly}
                    />
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="page-priority">Priority</Label>
                <Select defaultValue="normal" disabled={isViewOnly}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        )}

        {/* Comments */}
        {page && sitemapId && (
          <CommentsPanel
            sitemapId={sitemapId}
            pageId={page.id}
            isViewOnly={isViewOnly}
            refreshKey={commentsRefreshKey}
            onCommentAdded={() => setCommentsRefreshKey(prev => prev + 1)}
          />
        )}

        {/* Actions - Hide in view-only mode */}
        {!isViewOnly && (
          <div className="space-y-2">
            {/* Preview and Open in New Tab buttons removed */}
          </div>
        )}
      </div>
    );
  }
);

PagePropertiesPanel.displayName = 'PagePropertiesPanel';