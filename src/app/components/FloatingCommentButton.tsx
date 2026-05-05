import { useState, useEffect } from 'react';
import { MessageCircle, X, User } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { toast } from "sonner";
import { getCommentSettings } from '../utils/comments-service';

interface FloatingCommentButtonProps {
  sitemapId: string;
  isViewOnly: boolean;
  onOpenComments: () => void;
  selectedPageId?: string;
  onSelectPage: (pageId: string) => void;
  pages: Array<{ id: string; name: string }>;
  totalComments: number;
}

export function FloatingCommentButton({ 
  sitemapId, 
  isViewOnly, 
  onOpenComments, 
  selectedPageId,
  onSelectPage,
  pages,
  totalComments
}: FloatingCommentButtonProps) {
  const [commentsEnabled, setCommentsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPageSelector, setShowPageSelector] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [allowedDomain, setAllowedDomain] = useState('');
  const [commenterName, setCommenterName] = useState('');
  const [commenterEmail, setCommenterEmail] = useState('');
  
  // Check for existing user session
  useEffect(() => {
    const savedName = localStorage.getItem('commenter_name');
    const savedEmail = localStorage.getItem('commenter_email');
    if (savedName && savedEmail) {
      setCommenterName(savedName);
      setCommenterEmail(savedEmail);
    }
  }, []);

  // Load comment settings
  useEffect(() => {
    const loadCommentSettings = async () => {
      try {
        setLoading(true);
        const settings = await getCommentSettings(sitemapId);
        setCommentsEnabled(settings.commentsEnabled);
        setAllowedDomain(settings.allowedDomain || '');
      } catch (error) {
        console.error('Error loading comment settings:', error);
        setCommentsEnabled(false);
      } finally {
        setLoading(false);
      }
    };

    if (sitemapId) {
      loadCommentSettings();
    }
  }, [sitemapId]);

  const validateAndSaveUser = async () => {
    if (!commenterName.trim() || !commenterEmail.trim()) {
      toast.error('Please enter both name and email');
      return false;
    }

    if (!commenterEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return false;
    }

    // Validate domain if required
    if (allowedDomain && allowedDomain.trim()) {
      const emailDomain = commenterEmail.split('@')[1]?.toLowerCase();
      const allowed = allowedDomain.toLowerCase().trim();
      
      if (!emailDomain || emailDomain !== allowed) {
        toast.error(`Email must be from domain: ${allowedDomain}`);
        return false;
      }
    }

    // Save to localStorage for future sessions
    localStorage.setItem('commenter_name', commenterName.trim());
    localStorage.setItem('commenter_email', commenterEmail.trim());
    
    return true;
  };

  const handleCommentClick = async () => {
    // Check if user is already authenticated
    if (!commenterName || !commenterEmail) {
      setShowAuthDialog(true);
      return;
    }

    // If no page is selected, show page selector
    if (!selectedPageId) {
      setShowPageSelector(true);
      return;
    }

    // Open comments for selected page
    onOpenComments();
  };

  const handleAuthSubmit = async () => {
    const isValid = await validateAndSaveUser();
    if (isValid) {
      setShowAuthDialog(false);
      // After auth, either open comments or show page selector
      if (selectedPageId) {
        onOpenComments();
      } else {
        setShowPageSelector(true);
      }
    }
  };

  const handlePageSelect = (pageId: string) => {
    onSelectPage(pageId);
    setShowPageSelector(false);
    onOpenComments();
  };

  // Don't show if not in view-only mode, loading, or comments disabled
  if (!isViewOnly || loading || !commentsEnabled) {
    return null;
  }

  return (
    <>
      {/* Floating Comment Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={handleCommentClick}
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-primary hover:bg-primary/90"
          size="sm"
        >
          <div className="relative">
            <MessageCircle className="h-6 w-6" />
            {totalComments > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
              >
                {totalComments > 99 ? '99+' : totalComments}
              </Badge>
            )}
          </div>
        </Button>
      </div>

      {/* Authentication Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Join the Conversation
            </DialogTitle>
            <DialogDescription>
              Enter your details to leave comments on this sitemap.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auth-name">Your Name</Label>
              <Input
                id="auth-name"
                placeholder="Enter your name"
                value={commenterName}
                onChange={(e) => setCommenterName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    document.getElementById('auth-email')?.focus();
                  }
                }}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="auth-email">Your Email</Label>
              <Input
                id="auth-email"
                type="email"
                placeholder={allowedDomain ? `Your email (@${allowedDomain})` : 'Your email'}
                value={commenterEmail}
                onChange={(e) => setCommenterEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAuthSubmit();
                  }
                }}
              />
              {allowedDomain && (
                <p className="text-xs text-muted-foreground">
                  Only emails from @{allowedDomain} are allowed
                </p>
              )}
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowAuthDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAuthSubmit}>
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Page Selector Dialog */}
      <Dialog open={showPageSelector} onOpenChange={setShowPageSelector}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Select a Page to Comment
            </DialogTitle>
            <DialogDescription>
              Choose which page you'd like to leave a comment on.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {pages.map((page) => (
              <Button
                key={page.id}
                variant="ghost"
                className="w-full justify-start h-auto p-3"
                onClick={() => handlePageSelect(page.id)}
              >
                <div className="text-left">
                  <div className="font-medium">{page.name}</div>
                </div>
              </Button>
            ))}
          </div>
          
          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={() => setShowPageSelector(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}