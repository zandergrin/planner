/**
 * Save Status Indicator Component
 * Shows real-time save status with smooth animations
 */

import { useEffect, useState } from 'react';
import { Check, Loader2, Clock } from 'lucide-react';

interface SaveStatusIndicatorProps {
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSavedAt?: Date;
}

export function SaveStatusIndicator({ isSaving, hasUnsavedChanges, lastSavedAt }: SaveStatusIndicatorProps) {
  const [showStatus, setShowStatus] = useState(true);
  
  useEffect(() => {
    // Always show status when there's activity
    if (isSaving || hasUnsavedChanges) {
      setShowStatus(true);
    } else {
      // After save completes, show "Saved" for 3 seconds then fade out
      const timer = setTimeout(() => setShowStatus(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isSaving, hasUnsavedChanges]);

  const getRelativeTime = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 120) return '1 minute ago';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!showStatus && !isSaving && !hasUnsavedChanges) {
    return null;
  }

  return (
    <div 
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium
        transition-all duration-300 ease-in-out
        ${isSaving ? 'bg-blue-50 text-blue-700 border border-blue-200' : ''}
        ${hasUnsavedChanges && !isSaving ? 'bg-amber-50 text-amber-700 border border-amber-200' : ''}
        ${!isSaving && !hasUnsavedChanges ? 'bg-green-50 text-green-700 border border-green-200' : ''}
      `}
    >
      {isSaving && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Saving...</span>
        </>
      )}
      {hasUnsavedChanges && !isSaving && (
        <>
          <Clock className="h-3 w-3" />
          <span>Unsaved changes</span>
        </>
      )}
      {!isSaving && !hasUnsavedChanges && lastSavedAt && (
        <>
          <Check className="h-3 w-3" />
          <span>Saved {getRelativeTime(lastSavedAt)}</span>
        </>
      )}
    </div>
  );
}
