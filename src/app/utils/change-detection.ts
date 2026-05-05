/**
 * Smart change detection utility for sitemap data
 * Uses lightweight hashing instead of full JSON.stringify for performance
 */

import { Sitemap } from './storage';

/**
 * Creates a lightweight hash of sitemap data that matters for persistence
 * Excludes UI-only state like selectedPageId, zoom, etc.
 */
export function createSitemapDataHash(sitemap: Sitemap | null): string {
  if (!sitemap) return '';
  
  // Only hash the data that should trigger saves
  const dataToHash = {
    name: sitemap.name,
    description: sitemap.description,
    pages: sitemap.pages.map(p => ({
      id: p.id,
      name: p.name,
      url: p.url,
      color: p.color,
      pageType: p.pageType,
      parent: p.parent,
      children: p.children,
      description: p.description,
      published: p.published,
      visualLevel: p.visualLevel,
    })),
    footerPages: sitemap.footerPages?.map(p => ({
      id: p.id,
      name: p.name,
      url: p.url,
      color: p.color,
      pageType: p.pageType,
      description: p.description,
      published: p.published,
    })) || [],
    pageTypes: sitemap.pageTypes.map(pt => ({
      id: pt.id,
      name: pt.name,
      color: pt.color,
      description: pt.description,
      iconKey: pt.iconKey
    })),
    rootPageOrder: sitemap.rootPageOrder,
    collapsedGroups: sitemap.collapsedGroups,
    currentVersion: sitemap.currentVersion,
    versions: sitemap.versions?.map(v => ({
      versionNumber: v.versionNumber,
      description: v.description,
      createdAt: v.createdAt
    })) || []
  };
  
  // Simple hash function (better than JSON.stringify for performance)
  return simpleHash(JSON.stringify(dataToHash));
}

/**
 * Fast string hashing function
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Check if two sitemaps have meaningful data differences
 */
export function hasDataChanged(sitemap1: Sitemap | null, sitemap2: Sitemap | null): boolean {
  const hash1 = createSitemapDataHash(sitemap1);
  const hash2 = createSitemapDataHash(sitemap2);
  return hash1 !== hash2;
}
