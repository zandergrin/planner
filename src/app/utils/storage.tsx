// Cloud storage system that requires cloud connectivity to function
import React from 'react';
import { Home, FileText, Mail, Info, ShoppingCart, User, Search, Grid, Blocks } from 'lucide-react';
import { 
  loadCloudSitemaps,
  saveCloudSitemap as saveCloudSitemapDirect,
  deleteCloudSitemap,
  loadCloudPageTypes,
  saveCloudPageTypes,
  testCloudConnection 
} from './cloud-storage';
import { createShortUrl } from './short-url-service';

// Serializable interface for pages (no React elements)
export interface SerializablePage {
  id: string;
  name: string;
  iconKey: string;
  color: string;
  x: number;
  y: number;
  children: string[];
  parent?: string;
  pageType?: string;
  description?: string;
  url?: string;
  published?: boolean;
  visualLevel?: number; // ADDED: Manual indentation level (0 = root, 1 = inset once, etc.)
}

// Serializable interface for page types
export interface SerializablePageType {
  id: string;
  name: string;
  iconKey: string;
  color: string;
  description: string;
}

// Version snapshot interface
export interface SitemapVersion {
  versionNumber: string; // e.g., "1.0", "1.5", "2.0"
  createdAt: string;
  createdBy?: string;
  pages: SerializablePage[];
  pageTypes: SerializablePageType[];
  rootPageOrder: string[];
  collapsedGroups: string[];
  zoom: number;
  footerPages?: SerializablePage[];
  description?: string; // Optional version description
}

// Serializable sitemap interface
export interface SerializableSitemap {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  pages: SerializablePage[];
  pageTypes: SerializablePageType[];
  rootPageOrder: string[];
  collapsedGroups: string[];
  zoom: number;
  selectedPageId?: string;
  shareUrl?: string; // ADDED: Store the share URL permanently
  footerPages?: SerializablePage[]; // ADDED: Footer pages
  isArchived?: boolean; // ADDED: Archive status
  currentVersion?: string; // ADDED: Current active version number
  versions?: SitemapVersion[]; // ADDED: Array of version snapshots
}

// Runtime interfaces (with React elements) - used in components
export interface SitePage {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  x: number;
  y: number;
  children: string[];
  parent?: string;
  pageType?: string;
  description?: string;
  url?: string;
  published?: boolean;
  visualLevel?: number; // ADDED: Manual indentation level (0 = root, 1 = inset once, etc.)
}

export interface PageType {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  iconKey?: string;
}

export interface Sitemap {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  pages: SitePage[];
  pageTypes: PageType[];
  rootPageOrder: string[];
  collapsedGroups: string[];
  zoom: number;
  selectedPageId?: string;
  shareUrl?: string; // ADDED: Store the share URL permanently
  footerPages?: SitePage[]; // ADDED: Footer pages
  isArchived?: boolean; // ADDED: Archive status
  currentVersion?: string; // ADDED: Current active version number
  versions?: SitemapVersion[]; // ADDED: Array of version snapshots
}

export interface SitemapSettings {
  lastOpenedSitemapId?: string;
}

// Storage keys (for local settings only)
const SETTINGS_KEY = 'sitemap_settings_v2';

// Icon registry for safe serialization
const iconRegistry = {
  'home': Home,
  'file': FileText,
  'mail': Mail,
  'info': Info,
  'shopping': ShoppingCart,
  'user': User,
  'search': Search,
  'grid': Grid,
  'blocks': Blocks,
} as const;

type IconKey = keyof typeof iconRegistry;

// Helper to create icon component safely
const createIconComponent = (iconKey: string): React.ReactNode => {
  const IconComponent = iconRegistry[iconKey as IconKey] || FileText;
  return <IconComponent className="h-4 w-4" />;
};

// Helper to get icon key from a page/pageType with proper fallback
const getIconKey = (item: any): string => {
  if (item.iconKey && typeof item.iconKey === 'string') {
    return item.iconKey;
  }
  
  if (item.pageType) {
    const typeToIconMap: { [key: string]: string } = {
      'home': 'home',
      'content': 'file',
      'about': 'info',
      'contact': 'mail',
      'product': 'shopping',
      'profile': 'user',
      'search': 'search',
      'grid': 'grid',
      'blocks': 'blocks',
    };
    return typeToIconMap[item.pageType] || 'file';
  }
  
  return 'file';
};

// Helper to serialize page for storage
const serializePage = (page: SitePage): SerializablePage => {
  const iconKey = getIconKey(page);
  
  return {
    id: String(page.id),
    name: String(page.name),
    iconKey: iconKey,
    color: String(page.color),
    x: Number(page.x) || 0,
    y: Number(page.y) || 0,
    children: Array.isArray(page.children) ? page.children.map(String) : [],
    parent: page.parent ? String(page.parent) : undefined,
    pageType: page.pageType ? String(page.pageType) : undefined,
    description: page.description ? String(page.description) : undefined,
    url: page.url ? String(page.url) : undefined,
    published: page.published !== undefined ? Boolean(page.published) : undefined,
    visualLevel: page.visualLevel !== undefined ? Number(page.visualLevel) : undefined, // ADDED: Include visualLevel in serialization
  };
};

// Helper to deserialize page from storage
const deserializePage = (serialized: SerializablePage): SitePage => {
  const page = {
    id: serialized.id,
    name: serialized.name,
    icon: createIconComponent(serialized.iconKey),
    color: serialized.color,
    x: serialized.x,
    y: serialized.y,
    children: serialized.children || [],
    parent: serialized.parent,
    pageType: serialized.pageType,
    description: serialized.description,
    url: serialized.url,
    published: serialized.published,
    visualLevel: serialized.visualLevel, // ADDED: Include visualLevel in deserialization
  } as SitePage & { iconKey: string };
  
  (page as any).iconKey = serialized.iconKey;
  return page;
};

// Helper to serialize page type for storage
const serializePageType = (pageType: PageType): SerializablePageType => {
  const iconKey = getIconKey(pageType);
  
  return {
    id: String(pageType.id),
    name: String(pageType.name),
    iconKey: iconKey,
    color: String(pageType.color),
    description: String(pageType.description),
  };
};

// Helper to deserialize page type from storage
const deserializePageType = (serialized: SerializablePageType): PageType => {
  return {
    id: String(serialized.id),
    name: String(serialized.name),
    icon: createIconComponent(serialized.iconKey),
    color: String(serialized.color),
    description: String(serialized.description),
    iconKey: String(serialized.iconKey),
  };
};

// Helper to serialize sitemap for storage
const serializeSitemap = (sitemap: Sitemap): SerializableSitemap => {
  return {
    id: String(sitemap.id),
    name: String(sitemap.name),
    description: sitemap.description ? String(sitemap.description) : undefined,
    createdAt: sitemap.createdAt.toISOString(),
    updatedAt: sitemap.updatedAt.toISOString(),
    pages: sitemap.pages.map(serializePage),
    pageTypes: sitemap.pageTypes.map(serializePageType),
    rootPageOrder: Array.isArray(sitemap.rootPageOrder) ? sitemap.rootPageOrder.map(String) : [],
    collapsedGroups: Array.isArray(sitemap.collapsedGroups) ? sitemap.collapsedGroups.map(String) : [],
    zoom: Number(sitemap.zoom) || 1,
    selectedPageId: sitemap.selectedPageId ? String(sitemap.selectedPageId) : undefined,
    shareUrl: sitemap.shareUrl ? String(sitemap.shareUrl) : undefined, // ADDED: Include shareUrl in serialization
    footerPages: sitemap.footerPages ? sitemap.footerPages.map(serializePage) : undefined, // ADDED: Include footerPages in serialization
    isArchived: sitemap.isArchived ? Boolean(sitemap.isArchived) : undefined, // ADDED: Include archive status
    currentVersion: sitemap.currentVersion ? String(sitemap.currentVersion) : undefined, // ADDED: Include current version
    versions: sitemap.versions ? sitemap.versions.map(version => ({
      versionNumber: version.versionNumber,
      createdAt: version.createdAt,
      createdBy: version.createdBy,
      pages: version.pages.map(serializePage),
      pageTypes: version.pageTypes.map(serializePageType),
      rootPageOrder: Array.isArray(version.rootPageOrder) ? version.rootPageOrder.map(String) : [],
      collapsedGroups: Array.isArray(version.collapsedGroups) ? version.collapsedGroups.map(String) : [],
      zoom: Number(version.zoom) || 1,
      footerPages: version.footerPages ? version.footerPages.map(serializePage) : undefined,
      description: version.description,
    })) : undefined, // ADDED: Include versions
  };
};

// Helper to validate import data structure
const validateImportData = (data: any): data is SerializableSitemap => {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Check required fields
  if (!data.id || typeof data.id !== 'string') {
    return false;
  }

  if (!data.name || typeof data.name !== 'string') {
    return false;
  }

  if (!data.createdAt || typeof data.createdAt !== 'string') {
    return false;
  }

  if (!data.updatedAt || typeof data.updatedAt !== 'string') {
    return false;
  }

  // Check arrays exist and are arrays
  if (!Array.isArray(data.pages)) {
    return false;
  }

  if (!Array.isArray(data.pageTypes)) {
    return false;
  }

  if (!Array.isArray(data.rootPageOrder)) {
    return false;
  }

  if (!Array.isArray(data.collapsedGroups)) {
    return false;
  }

  // Validate zoom
  if (data.zoom !== undefined && (typeof data.zoom !== 'number' || isNaN(data.zoom))) {
    return false;
  }

  // Validate each page has required fields
  for (const page of data.pages) {
    if (!page || typeof page !== 'object') {
      return false;
    }
    if (!page.id || typeof page.id !== 'string') {
      return false;
    }
    if (!page.name || typeof page.name !== 'string') {
      return false;
    }
    if (!page.color || typeof page.color !== 'string') {
      return false;
    }
    if (page.x === undefined || typeof page.x !== 'number' || isNaN(page.x)) {
      return false;
    }
    if (page.y === undefined || typeof page.y !== 'number' || isNaN(page.y)) {
      return false;
    }
    if (!Array.isArray(page.children)) {
      return false;
    }
  }

  // Validate each page type has required fields
  for (const pageType of data.pageTypes) {
    if (!pageType || typeof pageType !== 'object') {
      return false;
    }
    if (!pageType.id || typeof pageType.id !== 'string') {
      return false;
    }
    if (!pageType.name || typeof pageType.name !== 'string') {
      return false;
    }
    if (!pageType.color || typeof pageType.color !== 'string') {
      return false;
    }
    if (!pageType.description || typeof pageType.description !== 'string') {
      return false;
    }
  }

  return true;
};

// Helper to fix import data structure with defaults
const normalizeImportData = (data: any): SerializableSitemap => {
  const normalized: SerializableSitemap = {
    id: String(data.id || 'imported-sitemap'),
    name: String(data.name || 'Imported Sitemap'),
    description: data.description ? String(data.description) : undefined,
    createdAt: data.createdAt ? String(data.createdAt) : new Date().toISOString(),
    updatedAt: data.updatedAt ? String(data.updatedAt) : new Date().toISOString(),
    pages: [],
    pageTypes: [],
    rootPageOrder: [],
    collapsedGroups: [],
    zoom: 1,
    selectedPageId: undefined,
    shareUrl: data.shareUrl ? String(data.shareUrl) : undefined, // ADDED: Preserve shareUrl during normalization
    footerPages: [], // ADDED: Initialize footerPages
    isArchived: data.isArchived ? Boolean(data.isArchived) : undefined, // ADDED: Preserve archive status
    currentVersion: data.currentVersion ? String(data.currentVersion) : undefined, // ADDED: Preserve current version
    versions: data.versions ? data.versions.map((version: any) => ({
      versionNumber: version.versionNumber,
      createdAt: version.createdAt,
      createdBy: version.createdBy,
      pages: version.pages.map((page: any) => ({
        id: String(page.id || 'page-' + Math.random().toString(36).substr(2, 9)),
        name: String(page.name || 'Untitled Page'),
        iconKey: String(page.iconKey || 'file'),
        color: String(page.color || 'bg-gray-500'),
        x: Number(page.x) || 0,
        y: Number(page.y) || 0,
        children: Array.isArray(page.children) ? page.children.map(String) : [],
        parent: page.parent ? String(page.parent) : undefined,
        pageType: page.pageType ? String(page.pageType) : undefined,
        description: page.description ? String(page.description) : undefined,
        url: page.url ? String(page.url) : undefined,
        published: page.published !== undefined ? Boolean(page.published) : undefined,
        visualLevel: page.visualLevel !== undefined ? Number(page.visualLevel) : undefined, // ADDED: Include visualLevel in normalization
      })),
      pageTypes: version.pageTypes.map((pageType: any) => ({
        id: String(pageType.id || 'type-' + Math.random().toString(36).substr(2, 9)),
        name: String(pageType.name || 'Untitled Type'),
        iconKey: String(pageType.iconKey || 'file'),
        color: String(pageType.color || 'bg-gray-500'),
        description: String(pageType.description || 'No description'),
      })),
      rootPageOrder: Array.isArray(version.rootPageOrder) ? version.rootPageOrder.map(String) : [],
      collapsedGroups: Array.isArray(version.collapsedGroups) ? version.collapsedGroups.map(String) : [],
      zoom: (typeof version.zoom === 'number' && !isNaN(version.zoom)) ? version.zoom : 1,
      footerPages: version.footerPages ? version.footerPages.map((page: any) => ({
        id: String(page.id || 'footer-page-' + Math.random().toString(36).substr(2, 9)),
        name: String(page.name || 'Untitled Footer Page'),
        iconKey: String(page.iconKey || 'file'),
        color: String(page.color || 'bg-gray-500'),
        x: Number(page.x) || 0,
        y: Number(page.y) || 0,
        children: [],
        parent: undefined,
        pageType: page.pageType ? String(page.pageType) : undefined,
        description: page.description ? String(page.description) : undefined,
        url: page.url ? String(page.url) : undefined,
        published: page.published !== undefined ? Boolean(page.published) : undefined,
        visualLevel: page.visualLevel !== undefined ? Number(page.visualLevel) : undefined, // ADDED: Include visualLevel in normalization
      })) : undefined,
      description: version.description,
    })) : undefined, // ADDED: Preserve versions
  };

  // Normalize pages
  if (Array.isArray(data.pages)) {
    normalized.pages = data.pages.map((page: any) => ({
      id: String(page.id || 'page-' + Math.random().toString(36).substr(2, 9)),
      name: String(page.name || 'Untitled Page'),
      iconKey: String(page.iconKey || 'file'),
      color: String(page.color || 'bg-gray-500'),
      x: Number(page.x) || 0,
      y: Number(page.y) || 0,
      children: Array.isArray(page.children) ? page.children.map(String) : [],
      parent: page.parent ? String(page.parent) : undefined,
      pageType: page.pageType ? String(page.pageType) : undefined,
      description: page.description ? String(page.description) : undefined,
      url: page.url ? String(page.url) : undefined,
      published: page.published !== undefined ? Boolean(page.published) : undefined,
      visualLevel: page.visualLevel !== undefined ? Number(page.visualLevel) : undefined, // ADDED: Include visualLevel in normalization
    }));
  }

  // Normalize page types
  if (Array.isArray(data.pageTypes)) {
    normalized.pageTypes = data.pageTypes.map((pageType: any) => ({
      id: String(pageType.id || 'type-' + Math.random().toString(36).substr(2, 9)),
      name: String(pageType.name || 'Untitled Type'),
      iconKey: String(pageType.iconKey || 'file'),
      color: String(pageType.color || 'bg-gray-500'),
      description: String(pageType.description || 'No description'),
    }));
  }

  // Normalize arrays
  normalized.rootPageOrder = Array.isArray(data.rootPageOrder) ? data.rootPageOrder.map(String) : [];
  normalized.collapsedGroups = Array.isArray(data.collapsedGroups) ? data.collapsedGroups.map(String) : [];

  // Normalize zoom
  normalized.zoom = (typeof data.zoom === 'number' && !isNaN(data.zoom)) ? data.zoom : 1;

  // Normalize selected page ID
  normalized.selectedPageId = data.selectedPageId ? String(data.selectedPageId) : undefined;

  // Normalize footer pages
  if (Array.isArray(data.footerPages)) {
    normalized.footerPages = data.footerPages.map((page: any) => ({
      id: String(page.id || 'footer-page-' + Math.random().toString(36).substr(2, 9)),
      name: String(page.name || 'Untitled Footer Page'),
      iconKey: String(page.iconKey || 'file'),
      color: String(page.color || 'bg-gray-500'),
      x: Number(page.x) || 0,
      y: Number(page.y) || 0,
      children: [],
      parent: undefined,
      pageType: page.pageType ? String(page.pageType) : undefined,
      description: page.description ? String(page.description) : undefined,
      url: page.url ? String(page.url) : undefined,
      published: page.published !== undefined ? Boolean(page.published) : undefined,
      visualLevel: page.visualLevel !== undefined ? Number(page.visualLevel) : undefined, // ADDED: Include visualLevel in normalization
    }));
  } else {
    normalized.footerPages = [];
  }

  return normalized;
};

// Helper to deserialize sitemap from storage
const deserializeSitemap = (serialized: SerializableSitemap, globalPageTypes: PageType[]): Sitemap => {
  return {
    id: serialized.id,
    name: serialized.name,
    description: serialized.description,
    createdAt: new Date(serialized.createdAt),
    updatedAt: new Date(serialized.updatedAt),
    pages: (serialized.pages || []).map(deserializePage),
    pageTypes: globalPageTypes,
    rootPageOrder: serialized.rootPageOrder || [],
    collapsedGroups: serialized.collapsedGroups || [],
    zoom: serialized.zoom || 1,
    selectedPageId: serialized.selectedPageId,
    shareUrl: serialized.shareUrl, // ADDED: Include shareUrl in deserialization
    footerPages: serialized.footerPages ? serialized.footerPages.map(deserializePage) : [], // ADDED: Include footerPages in deserialization
    isArchived: serialized.isArchived ? Boolean(serialized.isArchived) : false, // ADDED: Include archive status
    currentVersion: serialized.currentVersion ? String(serialized.currentVersion) : undefined, // ADDED: Include current version
    versions: serialized.versions ? serialized.versions.map(version => ({
      versionNumber: version.versionNumber,
      createdAt: version.createdAt,
      createdBy: version.createdBy,
      pages: version.pages.map(deserializePage),
      pageTypes: version.pageTypes.map(deserializePageType),
      rootPageOrder: version.rootPageOrder || [],
      collapsedGroups: version.collapsedGroups || [],
      zoom: version.zoom || 1,
      footerPages: version.footerPages ? version.footerPages.map(deserializePage) : undefined,
      description: version.description,
    })) : undefined, // ADDED: Include versions
  };
};

// Generate unique IDs
let idCounter = 0;
export const generateUniqueId = (prefix: string = 'id'): string => {
  idCounter++;
  const timestamp = Date.now();
  const random1 = Math.random().toString(36).substr(2, 9);
  const random2 = Math.random().toString(36).substr(2, 9);
  return `${prefix}_${timestamp}_${idCounter}_${random1}_${random2}`;
};

// Create default page types
const createDefaultPageTypes = (): PageType[] => {
  return [
    {
      id: 'home',
      name: 'Home Page',
      icon: createIconComponent('home'),
      color: 'bg-blue-500',
      description: 'The main landing page of your website.',
      iconKey: 'home',
    },
    {
      id: 'content',
      name: 'Content Page',
      icon: createIconComponent('file'),
      color: 'bg-green-500',
      description: 'A general content page with text and media.',
      iconKey: 'file',
    },
    {
      id: 'contact',
      name: 'Contact',
      icon: createIconComponent('mail'),
      color: 'bg-orange-500',
      description: 'Contact information and forms.',
      iconKey: 'mail',
    },
    {
      id: 'about',
      name: 'About',
      icon: createIconComponent('info'),
      color: 'bg-purple-500',
      description: 'Information about your organization.',
      iconKey: 'info',
    },
    {
      id: 'product',
      name: 'Product',
      icon: createIconComponent('shopping'),
      color: 'bg-red-500',
      description: 'Product showcase pages.',
      iconKey: 'shopping',
    },
  ];
};

// Cache for cloud data
let cachedSitemaps: Sitemap[] | null = null;
let cachedPageTypes: PageType[] | null = null;
let cacheTimestamp: number = 0;
let pageTypesTimestamp: number = 0;
const CACHE_DURATION = 30000; // 30 seconds

// Share URL creation lock to prevent concurrent requests
let shareUrlCreationLocks: { [sitemapId: string]: Promise<string> } = {};

// Helper to check if cache is valid
const isCacheValid = (): boolean => {
  return cachedSitemaps !== null && (Date.now() - cacheTimestamp) < CACHE_DURATION;
};

const isPageTypesCacheValid = (): boolean => {
  return cachedPageTypes !== null && (Date.now() - pageTypesTimestamp) < CACHE_DURATION;
};

// Helper to update cache
const updateCache = (sitemaps: Sitemap[]): void => {
  cachedSitemaps = sitemaps;
  cacheTimestamp = Date.now();
};

const updatePageTypesCache = (pageTypes: PageType[]): void => {
  cachedPageTypes = pageTypes;
  pageTypesTimestamp = Date.now();
};

// Clear cache
const clearCache = (): void => {
  cachedSitemaps = null;
  cachedPageTypes = null;
  cacheTimestamp = 0;
  pageTypesTimestamp = 0;
};

// Create sample sitemap
const createSampleSitemap = (globalPageTypes: PageType[]): Sitemap => {
  const now = new Date();
  
  const homeId = generateUniqueId('page');
  const aboutId = generateUniqueId('page');
  const productsId = generateUniqueId('page');
  const contactId = generateUniqueId('page');

  const createPage = (id: string, name: string, iconKey: string, color: string, x: number, y: number, pageType: string, parent?: string, children: string[] = []): SitePage => {
    const page = {
      id,
      name,
      icon: createIconComponent(iconKey),
      color,
      x,
      y,
      children,
      pageType,
      parent,
    } as SitePage & { iconKey: string };
    
    (page as any).iconKey = iconKey;
    return page;
  };

  const samplePages: SitePage[] = [
    createPage(homeId, 'Home', 'home', 'bg-blue-500', 856, 150, 'home', undefined, [aboutId, productsId, contactId]),
    createPage(aboutId, 'About Us', 'info', 'bg-purple-500', 200, 390, 'about', homeId),
    createPage(productsId, 'Products', 'shopping', 'bg-red-500', 856, 390, 'product', homeId),
    createPage(contactId, 'Contact', 'mail', 'bg-orange-500', 1512, 390, 'contact', homeId),
  ];

  return {
    id: generateUniqueId('sitemap'),
    name: 'Sample Website Sitemap',
    description: 'A sample sitemap to help you get started.',
    createdAt: now,
    updatedAt: now,
    pages: samplePages,
    pageTypes: globalPageTypes,
    rootPageOrder: [homeId],
    collapsedGroups: [],
    zoom: 1,
    footerPages: [], // ADDED: Initialize empty footer pages
  };
};

// Create default home page
const createDefaultHomePage = (): SitePage => {
  const id = generateUniqueId('page');
  const page = {
    id,
    name: 'Home',
    icon: createIconComponent('home'),
    color: 'bg-blue-500',
    x: 856,
    y: 150,
    children: [],
    pageType: 'home',
  } as SitePage & { iconKey: string };
  
  (page as any).iconKey = 'home';
  return page;
};

// Initialize default page types if none exist
const initializeDefaultPageTypes = async (): Promise<void> => {
  try {
    const existingPageTypes = await pageTypeStorage.getPageTypes();
    
    if (existingPageTypes.length === 0) {
      const defaultPageTypes = createDefaultPageTypes();
      await pageTypeStorage.savePageTypes(defaultPageTypes);
    }
  } catch (error) {
    console.error("Failed to initialize default page types:", error);
    throw new Error("Could not initialize page types - cloud storage required");
  }
};

// Page Type Storage utilities - CLOUD ONLY
export const pageTypeStorage = {
  // Get all global page types
  async getPageTypes(): Promise<PageType[]> {
    try {
      if (isPageTypesCacheValid()) {
        return cachedPageTypes!;
      }

      const serializedPageTypes = await loadCloudPageTypes();
      const pageTypes = serializedPageTypes.map(deserializePageType);
      
      if (pageTypes.length === 0) {
        const defaultPageTypes = createDefaultPageTypes();
        await this.savePageTypes(defaultPageTypes);
        updatePageTypesCache(defaultPageTypes);
        return defaultPageTypes;
      }
      
      updatePageTypesCache(pageTypes);
      return pageTypes;
    } catch (error) {
      console.error("Failed to load page types:", error);
      throw new Error("Could not load page types - cloud storage required");
    }
  },

  // Save all page types
  async savePageTypes(pageTypes: PageType[]): Promise<void> {
    try {
      const serializedPageTypes = pageTypes.map(serializePageType);
      await saveCloudPageTypes(serializedPageTypes);
      updatePageTypesCache(pageTypes);
    } catch (error) {
      console.error("Failed to save page types:", error);
      throw new Error("Could not save page types - cloud storage required");
    }
  },

  // Add a new page type
  async addPageType(pageType: PageType): Promise<void> {
    try {
      const currentPageTypes = await this.getPageTypes();
      
      const existingPageType = currentPageTypes.find(pt => pt.id === pageType.id);
      if (existingPageType) {
        throw new Error('Page type already exists');
      }
      
      const updatedPageTypes = [...currentPageTypes, pageType];
      await this.savePageTypes(updatedPageTypes);
    } catch (error) {
      console.error("Failed to add page type:", error);
      throw error;
    }
  },

  // Update an existing page type
  async updatePageType(pageTypeId: string, updates: Partial<PageType>): Promise<void> {
    try {
      const currentPageTypes = await this.getPageTypes();
      
      const existingIndex = currentPageTypes.findIndex(pt => pt.id === pageTypeId);
      if (existingIndex === -1) {
        throw new Error('Page type not found');
      }
      
      const updatedPageTypes = [...currentPageTypes];
      updatedPageTypes[existingIndex] = { ...updatedPageTypes[existingIndex], ...updates };
      
      await this.savePageTypes(updatedPageTypes);
    } catch (error) {
      console.error("Failed to update page type:", error);
      throw error;
    }
  },

  // Delete a page type
  async deletePageType(pageTypeId: string): Promise<void> {
    try {
      const currentPageTypes = await this.getPageTypes();
      
      const filteredPageTypes = currentPageTypes.filter(pt => pt.id !== pageTypeId);
      
      if (filteredPageTypes.length === currentPageTypes.length) {
        throw new Error('Page type not found');
      }
      
      await this.savePageTypes(filteredPageTypes);
    } catch (error) {
      console.error("Failed to delete page type:", error);
      throw error;
    }
  },

  // Clear cache
  clearCache(): void {
    cachedPageTypes = null;
    pageTypesTimestamp = 0;
  },
};

// Storage utilities - CLOUD ONLY
export const storage = {
  // Clear cache
  clearCache(): void {
    clearCache();
  },

  // Initialize sample data if no data exists
  async initializeSampleData(): Promise<void> {
    try {
      await initializeDefaultPageTypes();
      
      const existingSitemaps = await this.getSitemaps();
      if (existingSitemaps.length === 0) {
        const globalPageTypes = await pageTypeStorage.getPageTypes();
        const sampleSitemap = createSampleSitemap(globalPageTypes);
        await this.saveSitemap(sampleSitemap);
      }
    } catch (error) {
      console.error("Failed to initialize sample data:", error);
      throw new Error("Could not initialize sample data - cloud storage required");
    }
  },

  // Get all sitemaps from cloud storage
  async getSitemaps(): Promise<Sitemap[]> {
    try {
      if (isCacheValid()) {
        return cachedSitemaps!;
      }

      const globalPageTypes = await pageTypeStorage.getPageTypes();
      const serializedSitemaps = await loadCloudSitemaps();
      const sitemaps = serializedSitemaps.map(serialized => deserializeSitemap(serialized, globalPageTypes));
      
      updateCache(sitemaps);
      return sitemaps;
    } catch (error) {
      console.error("Failed to load sitemaps:", error);
      throw new Error("Could not load sitemaps - cloud storage required");
    }
  },

  // Get specific sitemap
  async getSitemap(id: string): Promise<Sitemap | null> {
    try {
      const sitemaps = await this.getSitemaps();
      return sitemaps.find(sitemap => sitemap.id === id) || null;
    } catch (error) {
      console.error("Failed to get sitemap:", error);
      throw error;
    }
  },

  // Save sitemap to cloud storage (single upsert — no read-all/write-all)
  async saveSitemap(sitemap: Sitemap): Promise<void> {
    try {
      const updatedSitemap = {
        ...sitemap,
        updatedAt: new Date()
      };

      const serialized = serializeSitemap(updatedSitemap);
      await saveCloudSitemapDirect(serialized);
      
      // Update cache
      if (cachedSitemaps) {
        const idx = cachedSitemaps.findIndex(s => s.id === sitemap.id);
        if (idx >= 0) {
          cachedSitemaps[idx] = updatedSitemap;
        } else {
          cachedSitemaps.push(updatedSitemap);
        }
        cacheTimestamp = Date.now();
      }
    } catch (error) {
      console.error("Failed to save sitemap:", error);
      throw new Error("Could not save sitemap - cloud storage required");
    }
  },

  // Archive sitemap
  async archiveSitemap(id: string): Promise<void> {
    try {
      const sitemap = await this.getSitemap(id);
      if (!sitemap) throw new Error("Sitemap not found");
      
      const updated = { ...sitemap, isArchived: true, updatedAt: new Date() };
      await this.saveSitemap(updated);
    } catch (error) {
      console.error("Failed to archive sitemap:", error);
      throw new Error("Could not archive sitemap - cloud storage required");
    }
  },

  // Restore sitemap from archive
  async restoreSitemap(id: string): Promise<void> {
    try {
      const sitemap = await this.getSitemap(id);
      if (!sitemap) throw new Error("Sitemap not found");
      
      const updated = { ...sitemap, isArchived: false, updatedAt: new Date() };
      await this.saveSitemap(updated);
    } catch (error) {
      console.error("Failed to restore sitemap:", error);
      throw new Error("Could not restore sitemap - cloud storage required");
    }
  },

  // Delete sitemap permanently
  async deleteSitemap(id: string): Promise<void> {
    try {
      await deleteCloudSitemap(id);
      
      // Update cache
      if (cachedSitemaps) {
        cachedSitemaps = cachedSitemaps.filter(s => s.id !== id);
        cacheTimestamp = Date.now();
      }
    } catch (error) {
      console.error("Failed to delete sitemap:", error);
      throw new Error("Could not delete sitemap - cloud storage required");
    }
  },

  // Create new sitemap
  async createSitemap(name: string, description?: string): Promise<Sitemap> {
    try {
      const id = generateUniqueId('sitemap');
      const now = new Date();
      const homePage = createDefaultHomePage();
      const globalPageTypes = await pageTypeStorage.getPageTypes();

      const newSitemap: Sitemap = {
        id,
        name,
        description,
        createdAt: now,
        updatedAt: now,
        pages: [homePage],
        pageTypes: globalPageTypes,
        rootPageOrder: [homePage.id],
        collapsedGroups: [],
        zoom: 1,
        selectedPageId: homePage.id,
        footerPages: [], // ADDED: Initialize empty footer pages
      };

      await this.saveSitemap(newSitemap);
      return newSitemap;
    } catch (error) {
      console.error("Failed to create sitemap:", error);
      throw new Error("Could not create sitemap - cloud storage required");
    }
  },

  // Settings management (uses localStorage for user preferences only)
  getSettings(): SitemapSettings {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      return {};
    }
  },

  saveSettings(settings: SitemapSettings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      // Ignore localStorage errors for settings
    }
  },

  // Export sitemap
  async exportSitemap(id: string): Promise<string> {
    const sitemap = await this.getSitemap(id);
    if (!sitemap) throw new Error('Sitemap not found');
    
    const exportData = serializeSitemap(sitemap);
    return JSON.stringify(exportData, null, 2);
  },

  // Import sitemap with proper validation and error handling
  async importSitemap(data: string): Promise<Sitemap> {
    try {
      // Parse the JSON data
      let parsedData: any;
      try {
        parsedData = JSON.parse(data);
      } catch (parseError) {
        throw new Error("Invalid JSON format - please check the file format");
      }

      // Handle export format wrapper (from export-service.ts)
      if (parsedData.format === 'venn-sitemap-v1' && parsedData.sitemap) {
        console.log("Detected export format wrapper, extracting sitemap data");
        parsedData = parsedData.sitemap;
      }

      // Validate the structure
      if (!validateImportData(parsedData)) {
        console.warn("Import data validation failed, attempting to normalize:", parsedData);
        
        // Try to normalize the data
        try {
          parsedData = normalizeImportData(parsedData);
        } catch (normalizeError) {
          throw new Error("Invalid sitemap file format - missing required fields or incorrect structure");
        }
      }

      // Load global page types
      const globalPageTypes = await pageTypeStorage.getPageTypes();
      
      // Create the new sitemap with a unique ID
      const newSitemap: Sitemap = {
        ...deserializeSitemap(parsedData, globalPageTypes),
        id: generateUniqueId('sitemap'),
        name: `${parsedData.name} (Imported)`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Save to cloud storage
      await this.saveSitemap(newSitemap);
      return newSitemap;
    } catch (error) {
      console.error("Failed to import sitemap:", error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes("JSON")) {
          throw new Error("The file is not a valid JSON format. Please export a sitemap from this application and try again.");
        } else if (error.message.includes("Invalid sitemap")) {
          throw new Error("The file does not contain a valid sitemap structure. Please ensure you're importing a file exported from this application.");
        } else if (error.message.includes("cloud storage")) {
          throw new Error("Could not save imported sitemap - cloud storage is currently unavailable.");
        }
      }
      
      throw new Error("Failed to import sitemap - please check the file format and try again");
    }
  },

  // Get or create share URL for a sitemap - WITH CONCURRENT CALL PROTECTION
  async getOrCreateShareUrl(sitemapId: string): Promise<string> {
    try {
      console.log('🔗 Getting share URL for sitemap:', sitemapId);
      
      // Check if there's already a request in progress for this sitemap
      if (shareUrlCreationLocks[sitemapId]) {
        console.log('⏳ Share URL creation already in progress for sitemap:', sitemapId, '- waiting...');
        return await shareUrlCreationLocks[sitemapId];
      }
      
      // Get the current sitemap first
      const sitemap = await this.getSitemap(sitemapId);
      if (!sitemap) {
        throw new Error('Sitemap not found');
      }
      
      // Check if the sitemap already has a stored share URL
      if (sitemap.shareUrl) {
        console.log('✅ Found existing share URL for sitemap:', sitemapId);
        return sitemap.shareUrl;
      }
      
      // No existing share URL, create a new one (with lock to prevent concurrent calls)
      console.log('📝 Creating new share URL for sitemap:', sitemapId);
      
      const createUrlPromise = (async () => {
        try {
          const shareUrl = await createShortUrl(sitemap);
          
          // Update the sitemap with the new share URL and save it
          const updatedSitemap = { ...sitemap, shareUrl };
          await this.saveSitemap(updatedSitemap);
          
          console.log('💾 Stored share URL permanently for sitemap:', sitemapId, '- URL length:', shareUrl.length);
          
          return shareUrl;
        } finally {
          // Clean up the lock when done
          delete shareUrlCreationLocks[sitemapId];
        }
      })();
      
      // Store the promise to prevent concurrent calls
      shareUrlCreationLocks[sitemapId] = createUrlPromise;
      
      return await createUrlPromise;
      
    } catch (error) {
      // Clean up the lock on error
      delete shareUrlCreationLocks[sitemapId];
      console.error('❌ Error getting/creating share URL:', error);
      throw error;
    }
  }
};

// URL utilities
export const urls = {
  edit(sitemapId: string): string {
    return `${window.location.origin}/#/edit/${sitemapId}`;
  },

  view(sitemapId: string): string {
    return `${window.location.origin}/#/view/${sitemapId}`;
  }
};

// Initialize storage on load - CLOUD REQUIRED
if (typeof window !== 'undefined') {
  // Test cloud connection and initialize
  testCloudConnection().then(async (isConnected) => {
    if (!isConnected) {
      console.error("Cloud storage not available - app requires cloud connectivity");
      return;
    }
    
    try {
      await initializeDefaultPageTypes();
      await storage.initializeSampleData();
    } catch (error) {
      console.error("Storage initialization failed:", error);
    }
  }).catch((error) => {
    console.error("Cloud connection test failed:", error);
  });
  
  // Expose debug functions (dev only)
  if (import.meta.env.DEV) {
    (window as any).clearSitemapCache = storage.clearCache;
    (window as any).clearPageTypesCache = pageTypeStorage.clearCache;
    (window as any).pageTypeStorage = pageTypeStorage;
  }
}
