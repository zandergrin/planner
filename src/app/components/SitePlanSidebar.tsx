import { useState, useEffect } from 'react';
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { ChevronDown, ChevronRight, Search, Plus, Layers, Settings, Grid, Home, FileText, Mail, Info, ShoppingCart, User, Search as SearchIcon, Blocks, MoreHorizontal, Edit, Trash2, Layout, Newspaper, Globe, List, FormInput, Star, ChevronLeft } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
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
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import type { SitePage, PageType } from '../utils/storage';
import { pageTypeStorage } from '../utils/storage';
import { toast } from "sonner";

export const defaultPageTypes: PageType[] = [
  { 
    id: 'home', 
    name: 'Home Page', 
    icon: <Home className="h-4 w-4" />, 
    color: 'bg-blue-500',
    description: 'The main landing page of your website.',
    iconKey: 'home'
  },
  { 
    id: 'content', 
    name: 'Content Page', 
    icon: <FileText className="h-4 w-4" />, 
    color: 'bg-green-500',
    description: 'A general content page with text and media.',
    iconKey: 'file'
  },
  { 
    id: 'grid', 
    name: 'Grid Layout', 
    icon: <Grid className="h-4 w-4" />, 
    color: 'bg-purple-500',
    description: 'Grid-based layout for showcasing multiple items.',
    iconKey: 'grid'
  },
  { 
    id: 'flexible', 
    name: 'Flexible Layout', 
    icon: <Layout className="h-4 w-4" />, 
    color: 'bg-indigo-500',
    description: 'Adaptive layout that adjusts to different content types.',
    iconKey: 'blocks'
  },
  { 
    id: 'magazine', 
    name: 'Magazine', 
    icon: <Newspaper className="h-4 w-4" />, 
    color: 'bg-orange-500',
    description: 'Editorial-style layout with rich media and text.',
    iconKey: 'file'
  },
  { 
    id: 'portal', 
    name: 'Portal', 
    icon: <Globe className="h-4 w-4" />, 
    color: 'bg-cyan-500',
    description: 'Hub page linking to various sections and resources.',
    iconKey: 'grid'
  },
  { 
    id: 'list', 
    name: 'List View', 
    icon: <List className="h-4 w-4" />, 
    color: 'bg-slate-500',
    description: 'Organized list format for directories and catalogs.',
    iconKey: 'file'
  },
  { 
    id: 'form', 
    name: 'Form Page', 
    icon: <FormInput className="h-4 w-4" />, 
    color: 'bg-emerald-500',
    description: 'Interactive forms for data collection and user input.',
    iconKey: 'mail'
  },
  { 
    id: 'feature', 
    name: 'Feature Page', 
    icon: <Star className="h-4 w-4" />, 
    color: 'bg-yellow-500',
    description: 'Highlight specific features or capabilities.',
    iconKey: 'info'
  },
  { 
    id: 'product', 
    name: 'Product Page', 
    icon: <ShoppingCart className="h-4 w-4" />, 
    color: 'bg-red-500',
    description: 'Detailed product showcase with specifications.',
    iconKey: 'shopping'
  },
];

interface SitePlanSidebarProps {
  onAddPage: (pageType: PageType) => void;
  pages: SitePage[];
  selectedPageId?: string;
  onSelectPage: (id: string) => void;
  onReorderPages: (pageId: string, newIndex: number) => void;
  pageTypes: PageType[];
  onAddPageType: (pageType: PageType) => void;
  onEditPageType: (pageTypeId: string, updates: Partial<PageType>) => void;
  onDeletePageType: (pageTypeId: string) => void;
  collapsedGroups: Set<string>;
  onToggleCollapse: (pageId: string) => void;
  isViewOnly?: boolean;
}

export function SitePlanSidebar({ 
  onAddPage, 
  pages, 
  selectedPageId, 
  onSelectPage, 
  onReorderPages,
  pageTypes,
  onAddPageType,
  onEditPageType,
  onDeletePageType,
  collapsedGroups,
  onToggleCollapse,
  isViewOnly = false
}: SitePlanSidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [contentSearchTerm, setContentSearchTerm] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isNewPageTypeDialogOpen, setIsNewPageTypeDialogOpen] = useState(false);
  const [isEditPageTypeDialogOpen, setIsEditPageTypeDialogOpen] = useState(false);
  const [editingPageType, setEditingPageType] = useState<PageType | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [pageTypeToDelete, setPageTypeToDelete] = useState<PageType | null>(null);
  const [newPageTypeName, setNewPageTypeName] = useState('');
  const [newPageTypeDescription, setNewPageTypeDescription] = useState('');
  const [newPageTypeColor, setNewPageTypeColor] = useState('bg-blue-500');
  const [newPageTypeIcon, setNewPageTypeIcon] = useState('file');
  const [globalPageTypes, setGlobalPageTypes] = useState<PageType[]>([]);
  const [isLoadingPageTypes, setIsLoadingPageTypes] = useState(true);

  // Load global page types on component mount
  useEffect(() => {
    let isMounted = true;
    
    const loadPageTypes = async () => {
      try {
        setIsLoadingPageTypes(true);
        const types = await pageTypeStorage.getPageTypes();
        
        if (isMounted) {
          setGlobalPageTypes(types);
        }
      } catch (error) {
        console.error('❌ Failed to load global page types:', error);
        if (isMounted) {
          // Fallback to default page types
          setGlobalPageTypes(defaultPageTypes);
          toast.error('Failed to load page types, using defaults');
        }
      } finally {
        if (isMounted) {
          setIsLoadingPageTypes(false);
        }
      }
    };

    loadPageTypes();

    return () => {
      isMounted = false;
    };
  }, []);

  // Use the passed prop pageTypes (which are the correct ones from SitemapEditor)
  const effectivePageTypes = pageTypes;

  const filteredPageTypes = effectivePageTypes.filter(type =>
    String(type.name).toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(type.description).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPages = pages.filter(page =>
    String(page.name).toLowerCase().includes(contentSearchTerm.toLowerCase())
  );

  // Safe icon creation function
  const createIconComponent = (iconKey: string): React.ReactNode => {
    const iconMap: { [key: string]: React.ReactNode } = {
      file: <FileText className="h-4 w-4" />,
      home: <Home className="h-4 w-4" />,
      mail: <FormInput className="h-4 w-4" />,
      info: <Star className="h-4 w-4" />,
      shopping: <ShoppingCart className="h-4 w-4" />,
      user: <User className="h-4 w-4" />,
      search: <SearchIcon className="h-4 w-4" />,
      grid: <Grid className="h-4 w-4" />,
      blocks: <Layout className="h-4 w-4" />,
      layout: <Layout className="h-4 w-4" />,
      newspaper: <Newspaper className="h-4 w-4" />,
      globe: <Globe className="h-4 w-4" />,
      list: <List className="h-4 w-4" />,
      form: <FormInput className="h-4 w-4" />,
      star: <Star className="h-4 w-4" />,
    };
    return iconMap[iconKey] || <FileText className="h-4 w-4" />;
  };

  const handleDragStart = (e: React.DragEvent, pageId: string) => {
    if (isViewOnly) return;
    e.dataTransfer.setData('text/plain', pageId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isViewOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    if (isViewOnly) return;
    e.preventDefault();
    const draggedPageId = e.dataTransfer.getData('text/plain');
    if (draggedPageId) {
      onReorderPages(draggedPageId, targetIndex);
    }
  };

  const handleCreatePageType = async () => {
    if (!newPageTypeName.trim()) return;

    try {
      const newPageType: PageType = {
        id: `custom-${Date.now()}`,
        name: newPageTypeName,
        icon: createIconComponent(newPageTypeIcon),
        color: newPageTypeColor,
        description: newPageTypeDescription || `Custom ${newPageTypeName} page type`,
        iconKey: newPageTypeIcon,
      };

      // Save to global storage
      await pageTypeStorage.addPageType(newPageType);
      
      // Update local state
      setGlobalPageTypes(prev => [...prev, newPageType]);
      
      // Also call the parent callback for backward compatibility
      onAddPageType(newPageType);
      
      setIsNewPageTypeDialogOpen(false);
      setNewPageTypeName('');
      setNewPageTypeDescription('');
      setNewPageTypeColor('bg-blue-500');
      setNewPageTypeIcon('file');
      
      toast.success('Page type created successfully');
    } catch (error) {
      console.error('❌ Failed to create page type:', error);
      toast.error('Failed to create page type');
    }
  };

  const handleEditPageType = (pageType: PageType) => {
    setEditingPageType(pageType);
    setNewPageTypeName(String(pageType.name));
    setNewPageTypeDescription(String(pageType.description));
    setNewPageTypeColor(String(pageType.color));
    setNewPageTypeIcon(pageType.iconKey || 'file');
    setIsEditPageTypeDialogOpen(true);
  };

  const handleSaveEditPageType = async () => {
    if (!editingPageType || !newPageTypeName.trim()) return;

    try {
      const updates: Partial<PageType> = {
        name: newPageTypeName,
        description: newPageTypeDescription,
        color: newPageTypeColor,
        icon: createIconComponent(newPageTypeIcon),
        iconKey: newPageTypeIcon,
      };

      // Check if this is a default page type that exists in global storage
      const existsInGlobalStorage = globalPageTypes.some(pt => pt.id === editingPageType.id);
      
      if (existsInGlobalStorage) {
        // Save to global storage
        await pageTypeStorage.updatePageType(editingPageType.id, updates);
        
        // Update local state
        setGlobalPageTypes(prev => prev.map(pt => 
          pt.id === editingPageType.id ? { ...pt, ...updates } : pt
        ));
      }
      
      // Always call the parent callback to update the sitemap-specific page types
      onEditPageType(editingPageType.id, updates);
      
      setIsEditPageTypeDialogOpen(false);
      setEditingPageType(null);
      setNewPageTypeName('');
      setNewPageTypeDescription('');
      setNewPageTypeColor('bg-blue-500');
      setNewPageTypeIcon('file');
      
      toast.success('Page type updated successfully');
    } catch (error) {
      console.error('❌ Failed to update page type:', error);
      // Still call the parent callback to update the sitemap-specific page types even if global storage fails
      try {
        const updates: Partial<PageType> = {
          name: newPageTypeName,
          description: newPageTypeDescription,
          color: newPageTypeColor,
          icon: createIconComponent(newPageTypeIcon),
          iconKey: newPageTypeIcon,
        };
        onEditPageType(editingPageType.id, updates);
        
        setIsEditPageTypeDialogOpen(false);
        setEditingPageType(null);
        setNewPageTypeName('');
        setNewPageTypeDescription('');
        setNewPageTypeColor('bg-blue-500');
        setNewPageTypeIcon('file');
        
        toast.success('Page type updated successfully (local changes only)');
      } catch (fallbackError) {
        toast.error('Failed to update page type');
      }
    }
  };

  const handleDeletePageTypeConfirm = (pageType: PageType) => {
    setPageTypeToDelete(pageType);
    setIsDeleteDialogOpen(true);
  };

  const handleDeletePageTypeExecute = async () => {
    if (!pageTypeToDelete) return;

    try {
      // Check if any pages are using this page type
      const pagesUsingType = pages.filter(page => page.pageType === pageTypeToDelete.id);
      if (pagesUsingType.length > 0) {
        toast.error('Cannot delete page type - it is being used by existing pages');
        setIsDeleteDialogOpen(false);
        setPageTypeToDelete(null);
        return;
      }

      // Check if this is a default page type that exists in global storage
      const existsInGlobalStorage = globalPageTypes.some(pt => pt.id === pageTypeToDelete.id);
      
      if (existsInGlobalStorage) {
        // Delete from global storage
        await pageTypeStorage.deletePageType(pageTypeToDelete.id);
        
        // Update local state
        setGlobalPageTypes(prev => prev.filter(pt => pt.id !== pageTypeToDelete.id));
      }
      
      // Always call the parent callback to update the sitemap-specific page types
      onDeletePageType(pageTypeToDelete.id);
      
      setIsDeleteDialogOpen(false);
      setPageTypeToDelete(null);
      
      toast.success('Page type deleted successfully');
    } catch (error) {
      console.error('❌ Failed to delete page type:', error);
      // Still call the parent callback to update the sitemap-specific page types even if global storage fails
      try {
        onDeletePageType(pageTypeToDelete.id);
        
        setIsDeleteDialogOpen(false);
        setPageTypeToDelete(null);
        
        toast.success('Page type deleted successfully (local changes only)');
      } catch (fallbackError) {
        toast.error('Failed to delete page type');
      }
    }
  };

  const getLevel = (page: SitePage): number => {
    if (!page.parent) return 0;
    const parent = pages.find(p => p.id === page.parent);
    if (!parent) return 0;
    return getLevel(parent) + 1;
  };

  const renderPageHierarchy = (pageList: SitePage[], level: number = 0): JSX.Element[] => {
    return pageList.map((page, index) => {
      const children = filteredPages.filter(p => p.parent === page.id);
      const isSelected = selectedPageId === page.id;
      const pageLevel = getLevel(page);
      const isCollapsible = pageLevel >= 1 && children.length > 0;
      const isCollapsed = collapsedGroups.has(page.id);
      
      return (
        <div key={page.id}>
          <div
            className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
              isSelected ? 'bg-accent' : 'hover:bg-accent/50'
            }`}
            style={{ paddingLeft: `${8 + level * 16}px` }}
            onClick={() => onSelectPage(page.id)}
            draggable={!isViewOnly}
            onDragStart={(e) => handleDragStart(e, page.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
          >
            {isCollapsible && !isViewOnly && (
              <Button
                variant="ghost"
                size="sm"
                className="w-4 h-4 p-0"
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
            <div className={`w-3 h-3 rounded ${page.color}`} />
            <span className="text-sm flex-1">{String(page.name)}</span>
            {children.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {children.length}
              </Badge>
            )}
          </div>
          {children.length > 0 && !isCollapsed && renderPageHierarchy(children, level + 1)}
        </div>
      );
    });
  };

  const rootPages = filteredPages.filter(page => !page.parent);

  if (isLoadingPageTypes) {
    return (
      <div className={`${isCollapsed ? 'w-12' : 'w-80'} border-r bg-background p-4 space-y-4 transition-all duration-300`}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          {!isCollapsed && <span className="ml-2 text-sm text-muted-foreground">Loading page types...</span>}
        </div>
      </div>
    );
  }

  return (
    <div className={`${isCollapsed ? 'w-12' : 'w-80'} border-r bg-background ${isCollapsed ? 'p-2' : 'p-4'} space-y-4 transition-all duration-300 relative`}>
      {/* Collapse/Expand Button */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 -right-3 z-10 h-6 w-6 p-0 rounded-full border bg-background shadow-sm"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <ChevronLeft className={`h-4 w-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
      </Button>
      
      {!isCollapsed && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Site Plan</h2>
            {!isViewOnly && (
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Content for view-only mode */}
          {isViewOnly ? (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="h-4 w-4" />
                <h3 className="font-medium">Content Overview</h3>
                <Badge variant="secondary" className="text-xs ml-auto">
                  {pages.length}
                </Badge>
              </div>
              
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search pages..."
                  value={contentSearchTerm}
                  onChange={(e) => setContentSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {pages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No pages in this sitemap.
                  </p>
                ) : rootPages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No pages match your search.
                  </p>
                ) : (
                  renderPageHierarchy(rootPages)
                )}
              </div>
            </Card>
          ) : (
            /* Tabbed Content for edit mode */
            <Tabs defaultValue="page-types" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="page-types">Page Types</TabsTrigger>
                <TabsTrigger value="content">Content</TabsTrigger>
              </TabsList>

              {/* Page Types Tab */}
              <TabsContent value="page-types" className="space-y-4">
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium">Page Types</h3>
                    <Dialog open={isNewPageTypeDialogOpen} onOpenChange={setIsNewPageTypeDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="h-7">
                          <Plus className="h-3 w-3 mr-1" />
                          Add
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create New Page Type</DialogTitle>
                          <DialogDescription>
                            Create a custom page type that can be reused across your site.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="page-type-name">Name</Label>
                            <Input
                              id="page-type-name"
                              value={newPageTypeName}
                              onChange={(e) => setNewPageTypeName(e.target.value)}
                              placeholder="Enter page type name"
                            />
                          </div>
                          <div>
                            <Label htmlFor="page-type-description">Description</Label>
                            <Textarea
                              id="page-type-description"
                              value={newPageTypeDescription}
                              onChange={(e) => setNewPageTypeDescription(e.target.value)}
                              placeholder="Describe what this page type is used for"
                              rows={3}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="page-type-icon">Icon</Label>
                              <Select value={newPageTypeIcon} onValueChange={setNewPageTypeIcon}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="file">File</SelectItem>
                                  <SelectItem value="home">Home</SelectItem>
                                  <SelectItem value="mail">Form</SelectItem>
                                  <SelectItem value="info">Feature</SelectItem>
                                  <SelectItem value="shopping">Product</SelectItem>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="search">Search</SelectItem>
                                  <SelectItem value="grid">Grid</SelectItem>
                                  <SelectItem value="blocks">Flexible</SelectItem>
                                  <SelectItem value="layout">Layout</SelectItem>
                                  <SelectItem value="newspaper">Magazine</SelectItem>
                                  <SelectItem value="globe">Portal</SelectItem>
                                  <SelectItem value="list">List</SelectItem>
                                  <SelectItem value="form">Form Input</SelectItem>
                                  <SelectItem value="star">Feature Star</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Color</Label>
                              <div className="flex gap-1 mt-2">
                                {['bg-blue-500', 'bg-green-500', 'bg-red-500', 'bg-purple-500', 'bg-orange-500', 'bg-indigo-500', 'bg-yellow-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-slate-500'].map((color) => (
                                  <button
                                    key={color}
                                    className={`w-6 h-6 rounded ${color} ${newPageTypeColor === color ? 'ring-2 ring-ring ring-offset-2' : ''}`}
                                    onClick={() => setNewPageTypeColor(color)}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsNewPageTypeDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleCreatePageType}>
                            Create Page Type
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search page types..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredPageTypes.map((type) => (
                      <div
                        key={type.id}
                        className="flex items-center gap-3 p-2 rounded border hover:bg-accent/50 transition-colors"
                      >
                        <div className={`${type.color} text-white p-1.5 rounded`}>
                          {type.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{String(type.name)}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {String(type.description)}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditPageType(type)}>
                              <Edit className="h-3 w-3 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeletePageTypeConfirm(type)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-3 w-3 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>

              {/* Content Overview Tab */}
              <TabsContent value="content" className="space-y-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="h-4 w-4" />
                    <h3 className="font-medium">Content Overview</h3>
                    <Badge variant="secondary" className="text-xs ml-auto">
                      {pages.length}
                    </Badge>
                  </div>
                  
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search pages..."
                      value={contentSearchTerm}
                      onChange={(e) => setContentSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {pages.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No pages yet. Add pages using the + buttons on page cards.
                      </p>
                    ) : rootPages.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No pages match your search.
                      </p>
                    ) : (
                      renderPageHierarchy(rootPages)
                    )}
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          {/* Edit Page Type Dialog - Only show in edit mode */}
          {!isViewOnly && (
            <>
              <Dialog open={isEditPageTypeDialogOpen} onOpenChange={setIsEditPageTypeDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Page Type</DialogTitle>
                    <DialogDescription>
                      Update the page type details.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="edit-page-type-name">Name</Label>
                      <Input
                        id="edit-page-type-name"
                        value={newPageTypeName}
                        onChange={(e) => setNewPageTypeName(e.target.value)}
                        placeholder="Enter page type name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-page-type-description">Description</Label>
                      <Textarea
                        id="edit-page-type-description"
                        value={newPageTypeDescription}
                        onChange={(e) => setNewPageTypeDescription(e.target.value)}
                        placeholder="Describe what this page type is used for"
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit-page-type-icon">Icon</Label>
                        <Select value={newPageTypeIcon} onValueChange={setNewPageTypeIcon}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="file">File</SelectItem>
                            <SelectItem value="home">Home</SelectItem>
                            <SelectItem value="mail">Form</SelectItem>
                            <SelectItem value="info">Feature</SelectItem>
                            <SelectItem value="shopping">Product</SelectItem>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="search">Search</SelectItem>
                            <SelectItem value="grid">Grid</SelectItem>
                            <SelectItem value="blocks">Flexible</SelectItem>
                            <SelectItem value="layout">Layout</SelectItem>
                            <SelectItem value="newspaper">Magazine</SelectItem>
                            <SelectItem value="globe">Portal</SelectItem>
                            <SelectItem value="list">List</SelectItem>
                            <SelectItem value="form">Form Input</SelectItem>
                            <SelectItem value="star">Feature Star</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Color</Label>
                        <div className="flex gap-1 mt-2">
                          {['bg-blue-500', 'bg-green-500', 'bg-red-500', 'bg-purple-500', 'bg-orange-500', 'bg-indigo-500', 'bg-yellow-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-slate-500'].map((color) => (
                            <button
                              key={color}
                              className={`w-6 h-6 rounded ${color} ${newPageTypeColor === color ? 'ring-2 ring-ring ring-offset-2' : ''}`}
                              onClick={() => setNewPageTypeColor(color)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsEditPageTypeDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveEditPageType}>
                      Save Changes
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Delete Confirmation Dialog */}
              <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Page Type</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{pageTypeToDelete?.name}"? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeletePageTypeExecute}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </>
      )}
    </div>
  );
}

// Export the PageType from storage for backward compatibility
export type { PageType };
