import { MessageCircle } from 'lucide-react';
import { Badge } from './ui/badge';

interface CommentIndicatorProps {
  commentCount: number; // Pass the count from parent instead of loading it
  className?: string;
}

export function CommentIndicator({ commentCount, className = '' }: CommentIndicatorProps) {
  if (commentCount === 0) {
    return null;
  }

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <MessageCircle className="h-3 w-3 text-muted-foreground" />
      <Badge variant="secondary" className="text-xs px-1.5 py-0.5 h-5">
        {commentCount}
      </Badge>
    </div>
  );
}