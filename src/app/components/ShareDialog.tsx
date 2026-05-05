import { useState, useEffect, useRef } from 'react';
import { Copy, Check, Link, Info, Loader2, MessageCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';

import { toast } from "sonner";
import { updateCommentSettings, getCommentSettings } from '../utils/comments-service';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fullUrl: string;
  compressedUrl: string;
  sitemapName: string;
  sitemapId?: string;
  currentVersion?: string;
  onGenerateUrls?: () => Promise<{ fullUrl: string; compressedUrl: string }> | { fullUrl: string; compressedUrl: string };
}

export function ShareDialog({ isOpen, onClose, fullUrl, compressedUrl, sitemapName, sitemapId, currentVersion, onGenerateUrls }: ShareDialogProps) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [urls, setUrls] = useState({ fullUrl, compressedUrl });
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [commentsEnabled, setCommentsEnabled] = useState(false);
  const [allowedDomain, setAllowedDomain] = useState('');

  // Load comment settings when dialog opens
  useEffect(() => {
    const loadSettings = async () => {
      if (isOpen && sitemapId) {
        try {
          const settings = await getCommentSettings(sitemapId);
          setCommentsEnabled(settings.commentsEnabled);
          setAllowedDomain(settings.allowedDomain);
        } catch (error) {
          console.error('Failed to load comment settings:', error);
        }
      }
    };

    loadSettings();
  }, [isOpen, sitemapId]);

  // Generate URLs when dialog opens
  useEffect(() => {
    if (isOpen && onGenerateUrls && (!urls.fullUrl || !urls.compressedUrl)) {
      setIsLoading(true);
      
      const generateUrls = async () => {
        try {
          const result = onGenerateUrls();
          
          if (result instanceof Promise) {
            const resolvedUrls = await result;
            setUrls(resolvedUrls);
          } else {
            setUrls(result);
          }
        } catch (error) {
          console.error('Failed to generate URLs:', error);
          toast.error('Failed to generate share URLs');
        } finally {
          setIsLoading(false);
        }
      };
      
      generateUrls();
    } else if (isOpen) {
      // Use the passed URLs if available
      setUrls({ fullUrl, compressedUrl });
    }
  }, [isOpen, onGenerateUrls, fullUrl, compressedUrl]);

  // Save comment settings when they change
  useEffect(() => {
    if (sitemapId && isOpen) {
      const saveCommentSettings = async () => {
        try {
          await updateCommentSettings(sitemapId, {
            commentsEnabled,
            allowedDomain
          });
        } catch (error) {
          console.error('Failed to save comment settings:', error);
        }
      };

      // Debounce the save to avoid too many requests
      const timeout = setTimeout(saveCommentSettings, 500);
      return () => clearTimeout(timeout);
    }
  }, [commentsEnabled, allowedDomain, sitemapId, isOpen]);

  const copyToClipboard = async (url: string, type: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      toast.success(`${type} link copied to clipboard`);
      
      // Reset the copied state after 2 seconds
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      
      // Fallback: select the text in the input field
      if (inputRef.current) {
        const input = inputRef.current;
        input.select();
        input.setSelectionRange(0, input.value.length);
        
        // Try the legacy execCommand as a fallback
        try {
          const successful = document.execCommand('copy');
          if (successful) {
            setCopiedUrl(url);
            toast.success(`${type} link copied to clipboard`);
            setTimeout(() => setCopiedUrl(null), 2000);
            return;
          }
        } catch (execError) {
          console.error('execCommand copy failed:', execError);
        }
        
        // If all else fails, show instructions
        toast.error('Please manually copy the selected link (Ctrl+C or Cmd+C)', {
          duration: 5000,
        });
      } else {
        // Last resort: show the URL in a prompt
        prompt(`Copy this ${type.toLowerCase()} link:`, url);
      }
    }
  };

  const getUrlLength = (url: string) => {
    return `${url.length} characters`;
  };

  const getCompressionRatio = () => {
    if (!urls.fullUrl || !urls.compressedUrl) return 0;
    const savings = ((urls.fullUrl.length - urls.compressedUrl.length) / urls.fullUrl.length) * 100;
    return Math.round(savings);
  };

  const isShortUrl = (url: string) => {
    // Check if it's a short URL (contains a short sitemap parameter)
    const urlParams = new URLSearchParams(url.split('?')[1] || '');
    const sitemapParam = urlParams.get('sitemap');
    return sitemapParam && sitemapParam.length <= 10 && !sitemapParam.startsWith('data_');
  };

  const handleRegenerateUrl = async () => {
    if (!onGenerateUrls) return;
    
    setIsLoading(true);
    try {
      const result = onGenerateUrls(true);
      
      if (result instanceof Promise) {
        const resolvedUrls = await result;
        setUrls(resolvedUrls);
      } else {
        setUrls(result);
      }
      
      toast.success('Share URL regenerated successfully');
    } catch (error) {
      console.error('Failed to regenerate URLs:', error);
      toast.error('Failed to regenerate share URL');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Share "{sitemapName}"
          </DialogTitle>
          <DialogDescription>
            Share this link to provide view-only access to your sitemap. The link always shows the current state of your sitemap, so any changes you make will be visible to everyone with the link.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating share URL...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="share-url">Share Link</Label>
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  id="share-url"
                  value={urls.compressedUrl}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(urls.compressedUrl, 'Share')}
                  className="shrink-0 cursor-pointer active:scale-95 transition-transform"
                >
                  {copiedUrl === urls.compressedUrl ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                {getUrlLength(urls.compressedUrl)}
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">View-only access</p>
                  <p>This link provides read-only access to your sitemap. Viewers cannot make any changes.</p>
                  {currentVersion && (
                    <p className="mt-2">
                      <strong>Note:</strong> This link shows the live current state (version {currentVersion}). Any edits you make will be immediately visible to viewers.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Comments Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                <Label className="text-base font-medium">Comments & Feedback</Label>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Enable Comments</Label>
                    <p className="text-xs text-muted-foreground">
                      Allow viewers to leave comments on individual pages
                    </p>
                  </div>
                  <Switch
                    checked={commentsEnabled}
                    onCheckedChange={setCommentsEnabled}
                  />
                </div>

                {commentsEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="allowed-domain" className="text-sm font-medium">
                      Allowed Email Domain (Optional)
                    </Label>
                    <Input
                      id="allowed-domain"
                      placeholder="company.com"
                      value={allowedDomain}
                      onChange={(e) => setAllowedDomain(e.target.value)}
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      If specified, only users with emails from this domain can comment
                    </p>
                  </div>
                )}
              </div>

              {commentsEnabled && (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="text-sm text-amber-800 dark:text-amber-200">
                      <p className="font-medium mb-1">Comments enabled</p>
                      <p>Viewers will be able to leave comments on individual pages. Comments will be visible to all viewers.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}