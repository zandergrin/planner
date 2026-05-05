import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

export function UrlDebugger() {
  const [urlInfo, setUrlInfo] = useState<any>(null);

  const analyzeUrl = () => {
    const fullUrl = window.location.href;
    const urlParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash;

    const analysis = {
      fullUrl,
      origin: window.location.origin,
      pathname: window.location.pathname,
      search: window.location.search,
      hash,
      mode: urlParams.get('mode'),
      sitemap: urlParams.get('sitemap'),
      allParams: Object.fromEntries(urlParams.entries()),
      containsViewMode: fullUrl.includes('mode=view'),
      containsEncodedViewMode: fullUrl.includes('mode%3Dview'),
      sitemapMatches: {
        direct: urlParams.get('sitemap'),
        regex1: fullUrl.match(/sitemap=([^&\s#]+)/)?.[1],
        regex2: fullUrl.match(/sitemap=([A-Za-z0-9]{4,10})(?:[&\s#]|$)/)?.[1],
      }
    };

    setUrlInfo(analysis);
    console.log('🔍 URL Analysis:', analysis);
  };

  useEffect(() => {
    analyzeUrl();
  }, []);

  if (!urlInfo) return null;

  const isViewerUrl = urlInfo.mode === 'view' && urlInfo.sitemap;

  return (
    <Card className="fixed bottom-4 right-4 w-96 max-h-96 overflow-auto z-50 bg-background/95 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          URL Debug Info
          <Button size="sm" variant="outline" onClick={analyzeUrl}>
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className={`p-2 rounded ${isViewerUrl ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          Status: {isViewerUrl ? '✅ Should be VIEWER mode' : '❌ Not viewer mode'}
        </div>
        
        <div>
          <strong>Mode:</strong> {urlInfo.mode || 'null'}
        </div>
        <div>
          <strong>Sitemap ID:</strong> {urlInfo.sitemap || 'null'}
        </div>
        <div>
          <strong>Contains "mode=view":</strong> {urlInfo.containsViewMode ? 'Yes' : 'No'}
        </div>
        
        <details>
          <summary className="cursor-pointer font-medium">URL Extraction Results</summary>
          <div className="mt-2 space-y-1 pl-2">
            <div><strong>Direct:</strong> {urlInfo.sitemapMatches.direct || 'null'}</div>
            <div><strong>Regex 1:</strong> {urlInfo.sitemapMatches.regex1 || 'null'}</div>
            <div><strong>Regex 2:</strong> {urlInfo.sitemapMatches.regex2 || 'null'}</div>
          </div>
        </details>

        <details>
          <summary className="cursor-pointer font-medium">Raw URL Data</summary>
          <div className="mt-2 space-y-1 pl-2 break-all">
            <div><strong>Full URL:</strong> {urlInfo.fullUrl}</div>
            <div><strong>Search:</strong> {urlInfo.search || 'empty'}</div>
            <div><strong>Hash:</strong> {urlInfo.hash || 'empty'}</div>
          </div>
        </details>

        <Button size="sm" className="w-full" onClick={() => console.log('Full URL Info:', urlInfo)}>
          Log to Console
        </Button>
      </CardContent>
    </Card>
  );
}