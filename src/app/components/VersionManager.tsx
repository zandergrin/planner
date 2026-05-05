import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { ScrollArea } from "./ui/scroll-area";
import { Clock, Plus, Check, Trash2, AlertTriangle } from "lucide-react";
import { SitemapVersion } from '../utils/storage';
import { toast } from "sonner";

interface VersionManagerProps {
  open: boolean;
  onClose: () => void;
  currentVersion?: string;
  versions?: SitemapVersion[];
  onCreateVersion: (versionNumber: string, description?: string) => Promise<void>;
  onSwitchVersion: (versionNumber: string) => void;
  onDeleteVersion: (versionNumber: string) => void;
  isViewOnly?: boolean;
}

export function VersionManager({
  open,
  onClose,
  currentVersion,
  versions = [],
  onCreateVersion,
  onSwitchVersion,
  onDeleteVersion,
  isViewOnly = false,
}: VersionManagerProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newVersionNumber, setNewVersionNumber] = useState('');
  const [newVersionDescription, setNewVersionDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [versionToDelete, setVersionToDelete] = useState<string | null>(null);

  const handleCreateVersion = async () => {
    if (!newVersionNumber.trim()) {
      toast.error('Please enter a version number');
      return;
    }

    // Validate version number format (allow numbers and decimals)
    const versionRegex = /^\d+(\.\d+)*$/;
    if (!versionRegex.test(newVersionNumber.trim())) {
      toast.error('Version number must be numeric (e.g., 1.0, 2.5, 3.0.1)');
      return;
    }

    // Check if version already exists
    const versionExists = versions.some(v => v.versionNumber === newVersionNumber.trim());
    if (versionExists) {
      toast.error('A version with this number already exists');
      return;
    }

    setIsCreating(true);
    try {
      await onCreateVersion(newVersionNumber.trim(), newVersionDescription.trim() || undefined);
      toast.success(`Version ${newVersionNumber} created successfully`);
      setNewVersionNumber('');
      setNewVersionDescription('');
      setShowCreateForm(false);
    } catch (error) {
      toast.error('Failed to create version');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSwitchVersion = (versionNumber: string) => {
    onSwitchVersion(versionNumber);
    toast.success(`Switched to version ${versionNumber}`);
    onClose();
  };

  const handleDeleteVersion = (versionNumber: string) => {
    onDeleteVersion(versionNumber);
    toast.success(`Version ${versionNumber} deleted successfully`);
    onClose();
  };

  const sortedVersions = [...versions].sort((a, b) => {
    // Sort by version number (descending)
    const aParts = a.versionNumber.split('.').map(Number);
    const bParts = b.versionNumber.split('.').map(Number);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aNum = aParts[i] || 0;
      const bNum = bParts[i] || 0;
      if (aNum !== bNum) return bNum - aNum;
    }
    return 0;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Version Management</DialogTitle>
          <DialogDescription>
            {isViewOnly 
              ? 'View and switch between different versions of this sitemap.'
              : 'Create snapshots of your sitemap and switch between versions.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Version Display */}
          {currentVersion && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span className="font-medium">Current Version: {currentVersion}</span>
              </div>
            </div>
          )}

          {/* Create New Version Button */}
          {!isViewOnly && !showCreateForm && (
            <Button
              onClick={() => setShowCreateForm(true)}
              className="w-full"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Version
            </Button>
          )}

          {/* Create Version Form */}
          {!isViewOnly && showCreateForm && (
            <div className="p-4 border rounded-lg space-y-3">
              <div className="space-y-2">
                <Label htmlFor="version-number">Version Number *</Label>
                <Input
                  id="version-number"
                  placeholder="e.g., 1.0, 2.5, 3.0.1"
                  value={newVersionNumber}
                  onChange={(e) => setNewVersionNumber(e.target.value)}
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="version-description">Description (Optional)</Label>
                <Textarea
                  id="version-description"
                  placeholder="What changed in this version?"
                  value={newVersionDescription}
                  onChange={(e) => setNewVersionDescription(e.target.value)}
                  disabled={isCreating}
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleCreateVersion}
                  disabled={isCreating}
                  size="sm"
                >
                  {isCreating ? 'Creating...' : 'Create Version'}
                </Button>
                <Button
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewVersionNumber('');
                    setNewVersionDescription('');
                  }}
                  variant="ghost"
                  size="sm"
                  disabled={isCreating}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Version List */}
          <div className="space-y-2">
            <Label>Available Versions ({sortedVersions.length})</Label>
            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-2 space-y-2">
                {sortedVersions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No versions created yet
                  </div>
                ) : (
                  sortedVersions.map((version) => (
                    <div
                      key={version.versionNumber}
                      className={`p-3 border rounded-lg hover:bg-muted/50 transition-colors ${
                        version.versionNumber === currentVersion ? 'bg-muted border-primary' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Version {version.versionNumber}</span>
                            {version.versionNumber === currentVersion && (
                              <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                                Current
                              </span>
                            )}
                          </div>
                          
                          {version.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {version.description}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDate(version.createdAt)}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {version.versionNumber !== currentVersion && (
                            <Button
                              onClick={() => handleSwitchVersion(version.versionNumber)}
                              size="sm"
                              variant="outline"
                            >
                              Switch
                            </Button>
                          )}

                          {!isViewOnly && version.versionNumber !== currentVersion && (
                            <Button
                              onClick={() => setVersionToDelete(version.versionNumber)}
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!versionToDelete} onOpenChange={(open) => !open && setVersionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <AlertDialogTitle>Delete Version {versionToDelete}?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-2">
              <p>This action cannot be reversed. This will permanently delete version {versionToDelete} and all its associated data.</p>
              <p className="font-medium text-foreground">Are you absolutely sure you want to continue?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setVersionToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (versionToDelete) {
                  handleDeleteVersion(versionToDelete);
                  setVersionToDelete(null);
                }
              }}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete Version
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}