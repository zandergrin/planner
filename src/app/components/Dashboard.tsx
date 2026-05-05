import { useState, useEffect } from 'react';
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { 
  Plus, 
  MoreHorizontal, 
  Edit3, 
  Trash2, 
  Copy, 
  Eye, 
  ExternalLink,
  Download,
  Upload,
  FileText,
  Calendar,
  Archive,
  ArchiveRestore
} from "lucide-react";
import { storage, Sitemap, urls } from '../utils/storage';
import { toast } from "sonner";

interface DashboardProps {
  onOpenSitemap: (sitemapId: string) => void;
}

export function Dashboard({ onOpenSitemap }: DashboardProps) {
  const [sitemaps, setSitemaps] = useState<Sitemap[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [editingSitemap, setEditingSitemap] = useState<Sitemap | null>(null);
  const [deletingSitemap, setDeletingSitemap] = useState<Sitemap | null>(null);
  const [archivingSitemap, setArchivingSitemap] = useState<Sitemap | null>(null);
  const [newSitemapData, setNewSitemapData] = useState({ name: '', description: '' });
  const [showArchived, setShowArchived] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Load sitemaps on component mount
  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        setIsLoading(true);
        
        // Initialize sample data if needed
        if (!hasInitialized) {
          await storage.initializeSampleData();
          setHasInitialized(true);
        }
        
        // Load existing sitemaps from cloud storage
        const loadedSitemaps = await storage.getSitemaps();
        setSitemaps(loadedSitemaps.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
        
        console.log('Dashboard initialized with', loadedSitemaps.length, 'sitemaps');
      } catch (error) {
        console.error('Error initializing dashboard:', error);
        toast.error('Failed to load sitemaps');
      } finally {
        setIsLoading(false);
      }
    };

    initializeDashboard();
  }, [hasInitialized]);

  const loadSitemaps = async () => {
    try {
      const loadedSitemaps = await storage.getSitemaps();
      setSitemaps(loadedSitemaps.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
    } catch (error) {
      console.error('Error loading sitemaps:', error);
      toast.error('Failed to load sitemaps');
    }
  };

  const handleCreateSitemap = async () => {
    if (!newSitemapData.name.trim()) {
      toast.error('Please enter a sitemap name');
      return;
    }

    try {
      const newSitemap = await storage.createSitemap(
        newSitemapData.name.trim(),
        newSitemapData.description.trim() || undefined
      );
      
      setNewSitemapData({ name: '', description: '' });
      setIsCreateDialogOpen(false);
      await loadSitemaps();
      toast.success('Sitemap created successfully');
      
      // Auto-open the new sitemap
      onOpenSitemap(newSitemap.id);
    } catch (error) {
      console.error('Error creating sitemap:', error);
      toast.error('Failed to create sitemap');
    }
  };

  const handleEditSitemap = (sitemap: Sitemap) => {
    setEditingSitemap(sitemap);
    setNewSitemapData({ 
      name: sitemap.name, 
      description: sitemap.description || '' 
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingSitemap || !newSitemapData.name.trim()) {
      toast.error('Please enter a sitemap name');
      return;
    }

    try {
      const updatedSitemap = {
        ...editingSitemap,
        name: newSitemapData.name.trim(),
        description: newSitemapData.description.trim() || undefined,
      };
      
      await storage.saveSitemap(updatedSitemap);
      setNewSitemapData({ name: '', description: '' });
      setIsEditDialogOpen(false);
      setEditingSitemap(null);
      await loadSitemaps();
      toast.success('Sitemap updated successfully');
    } catch (error) {
      console.error('Error updating sitemap:', error);
      toast.error('Failed to update sitemap');
    }
  };

  const handleArchiveSitemap = async (sitemap: Sitemap) => {
    try {
      await storage.archiveSitemap(sitemap.id);
      await loadSitemaps();
      toast.success('Sitemap archived successfully');
    } catch (error) {
      console.error('Error archiving sitemap:', error);
      toast.error('Failed to archive sitemap');
    }
  };

  const handleRestoreSitemap = async (sitemap: Sitemap) => {
    try {
      await storage.restoreSitemap(sitemap.id);
      await loadSitemaps();
      toast.success('Sitemap restored successfully');
    } catch (error) {
      console.error('Error restoring sitemap:', error);
      toast.error('Failed to restore sitemap');
    }
  };

  const handleDeleteSitemap = (sitemap: Sitemap) => {
    setDeletingSitemap(sitemap);
    setDeleteConfirmText('');
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingSitemap || deleteConfirmText !== 'DELETE') return;

    try {
      await storage.deleteSitemap(deletingSitemap.id);
      setIsDeleteDialogOpen(false);
      setDeletingSitemap(null);
      setDeleteConfirmText('');
      await loadSitemaps();
      toast.success('Sitemap permanently deleted');
    } catch (error) {
      console.error('Error deleting sitemap:', error);
      toast.error('Failed to delete sitemap');
    }
  };

  const handleCopyEditLink = (sitemap: Sitemap) => {
    const editUrl = urls.edit(sitemap.id);
    navigator.clipboard.writeText(editUrl).then(() => {
      toast.success('Edit link copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy link');
    });
  };

  const handleCopyViewLink = (sitemap: Sitemap) => {
    const viewUrl = urls.view(sitemap.id);
    navigator.clipboard.writeText(viewUrl).then(() => {
      toast.success('View-only link copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy link');
    });
  };

  const handleExportSitemap = async (sitemap: Sitemap) => {
    try {
      const exportData = await storage.exportSitemap(sitemap.id);
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sitemap.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_sitemap.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Sitemap exported successfully');
    } catch (error) {
      console.error('Error exporting sitemap:', error);
      toast.error('Failed to export sitemap');
    }
  };

  const handleImportSitemap = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result as string;
          await storage.importSitemap(data);
          await loadSitemaps();
          toast.success('Sitemap imported successfully');
        } catch (error) {
          console.error('Error importing sitemap:', error);
          if (error instanceof Error) {
            toast.error(`Failed to import sitemap: ${error.message}`);
          } else {
            toast.error('Failed to import sitemap - invalid file format');
          }
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <div>
            <h2 className="text-lg font-medium">Loading Dashboard...</h2>
            <p className="text-sm text-muted-foreground">Setting up your sitemap workspace</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Site Plan Dashboard</h1>
              <p className="text-muted-foreground">Manage your website sitemaps</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleImportSitemap}>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Sitemap
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Sitemap</DialogTitle>
                    <DialogDescription>
                      Create a new sitemap. It will start with a homepage that you can build upon.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="sitemap-name">Name</Label>
                      <Input
                        id="sitemap-name"
                        value={newSitemapData.name}
                        onChange={(e) => setNewSitemapData({ ...newSitemapData, name: e.target.value })}
                        placeholder="My Website Sitemap"
                      />
                    </div>
                    <div>
                      <Label htmlFor="sitemap-description">Description (optional)</Label>
                      <Textarea
                        id="sitemap-description"
                        value={newSitemapData.description}
                        onChange={(e) => setNewSitemapData({ ...newSitemapData, description: e.target.value })}
                        placeholder="Describe what this sitemap is for..."
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateSitemap}>
                      Create Sitemap
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8">
        {/* Archive Toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant={!showArchived ? "default" : "outline"}
              onClick={() => setShowArchived(false)}
            >
              Active Sitemaps ({sitemaps.filter(s => !s.isArchived).length})
            </Button>
            <Button
              variant={showArchived ? "default" : "outline"}
              onClick={() => setShowArchived(true)}
            >
              <Archive className="h-4 w-4 mr-2" />
              Archived ({sitemaps.filter(s => s.isArchived).length})
            </Button>
          </div>
        </div>

        {(showArchived ? sitemaps.filter(s => s.isArchived) : sitemaps.filter(s => !s.isArchived)).length === 0 ? (
          <div className="text-center py-12">
            {showArchived ? (
              <>
                <Archive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No archived sitemaps</h3>
                <p className="text-muted-foreground mb-6">
                  Archived sitemaps will appear here. You can restore them anytime.
                </p>
              </>
            ) : (
              <>
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No sitemaps yet</h3>
                <p className="text-muted-foreground mb-6">
                  Create your first sitemap to start planning your website structure.
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Sitemap
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(showArchived ? sitemaps.filter(s => s.isArchived) : sitemaps.filter(s => !s.isArchived)).map((sitemap) => (
              <Card key={sitemap.id} className={`p-6 hover:shadow-md transition-shadow ${sitemap.isArchived ? 'opacity-75 border-dashed' : ''}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{sitemap.name}</h3>
                      {sitemap.isArchived && (
                        <Archive className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    {sitemap.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {sitemap.description}
                      </p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!sitemap.isArchived ? (
                        <>
                          <DropdownMenuItem onClick={() => onOpenSitemap(sitemap.id)}>
                            <Edit3 className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCopyViewLink(sitemap)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Copy View Link
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCopyEditLink(sitemap)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Edit Link
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleEditSitemap(sitemap)}>
                            <Edit3 className="h-4 w-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExportSitemap(sitemap)}>
                            <Download className="h-4 w-4 mr-2" />
                            Export
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleArchiveSitemap(sitemap)}>
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <>
                          <DropdownMenuItem onClick={() => handleRestoreSitemap(sitemap)}>
                            <ArchiveRestore className="h-4 w-4 mr-2" />
                            Restore
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExportSitemap(sitemap)}>
                            <Download className="h-4 w-4 mr-2" />
                            Export
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteSitemap(sitemap)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Permanently
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Updated {formatDate(sitemap.updatedAt)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>{sitemap.pages.length} page{sitemap.pages.length !== 1 ? 's' : ''}</span>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    {!sitemap.isArchived ? (
                      <>
                        <Button 
                          size="sm" 
                          className="flex-1"
                          onClick={() => onOpenSitemap(sitemap.id)}
                        >
                          <Edit3 className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleCopyViewLink(sitemap)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button 
                          size="sm" 
                          className="flex-1"
                          onClick={() => handleRestoreSitemap(sitemap)}
                        >
                          <ArchiveRestore className="h-4 w-4 mr-1" />
                          Restore
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleExportSitemap(sitemap)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sitemap</DialogTitle>
            <DialogDescription>
              Update the name and description of your sitemap.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-sitemap-name">Name</Label>
              <Input
                id="edit-sitemap-name"
                value={newSitemapData.name}
                onChange={(e) => setNewSitemapData({ ...newSitemapData, name: e.target.value })}
                placeholder="My Website Sitemap"
              />
            </div>
            <div>
              <Label htmlFor="edit-sitemap-description">Description (optional)</Label>
              <Textarea
                id="edit-sitemap-description"
                value={newSitemapData.description}
                onChange={(e) => setNewSitemapData({ ...newSitemapData, description: e.target.value })}
                placeholder="Describe what this sitemap is for..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Sitemap</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingSitemap?.name}" and cannot be undone.
              <br /><br />
              Type <strong>DELETE</strong> in the box below to confirm:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-4">
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteConfirmText !== 'DELETE'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}