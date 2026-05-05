import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Download, FileText, Code, Table, FileImage } from 'lucide-react';
import { SerializableSitemap } from '../utils/storage';
import { exportSitemap, exportSitemapAsync, downloadExport, downloadPDF, generateExportFilename, ExportOptions } from '../utils/export-service';
import { toast } from "sonner";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sitemap: SerializableSitemap;
}

export function ExportDialog({ isOpen, onClose, sitemap }: ExportDialogProps) {
  const [format, setFormat] = useState<'xml' | 'json' | 'csv' | 'pdf'>('json');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [baseUrl, setBaseUrl] = useState('https://example.com');
  const [isExporting, setIsExporting] = useState(false);

  const formatOptions = [
    {
      value: 'pdf' as const,
      label: 'PDF Document',
      description: 'Visual snapshot of your sitemap canvas',
      icon: FileImage,
      recommended: 'For presentations and visual documentation'
    },
    {
      value: 'xml' as const,
      label: 'XML Sitemap',
      description: 'Standard web sitemap format (sitemaps.org)',
      icon: FileText,
      recommended: 'For search engines and web crawlers'
    },
    {
      value: 'json' as const,
      label: 'JSON Format',
      description: 'Complete system format for import/export',
      icon: Code,
      recommended: 'For backing up or transferring sitemaps'
    },
    {
      value: 'csv' as const,
      label: 'CSV Spreadsheet',
      description: 'Flat table format for analysis',
      icon: Table,
      recommended: 'For spreadsheet analysis or reporting'
    }
  ];

  const handleExport = async () => {
    try {
      setIsExporting(true);
      
      const options: ExportOptions = {
        format,
        includeMetadata,
        baseUrl: baseUrl.trim() || undefined,
        canvasElement: null // Will be set for PDF below
      };

      if (format === 'pdf') {
        // Handle PDF export asynchronously
        // Find the canvas element directly from the DOM
        console.log('🔍 Looking for canvas element...');
        const canvasElement = document.querySelector('[data-canvas-container]') as HTMLDivElement;
        console.log('Canvas element found:', canvasElement);
        
        if (!canvasElement) {
          console.error('❌ Canvas element not found in DOM');
          toast.error('Canvas not available', {
            description: 'Unable to capture the sitemap canvas for PDF export.'
          });
          return;
        }

        console.log('✅ Canvas element found, starting export...');
        options.canvasElement = canvasElement;
        options.pages = sitemap.pages; // Pass page position data
        
        try {
          const blob = await exportSitemapAsync(sitemap, options);
          const filename = generateExportFilename(sitemap, format);
          
          console.log('📥 Downloading PDF:', filename);
          downloadPDF(blob as Blob, filename);
          
          toast.success(`Sitemap exported successfully as ${filename}`, {
            description: 'Format: PDF'
          });
        } catch (pdfError) {
          console.error('❌ PDF export error:', pdfError);
          throw pdfError; // Re-throw to be caught by outer catch
        }
      } else {
        // Handle other formats synchronously
        const content = exportSitemap(sitemap, options);
        const filename = generateExportFilename(sitemap, format);
        
        // Download the file
        downloadExport(content, filename, format);
        
        // Show success message
        toast.success(`Sitemap exported successfully as ${filename}`, {
          description: `Format: ${format.toUpperCase()}`
        });
      }
      
      // Close dialog after short delay
      setTimeout(() => {
        onClose();
      }, 1000);
      
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const selectedFormat = formatOptions.find(f => f.value === format);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Sitemap
          </DialogTitle>
          <DialogDescription>
            Export "{sitemap.name}" in your preferred format
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label>Export Format</Label>
            <div className="grid gap-3">
              {formatOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <div
                    key={option.value}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      format === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setFormat(option.value)}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="h-5 w-5 mt-0.5 text-primary" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{option.label}</span>
                          {format === option.value && (
                            <div className="h-2 w-2 bg-primary rounded-full" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {option.description}
                        </p>
                        <p className="text-xs text-primary mt-1">
                          {option.recommended}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Base URL (for XML and CSV) */}
          {(format === 'xml' || format === 'csv') && (
            <div className="space-y-2">
              <Label htmlFor="baseUrl">Base URL (Optional)</Label>
              <Input
                id="baseUrl"
                placeholder="https://example.com"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used to generate full URLs for pages in the export
              </p>
            </div>
          )}

          {/* Export Options */}
          <div className="space-y-3">
            <Label>Export Options</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeMetadata"
                checked={includeMetadata}
                onCheckedChange={(checked) => setIncludeMetadata(checked === true)}
              />
              <Label htmlFor="includeMetadata" className="text-sm">
                Include additional metadata
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {format === 'pdf' && 'Adds sitemap name, page count, and creation info to PDF properties'}
              {format === 'xml' && 'Adds page type, depth, and description as comments'}
              {format === 'json' && 'Includes export statistics and additional data'}
              {format === 'csv' && 'Adds ID, creation date, and modification date columns'}
            </p>
          </div>

          {/* Preview Info */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <h4 className="font-medium">Export Preview</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• Format: {selectedFormat?.label}</p>
              <p>• Pages: {sitemap.pages.length} root pages</p>
              <p>• Filename: {generateExportFilename(sitemap, format)}</p>
              {includeMetadata && <p>• Includes metadata</p>}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isExporting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}