import { useState, useEffect } from 'react';
import { MessageCircle, Plus, Check, X, Trash2, Clock, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { toast } from "sonner";
import { Comment, getComments, createComment, resolveComment, deleteComment, getCommentSettings } from '../utils/comments-service';

interface CommentsPanelProps {
  sitemapId: string;
  pageId: string;
  isViewOnly: boolean;
  refreshKey?: number;
  onCommentAdded?: () => void; // Callback to notify parent when comment is added
}

export function CommentsPanel({ sitemapId, pageId, isViewOnly, refreshKey, onCommentAdded }: CommentsPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddComment, setShowAddComment] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commenterName, setCommenterName] = useState('');
  const [commenterEmail, setCommenterEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [allowedDomain, setAllowedDomain] = useState('');
  const [commentsEnabled, setCommentsEnabled] = useState(false); // Default to false, will be updated by settings
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Load saved commenter credentials from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem('commenter_name');
    const savedEmail = localStorage.getItem('commenter_email');
    if (savedName && savedEmail) {
      setCommenterName(savedName);
      setCommenterEmail(savedEmail);
    }
  }, []);

  useEffect(() => {
    // Create an async function to load both
    const loadAll = async () => {
      setLoading(true);
      setSettingsLoading(true);
      
      try {
        // Load in parallel
        await Promise.all([
          loadComments(),
          loadCommentSettings()
        ]);
      } finally {
        setLoading(false);
        setSettingsLoading(false);
      }
    };
    
    loadAll();
  }, [sitemapId, pageId, refreshKey]);

  const loadComments = async () => {
    try {
      const fetchedComments = await getComments(sitemapId, pageId);
      setComments(fetchedComments);
    } catch (error) {
      console.error('CommentsPanel: Error loading comments:', error);
      // Silently handle errors - empty comments array will be shown
      setComments([]);
    }
  };

  const loadCommentSettings = async () => {
    try {
      const settings = await getCommentSettings(sitemapId);
      setAllowedDomain(settings.allowedDomain);
      setCommentsEnabled(settings.commentsEnabled);
    } catch (error) {
      console.error('Failed to load comment settings:', error);
      // Silently handle errors - use default settings (disabled)
      setCommentsEnabled(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !commenterName.trim() || !commenterEmail.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!commenterEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setSubmitting(true);
      const comment = await createComment(
        sitemapId,
        pageId,
        commenterEmail.trim(),
        commenterName.trim(),
        newComment.trim(),
        allowedDomain
      );

      // Save commenter credentials to localStorage for future use
      localStorage.setItem('commenter_name', commenterName.trim());
      localStorage.setItem('commenter_email', commenterEmail.trim());

      setComments(prev => [comment, ...prev]);
      setNewComment('');
      setShowAddComment(false);
      toast.success('Comment added successfully');
      if (onCommentAdded) {
        onCommentAdded();
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveComment = async (commentId: string, resolved: boolean) => {
    try {
      const updatedComment = await resolveComment(commentId, resolved);
      setComments(prev => prev.map(c => c.id === commentId ? updatedComment : c));
      toast.success(resolved ? 'Comment resolved' : 'Comment reopened');
    } catch (error) {
      console.error('Error updating comment:', error);
      toast.error('Failed to update comment');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment(commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      toast.success('Comment deleted');
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment');
    }
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

  const resolvedComments = comments.filter(c => c.resolved);
  const openComments = comments.filter(c => !c.resolved);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Comments
          {comments.length > 0 && (
            <Badge variant="secondary">
              {comments.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Comment Button - Show in edit mode OR if comments are enabled in view mode */}
        {(!isViewOnly || commentsEnabled) && (
          <>
            {!showAddComment ? (
              <Button
                onClick={() => setShowAddComment(true)}
                variant="outline"
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Comment
              </Button>
            ) : (
              <div className="space-y-3 p-3 border rounded-lg">
                <Input
                  placeholder="Your name"
                  value={commenterName}
                  onChange={(e) => setCommenterName(e.target.value)}
                />
                <Input
                  type="email"
                  placeholder={allowedDomain ? `Your email (@${allowedDomain})` : 'Your email'}
                  value={commenterEmail}
                  onChange={(e) => setCommenterEmail(e.target.value)}
                />
                {allowedDomain && (
                  <p className="text-xs text-muted-foreground">
                    Only emails from @{allowedDomain} are allowed
                  </p>
                )}
                <Textarea
                  placeholder="Add your comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddComment}
                    disabled={submitting}
                    size="sm"
                  >
                    {submitting ? 'Adding...' : 'Add Comment'}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowAddComment(false);
                      setNewComment('');
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
        
        {/* Show message when comments are disabled in view-only mode */}
        {isViewOnly && !commentsEnabled && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Comments are disabled for this sitemap
          </div>
        )}

        {loading ? (
          <div className="text-center py-4 text-muted-foreground">
            Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            No comments yet
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {/* Open Comments */}
              {openComments.length > 0 && (
                <div className="space-y-3">
                  {openComments.map((comment) => (
                    <div key={comment.id} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-sm">{comment.commenterName}</div>
                          <Badge variant="outline" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            Open
                          </Badge>
                        </div>
                        {!isViewOnly && (
                          <div className="flex items-center gap-1">
                            <Button
                              onClick={() => handleResolveComment(comment.id, true)}
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              onClick={() => handleDeleteComment(comment.id)}
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{comment.content}</p>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(comment.timestamp)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Resolved Comments */}
              {resolvedComments.length > 0 && (
                <>
                  {openComments.length > 0 && <Separator />}
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-muted-foreground">
                      Resolved Comments
                    </div>
                    {resolvedComments.map((comment) => (
                      <div key={comment.id} className="p-3 border rounded-lg space-y-2 opacity-60">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-sm">{comment.commenterName}</div>
                            <Badge variant="outline" className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Resolved
                            </Badge>
                          </div>
                          {!isViewOnly && (
                            <div className="flex items-center gap-1">
                              <Button
                                onClick={() => handleResolveComment(comment.id, false)}
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                              <Button
                                onClick={() => handleDeleteComment(comment.id)}
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{comment.content}</p>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(comment.timestamp)}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}