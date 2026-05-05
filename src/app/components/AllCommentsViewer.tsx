import { useState, useEffect } from 'react';
import { MessageCircle, Clock, CheckCircle, FileText, Check, X, Trash2, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { toast } from "sonner";
import { Comment, getAllCommentsForSitemap, resolveComment, deleteComment } from '../utils/cloud-storage';
import type { SitePage } from '../utils/storage';

interface AllCommentsViewerProps {
  sitemapId: string;
  pages: SitePage[];
  onSelectPage: (pageId: string) => void;
  onCenterPage?: (pageId: string) => void; // Optional callback to center canvas on page
  selectedPageId?: string;
  refreshKey?: number; // Add optional refresh key to trigger reloads
}

export function AllCommentsViewer({ sitemapId, pages, onSelectPage, onCenterPage, selectedPageId, refreshKey }: AllCommentsViewerProps) {
  const [allComments, setAllComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);

  // Load comments only on mount and when refreshKey changes
  useEffect(() => {
    loadAllComments();
  }, [sitemapId, refreshKey]); // Removed pages and selectedPageId from dependencies

  const loadAllComments = async () => {
    try {
      setLoading(true);
      
      // Use the optimized function to get all comments at once
      const allSitemapComments = await getAllCommentsForSitemap(sitemapId);
      
      setAllComments(allSitemapComments);
    } catch (error) {
      console.error('AllCommentsViewer: Error loading comments:', error);
      setAllComments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveComment = async (commentId: string, resolved: boolean) => {
    try {
      const updatedComment = await resolveComment(commentId, resolved);
      setAllComments(prev => prev.map(c => c.id === commentId ? updatedComment : c));
      toast.success(resolved ? 'Comment resolved' : 'Comment reopened');
    } catch (error) {
      console.error('Error updating comment:', error);
      toast.error('Failed to update comment');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment(commentId);
      setAllComments(prev => prev.filter(c => c.id !== commentId));
      toast.success('Comment deleted');
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment');
    }
  };

  const handleCommentClick = (pageId: string, commentId: string) => {
    onSelectPage(pageId);
    // Center the canvas on the page if callback is provided
    if (onCenterPage) {
      // Small delay to allow page selection to complete
      setTimeout(() => onCenterPage(pageId), 100);
    }
    setHighlightedCommentId(commentId);
    setTimeout(() => setHighlightedCommentId(null), 2000); // Remove highlight after 2 seconds
  };

  const getPageName = (pageId: string): string => {
    const page = pages.find(p => p.id === pageId);
    return page ? String(page.name) : 'Unknown Page';
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const resolvedComments = allComments.filter(c => c.resolved);
  const openComments = allComments.filter(c => !c.resolved);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">All Comments</h3>
          <p className="text-sm text-muted-foreground">
            {allComments.length} total • {openComments.length} open • {resolvedComments.length} resolved
          </p>
        </div>
        <Button
          onClick={loadAllComments}
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title="Refresh comments"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading comments...
        </div>
      ) : allComments.length === 0 ? (
        <div className="text-center py-8">
          <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
          <h3 className="font-medium mb-2">No comments yet</h3>
          <p className="text-sm text-muted-foreground">Comments will appear here once added</p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-220px)]">
          <div className="space-y-4 pr-4">
            {/* Open Comments */}
            {openComments.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-medium">Open Comments</h4>
                  <Badge variant="secondary">{openComments.length}</Badge>
                </div>
                {openComments.map((comment) => (
                  <Card
                    key={comment.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      highlightedCommentId === comment.id 
                        ? 'ring-2 ring-primary shadow-lg' 
                        : selectedPageId === comment.pageId
                        ? 'border-primary'
                        : ''
                    }`}
                    onClick={() => handleCommentClick(comment.pageId, comment.id)}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs font-medium text-primary">
                              {getPageName(comment.pageId)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-sm">{comment.commenterName}</span>
                            <Badge variant="outline" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              Open
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResolveComment(comment.id, true);
                            }}
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title="Resolve comment"
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteComment(comment.id);
                            }}
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive"
                            title="Delete comment"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm">{comment.content}</p>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(comment.timestamp)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Resolved Comments */}
            {resolvedComments.length > 0 && (
              <>
                {openComments.length > 0 && <Separator className="my-4" />}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-medium text-muted-foreground">Resolved Comments</h4>
                    <Badge variant="outline">{resolvedComments.length}</Badge>
                  </div>
                  {resolvedComments.map((comment) => (
                    <Card
                      key={comment.id}
                      className={`cursor-pointer transition-all hover:shadow-md opacity-60 ${
                        highlightedCommentId === comment.id 
                          ? 'ring-2 ring-primary shadow-lg opacity-100' 
                          : selectedPageId === comment.pageId
                          ? 'border-primary opacity-80'
                          : ''
                      }`}
                      onClick={() => handleCommentClick(comment.pageId, comment.id)}
                    >
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <FileText className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs font-medium text-primary">
                                {getPageName(comment.pageId)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium text-sm">{comment.commenterName}</span>
                              <Badge variant="outline" className="text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Resolved
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResolveComment(comment.id, false);
                              }}
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title="Reopen comment"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteComment(comment.id);
                              }}
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive"
                              title="Delete comment"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm">{comment.content}</p>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(comment.timestamp)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}