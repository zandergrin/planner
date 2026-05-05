// Export service for sitemap data in various formats
import { SerializableSitemap, SerializablePage } from './storage';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export interface ExportOptions {
  format: 'xml' | 'json' | 'csv' | 'pdf';
  includeMetadata?: boolean;
  baseUrl?: string;
  canvasElement?: HTMLElement | null;
  pages?: any[]; // Page data with x, y positions
}

// Helper function to flatten sitemap into pages array for CSV/processing
function flattenSitemap(sitemap: SerializableSitemap): Array<SerializablePage & { depth: number; path: string }> {
  const result: Array<SerializablePage & { depth: number; path: string }> = [];
  
  // Build a page lookup map
  const pageMap = new Map<string, SerializablePage>();
  sitemap.pages.forEach(page => {
    pageMap.set(page.id, page);
  });
  
  // Find root pages (pages without parents)
  const rootPages = sitemap.pages.filter(page => !page.parent);
  
  function traverse(pageId: string, depth: number = 0, parentPath: string = '') {
    const page = pageMap.get(pageId);
    if (!page) return;
    
    const currentPath = parentPath ? `${parentPath} > ${page.name}` : page.name;
    
    result.push({
      ...page,
      depth,
      path: currentPath
    });
    
    // Traverse children
    if (page.children && page.children.length > 0) {
      page.children.forEach(childId => {
        traverse(childId, depth + 1, currentPath);
      });
    }
  }
  
  // Start traversal from root pages
  rootPages.forEach(rootPage => {
    traverse(rootPage.id);
  });
  
  return result;
}

// Generate XML sitemap (standard web format)
function generateXMLSitemap(sitemap: SerializableSitemap, options: ExportOptions): string {
  const baseUrl = options.baseUrl || 'https://example.com';
  const flatPages = flattenSitemap(sitemap);
  
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  flatPages.forEach(page => {
    // Create URL from page name (simplified)
    const url = `${baseUrl}/${page.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
    
    xml += '  <url>\n';
    xml += `    <loc>${url}</loc>\n`;
    
    if (options.includeMetadata) {
      xml += `    <!-- Page Type: ${page.pageType || 'Content Page'} -->\n`;
      xml += `    <!-- Path: ${(page as any).path} -->\n`;
      xml += `    <!-- Depth: ${(page as any).depth} -->\n`;
      
      if (page.description) {
        xml += `    <!-- Description: ${page.description.replace(/<!--/g, '').replace(/-->/g, '')} -->\n`;
      }
    }
    
    xml += '  </url>\n';
  });
  
  xml += '</urlset>';
  return xml;
}

// Generate JSON export (complete system format)
function generateJSONExport(sitemap: SerializableSitemap, options: ExportOptions): string {
  const exportData = {
    format: 'venn-sitemap-v1',
    exportDate: new Date().toISOString(),
    sitemap: {
      ...sitemap,
      // Add export metadata if requested
      ...(options.includeMetadata && {
        exportMetadata: {
          totalPages: flattenSitemap(sitemap).length,
          maxDepth: Math.max(...flattenSitemap(sitemap).map(p => (p as any).depth)),
          pageTypes: [...new Set(flattenSitemap(sitemap).map(p => p.pageType || 'Content Page'))],
        }
      })
    }
  };
  
  return JSON.stringify(exportData, null, 2);
}

// Generate CSV export (flat representation)
function generateCSVExport(sitemap: SerializableSitemap, options: ExportOptions): string {
  const flatPages = flattenSitemap(sitemap);
  
  // Define CSV headers
  const headers = [
    'Name',
    'Page Type',
    'Depth',
    'Path',
    'Description',
    'URL',
    'Parent Page',
    'Position',
    'Has Children'
  ];
  
  if (options.includeMetadata) {
    headers.push('ID', 'Created Date', 'Modified Date');
  }
  
  let csv = headers.join(',') + '\n';
  
  flatPages.forEach((page, index) => {
    const pathParts = (page as any).path.split(' > ');
    const parentPage = pathParts.length > 1 ? pathParts[pathParts.length - 2] : '';
    const url = options.baseUrl ? 
      `${options.baseUrl}/${page.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}` : 
      '';
    
    const row = [
      `"${page.name.replace(/"/g, '""')}"`,
      `"${page.pageType || 'Content Page'}"`,
      (page as any).depth,
      `"${(page as any).path.replace(/"/g, '""')}"`,
      `"${(page.description || '').replace(/"/g, '""')}"`,
      `"${url}"`,
      `"${parentPage.replace(/"/g, '""')}"`,
      index + 1,
      page.children && page.children.length > 0 ? 'Yes' : 'No'
    ];
    
    if (options.includeMetadata) {
      row.push(
        `"${page.id}"`,
        sitemap.createdAt,
        sitemap.updatedAt
      );
    }
    
    csv += row.join(',') + '\n';
  });
  
  return csv;
}

// Generate PDF export (visual canvas capture)
async function generatePDFExport(sitemap: SerializableSitemap, options: ExportOptions): Promise<Blob> {
  console.log('🔍 Starting PDF generation...');

  try {
    // Create PDF document
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let yPosition = margin;

    // Helper to add new page if needed
    const checkAndAddPage = (spaceNeeded: number) => {
      if (yPosition + spaceNeeded > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    // Helper to wrap text
    const wrapText = (text: string, maxWidth: number): string[] => {
      return pdf.splitTextToSize(text, maxWidth);
    };

    // Title
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    const titleText = sitemap.currentVersion 
      ? `${sitemap.name} (v${sitemap.currentVersion}) - Site Plan Overview`
      : `${sitemap.name} - Site Plan Overview`;
    pdf.text(titleText, margin, yPosition);
    yPosition += 10;

    // Divider line
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.5);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    // Build hierarchical structure
    const pageMap = new Map<string, SerializablePage>();
    sitemap.pages.forEach(page => {
      pageMap.set(page.id, page);
    });

    const rootPages = sitemap.pages.filter(page => !page.parent);

    // Recursive function to render page hierarchy
    const renderPageTree = (pageId: string, depth: number = 0) => {
      const page = pageMap.get(pageId);
      if (!page) return;

      checkAndAddPage(8);

      // Indentation and bullet
      const indent = margin + (depth * 6);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', depth === 0 ? 'bold' : 'normal');
      
      // Add bullet or dash
      const bullet = depth === 0 ? '●' : '–';
      pdf.text(bullet, indent, yPosition);
      
      // Page name with type if available
      const pageText = page.pageType && page.pageType !== 'Content Page' 
        ? `${page.name} (${page.pageType})`
        : page.name;
      
      pdf.text(pageText, indent + 4, yPosition);
      yPosition += 5;

      // Render children
      if (page.children && page.children.length > 0) {
        page.children.forEach(childId => {
          renderPageTree(childId, depth + 1);
        });
      }
    };

    // Render hierarchy
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Site Structure', margin, yPosition);
    yPosition += 7;

    pdf.setFontSize(10);
    rootPages.forEach(rootPage => {
      renderPageTree(rootPage.id, 0);
    });

    // Page Descriptions Section
    yPosition += 10;
    checkAndAddPage(20);

    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Page Descriptions', margin, yPosition);
    yPosition += 8;

    // Divider line
    pdf.setLineWidth(0.5);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // Get all pages in hierarchical order
    const allPagesOrdered: Array<{ page: SerializablePage; depth: number; path: string }> = [];
    
    const collectPages = (pageId: string, depth: number = 0, parentPath: string = '') => {
      const page = pageMap.get(pageId);
      if (!page) return;

      const currentPath = parentPath ? `${parentPath} > ${page.name}` : page.name;
      allPagesOrdered.push({ page, depth, path: currentPath });

      if (page.children && page.children.length > 0) {
        page.children.forEach(childId => {
          collectPages(childId, depth + 1, currentPath);
        });
      }
    };

    rootPages.forEach(rootPage => {
      collectPages(rootPage.id, 0);
    });

    // Render each page description
    allPagesOrdered.forEach(({ page, depth, path }, index) => {
      // Check if we need a new page
      checkAndAddPage(25);

      // Page name
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(page.name, margin, yPosition);
      yPosition += 6;

      // Page path (if not root)
      if (depth > 0) {
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(100, 100, 100);
        const pathLines = wrapText(`Path: ${path}`, contentWidth);
        pathLines.forEach(line => {
          pdf.text(line, margin, yPosition);
          yPosition += 4;
        });
        pdf.setTextColor(0, 0, 0);
        yPosition += 2;
      }

      // Page type
      if (page.pageType && page.pageType !== 'Content Page') {
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(60, 60, 60);
        pdf.text(`Type: ${page.pageType}`, margin, yPosition);
        yPosition += 5;
        pdf.setTextColor(0, 0, 0);
      }

      // Description
      if (page.description && page.description.trim()) {
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        const descLines = wrapText(page.description, contentWidth);
        descLines.forEach(line => {
          checkAndAddPage(5);
          pdf.text(line, margin, yPosition);
          yPosition += 4.5;
        });
      } else {
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(150, 150, 150);
        pdf.text('No description provided.', margin, yPosition);
        pdf.setTextColor(0, 0, 0);
        yPosition += 4.5;
      }

      // URL slug if available
      if (page.url && page.url.trim()) {
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(80, 80, 80);
        pdf.text(`URL: ${page.url}`, margin, yPosition);
        pdf.setTextColor(0, 0, 0);
        yPosition += 5;
      }

      // Children count
      if (page.children && page.children.length > 0) {
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Child pages: ${page.children.length}`, margin, yPosition);
        pdf.setTextColor(0, 0, 0);
        yPosition += 5;
      }

      // Spacing between pages
      yPosition += 5;

      // Light separator line
      if (index < allPagesOrdered.length - 1) {
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.1);
        pdf.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 5;
      }
    });

    // Add metadata if requested
    if (options.includeMetadata) {
      const pageCount = allPagesOrdered.length;
      pdf.setProperties({
        title: sitemap.name,
        subject: `Sitemap with ${pageCount} pages`,
        author: 'Sitemap Builder',
        creator: 'Sitemap Builder',
        keywords: 'sitemap, website structure'
      });
    }

    console.log('✅ PDF generation complete!');
    return pdf.output('blob');
  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to generate PDF: ${error.message}`);
    }
    throw new Error('Failed to generate PDF. Please try again.');
  }
}

// Main export function - updated to handle async PDF export
export async function exportSitemapAsync(sitemap: SerializableSitemap, options: ExportOptions): Promise<string | Blob> {
  if (options.format === 'pdf') {
    return await generatePDFExport(sitemap, options);
  }
  return exportSitemap(sitemap, options);
}

// Main export function
export function exportSitemap(sitemap: SerializableSitemap, options: ExportOptions): string {
  switch (options.format) {
    case 'xml':
      return generateXMLSitemap(sitemap, options);
    case 'json':
      return generateJSONExport(sitemap, options);
    case 'csv':
      return generateCSVExport(sitemap, options);
    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }
}

// Helper function to download exported data
export function downloadExport(content: string, filename: string, format: 'xml' | 'json' | 'csv'): void {
  const mimeTypes = {
    xml: 'application/xml',
    json: 'application/json',
    csv: 'text/csv'
  };
  
  const blob = new Blob([content], { type: mimeTypes[format] });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

// Helper function to download PDF blob
export function downloadPDF(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

// Generate appropriate filename
export function generateExportFilename(sitemap: SerializableSitemap, format: 'xml' | 'json' | 'csv' | 'pdf'): string {
  const safeName = sitemap.name.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .substring(0, 50);
  
  const timestamp = new Date().toISOString().split('T')[0];
  
  // Include version number in filename if it exists
  const versionSuffix = sitemap.currentVersion ? `-v${sitemap.currentVersion}` : '';
  
  return `${safeName}${versionSuffix}-${timestamp}.${format}`;
}

// Import function for JSON format (for future use)
export function importSitemap(jsonContent: string): SerializableSitemap | null {
  try {
    const data = JSON.parse(jsonContent);
    
    // Validate format
    if (data.format !== 'venn-sitemap-v1') {
      console.warn('Unknown import format:', data.format);
    }
    
    // Extract sitemap data
    const sitemap = data.sitemap;
    
    // Basic validation
    if (!sitemap.id || !sitemap.name || !Array.isArray(sitemap.pages)) {
      throw new Error('Invalid sitemap data structure');
    }
    
    return sitemap;
  } catch (error) {
    console.error('Failed to import sitemap:', error);
    return null;
  }
}