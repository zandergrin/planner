// Cloud storage system for shared sitemap access
// NO LOCALHOST FALLBACKS - Cloud storage is required for the app to function

import {
  Sitemap,
  SerializableSitemap,
  SerializablePageType,
} from "./storage";

// Storage configuration
// In dev mode, use Vite proxy to avoid CORS issues with JSONBin
const API_BASE = import.meta.env.DEV ? "/api-jsonbin" : "https://api.jsonbin.io/v3";
const CLOUD_STORAGE_CONFIG = {
  API_BASE,
  API_KEY: import.meta.env.VITE_JSONBIN_API_KEY || "",
  SITEMAPS_BIN_ID: "684a23f18960c979a5a84afc",
  SHORT_URLS_BIN_ID: "684a24198561e97a5022add1",
  PAGE_TYPES_BIN_ID: "684a9a2e8a456b7966acc070",
  COMMENTS_BIN_ID: "693ac4ce43b1c97be9e6e4c6", // New bin for comments
  ORG_ID: "784812546842757295",
  ENABLE_CLOUD_STORAGE: true,
};

// Data structure for cloud storage
interface CloudSitemaps {
  version: string;
  organizationId: string;
  sitemaps: SerializableSitemap[];
  lastUpdated: string;
}

interface ShortUrlMapping {
  shortId: string;
  sitemapData: any;
  createdAt: string;
  organizationId: string;
}

interface CloudShortUrls {
  version: string;
  organizationId: string;
  mappings: ShortUrlMapping[];
  lastUpdated: string;
}

interface CloudPageTypes {
  version: string;
  organizationId: string;
  pageTypes: SerializablePageType[];
  lastUpdated: string;
}

// Comment-related interfaces
export interface Comment {
  id: string;
  sitemapId: string;
  pageId: string;
  commenterEmail: string;
  commenterName: string;
  content: string;
  timestamp: string;
  resolved: boolean;
}

export interface CommentSettings {
  commentsEnabled: boolean;
  allowedDomain: string;
}

interface CloudComments {
  version: string;
  organizationId: string;
  comments: Comment[];
  settings: { [sitemapId: string]: CommentSettings };
  lastUpdated: string;
}

// Check if cloud storage is properly configured
function isCloudStorageConfigured(): boolean {
  return (
    CLOUD_STORAGE_CONFIG.ENABLE_CLOUD_STORAGE &&
    CLOUD_STORAGE_CONFIG.API_KEY !==
      "REPLACE_WITH_YOUR_JSONBIN_API_KEY" &&
    CLOUD_STORAGE_CONFIG.SITEMAPS_BIN_ID !==
      "REPLACE_WITH_YOUR_SITEMAPS_BIN_ID" &&
    CLOUD_STORAGE_CONFIG.SHORT_URLS_BIN_ID !==
      "REPLACE_WITH_YOUR_SHORT_URLS_BIN_ID" &&
    CLOUD_STORAGE_CONFIG.PAGE_TYPES_BIN_ID !==
      "REPLACE_WITH_YOUR_PAGE_TYPES_BIN_ID" &&
    CLOUD_STORAGE_CONFIG.COMMENTS_BIN_ID !==
      "REPLACE_WITH_YOUR_COMMENTS_BIN_ID" && // New check for comments bin
    CLOUD_STORAGE_CONFIG.API_KEY.trim().length > 10 &&
    CLOUD_STORAGE_CONFIG.SITEMAPS_BIN_ID.trim().length > 10 &&
    CLOUD_STORAGE_CONFIG.SHORT_URLS_BIN_ID.trim().length > 10 &&
    CLOUD_STORAGE_CONFIG.PAGE_TYPES_BIN_ID.trim().length > 10 &&
    CLOUD_STORAGE_CONFIG.COMMENTS_BIN_ID.trim().length > 10 // New check for comments bin
  );
}

// Helper to make API requests to JSONBin
async function makeJsonBinRequest(
  method: "GET" | "PUT" | "POST",
  endpoint: string,
  data?: any,
): Promise<any> {
  if (!isCloudStorageConfigured()) {
    return;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Master-Key": CLOUD_STORAGE_CONFIG.API_KEY,
  };

  if (method === "PUT") {
    headers["X-Bin-Versioning"] = "false";
  }

  const config: RequestInit = {
    method,
    headers,
  };

  if (data) {
    config.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(endpoint, config);

    if (!response.ok) {
      const errorText = await response
        .text()
        .catch(() => "Unknown error");
      throw new Error(
        `Cloud storage request failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const result = await response.json();
    return result;
  } catch (error) {
    throw error;
  }
}

// Load all sitemaps from cloud storage
export async function loadCloudSitemaps(): Promise<
  SerializableSitemap[]
> {
  const endpoint = `${CLOUD_STORAGE_CONFIG.API_BASE}/b/${CLOUD_STORAGE_CONFIG.SITEMAPS_BIN_ID}/latest`;
  const response = await makeJsonBinRequest("GET", endpoint);

  const cloudData: CloudSitemaps = response?.record;

  if (!cloudData) {
    return [];
  }

  // Verify organization ID matches
  if (
    cloudData.organizationId !== CLOUD_STORAGE_CONFIG.ORG_ID
  ) {
    throw new Error(
      "Organization ID mismatch - unauthorized access",
    );
  }

  return cloudData.sitemaps || [];
}

// Save all sitemaps to cloud storage
export async function saveCloudSitemaps(
  sitemaps: SerializableSitemap[],
): Promise<void> {
  const cloudData: CloudSitemaps = {
    version: "1.0",
    organizationId: CLOUD_STORAGE_CONFIG.ORG_ID,
    sitemaps: sitemaps || [],
    lastUpdated: new Date().toISOString(),
  };

  const endpoint = `${CLOUD_STORAGE_CONFIG.API_BASE}/b/${CLOUD_STORAGE_CONFIG.SITEMAPS_BIN_ID}`;
  await makeJsonBinRequest("PUT", endpoint, cloudData);
}

// Load global page types from cloud storage
export async function loadCloudPageTypes(): Promise<
  SerializablePageType[]
> {
  const endpoint = `${CLOUD_STORAGE_CONFIG.API_BASE}/b/${CLOUD_STORAGE_CONFIG.PAGE_TYPES_BIN_ID}/latest`;

  try {
    const response = await makeJsonBinRequest("GET", endpoint);
    const cloudData: CloudPageTypes = response?.record;

    if (!cloudData) {
      return [];
    }

    // Verify organization ID matches
    if (
      cloudData.organizationId !== CLOUD_STORAGE_CONFIG.ORG_ID
    ) {
      throw new Error(
        "Organization ID mismatch - unauthorized access",
      );
    }

    return cloudData.pageTypes || [];
  } catch (error) {
    // If it's a 404 error (bin doesn't exist yet), return empty array
    if ((error as any)?.message?.includes("404")) {
      return [];
    }
    throw error;
  }
}

// Save global page types to cloud storage
export async function saveCloudPageTypes(
  pageTypes: SerializablePageType[],
): Promise<void> {
  const cloudData: CloudPageTypes = {
    version: "1.0",
    organizationId: CLOUD_STORAGE_CONFIG.ORG_ID,
    pageTypes: pageTypes || [],
    lastUpdated: new Date().toISOString(),
  };

  const endpoint = `${CLOUD_STORAGE_CONFIG.API_BASE}/b/${CLOUD_STORAGE_CONFIG.PAGE_TYPES_BIN_ID}`;
  await makeJsonBinRequest("PUT", endpoint, cloudData);
}

// Store short URL mapping in cloud
export async function storeShortUrlMapping(
  shortId: string,
  sitemapData: any,
): Promise<void> {
  // First, load existing mappings
  let existingMappings: ShortUrlMapping[] = [];
  try {
    const endpoint = `${CLOUD_STORAGE_CONFIG.API_BASE}/b/${CLOUD_STORAGE_CONFIG.SHORT_URLS_BIN_ID}/latest`;
    const response = await makeJsonBinRequest("GET", endpoint);
    const cloudData: CloudShortUrls = response?.record;

    if (
      cloudData &&
      cloudData.organizationId === CLOUD_STORAGE_CONFIG.ORG_ID
    ) {
      existingMappings = cloudData.mappings || [];
    }
  } catch (loadError) {
    // If bin doesn't exist, we'll create it
  }

  // Add new mapping
  const newMapping: ShortUrlMapping = {
    shortId,
    sitemapData,
    createdAt: new Date().toISOString(),
    organizationId: CLOUD_STORAGE_CONFIG.ORG_ID,
  };

  // Remove any existing mapping with the same shortId
  const filteredMappings = existingMappings.filter(
    (m) => m.shortId !== shortId,
  );
  filteredMappings.push(newMapping);

  // Save updated mappings
  const cloudData: CloudShortUrls = {
    version: "1.0",
    organizationId: CLOUD_STORAGE_CONFIG.ORG_ID,
    mappings: filteredMappings,
    lastUpdated: new Date().toISOString(),
  };

  const endpoint = `${CLOUD_STORAGE_CONFIG.API_BASE}/b/${CLOUD_STORAGE_CONFIG.SHORT_URLS_BIN_ID}`;
  await makeJsonBinRequest("PUT", endpoint, cloudData);
}

// Retrieve short URL mapping from cloud
export async function retrieveShortUrlMapping(
  shortId: string,
): Promise<any | null> {
  const endpoint = `${CLOUD_STORAGE_CONFIG.API_BASE}/b/${CLOUD_STORAGE_CONFIG.SHORT_URLS_BIN_ID}/latest`;
  const response = await makeJsonBinRequest("GET", endpoint);
  const cloudData: CloudShortUrls = response?.record;

  if (!cloudData) {
    return null;
  }

  // Verify organization ID
  if (
    cloudData.organizationId !== CLOUD_STORAGE_CONFIG.ORG_ID
  ) {
    throw new Error(
      "Organization ID mismatch - unauthorized access",
    );
  }

  // Find the mapping
  const mappings = cloudData.mappings || [];
  const mapping = mappings.find((m) => m.shortId === shortId);

  return mapping ? mapping.sitemapData : null;
}

// Test cloud connectivity
export async function testCloudConnection(): Promise<boolean> {
  try {
    if (!isCloudStorageConfigured()) {
      return false;
    }

    const endpoint = `${CLOUD_STORAGE_CONFIG.API_BASE}/b/${CLOUD_STORAGE_CONFIG.SITEMAPS_BIN_ID}/latest`;
    await makeJsonBinRequest("GET", endpoint);
    return true;
  } catch (error) {
    return false;
  }
}

// Comment storage functions
async function loadCloudCommentsData(): Promise<CloudComments> {
  const endpoint = `${CLOUD_STORAGE_CONFIG.API_BASE}/b/${CLOUD_STORAGE_CONFIG.COMMENTS_BIN_ID}/latest`;

  try {
    const response = await makeJsonBinRequest("GET", endpoint);
    const cloudData: CloudComments = response?.record;

    if (!cloudData) {
      return {
        version: "1.0",
        organizationId: CLOUD_STORAGE_CONFIG.ORG_ID,
        comments: [],
        settings: {},
        lastUpdated: new Date().toISOString(),
      };
    }

    // Verify organization ID matches
    if (
      cloudData.organizationId !== CLOUD_STORAGE_CONFIG.ORG_ID
    ) {
      throw new Error(
        "Organization ID mismatch - unauthorized access",
      );
    }

    return cloudData;
  } catch (error) {
    // If it's a 404 error, fetch error, or bin doesn't exist yet, return empty structure
    if (
      (error as any)?.message?.includes("404") ||
      (error as any)?.message?.includes("Failed to fetch") ||
      error instanceof TypeError
    ) {
      // Return empty structure - bin will be created on first write
      return {
        version: "1.0",
        organizationId: CLOUD_STORAGE_CONFIG.ORG_ID,
        comments: [],
        settings: {},
        lastUpdated: new Date().toISOString(),
      };
    }
    throw error;
  }
}

async function saveCloudCommentsData(
  data: CloudComments,
): Promise<void> {
  const cloudData: CloudComments = {
    ...data,
    lastUpdated: new Date().toISOString(),
  };

  const endpoint = `${CLOUD_STORAGE_CONFIG.API_BASE}/b/${CLOUD_STORAGE_CONFIG.COMMENTS_BIN_ID}`;
  await makeJsonBinRequest("PUT", endpoint, cloudData);
}

export async function createComment(
  sitemapId: string,
  pageId: string,
  commenterEmail: string,
  commenterName: string,
  content: string,
  allowedDomain: string = "",
): Promise<Comment> {
  // Validate required fields
  if (
    !sitemapId ||
    !pageId ||
    !commenterEmail ||
    !commenterName ||
    !content
  ) {
    throw new Error("Missing required fields");
  }

  // Validate email domain if allowedDomain is specified
  if (allowedDomain && allowedDomain.trim() !== "") {
    const emailDomain = commenterEmail
      .split("@")[1]
      ?.toLowerCase();
    const allowed = allowedDomain.toLowerCase().trim();

    if (!emailDomain || emailDomain !== allowed) {
      throw new Error(
        `Email must be from domain: ${allowedDomain}`,
      );
    }
  }

  const commentsData = await loadCloudCommentsData();

  const newComment: Comment = {
    id: crypto.randomUUID(),
    sitemapId,
    pageId,
    commenterEmail,
    commenterName,
    content,
    timestamp: new Date().toISOString(),
    resolved: false,
  };

  commentsData.comments.push(newComment);
  await saveCloudCommentsData(commentsData);

  return newComment;
}

export async function getComments(
  sitemapId: string,
  pageId: string,
): Promise<Comment[]> {
  try {
    const commentsData = await loadCloudCommentsData();

    const filtered = commentsData.comments.filter(
      (c) => c.sitemapId === sitemapId && c.pageId === pageId,
    );

    // Sort by timestamp (newest first)
    return filtered.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() -
        new Date(a.timestamp).getTime(),
    );
  } catch (error) {
    return []; // Return empty array on error instead of throwing
  }
}

// Get all comments for a sitemap (more efficient for loading all comments at once)
export async function getAllCommentsForSitemap(
  sitemapId: string,
): Promise<Comment[]> {
  try {
    const commentsData = await loadCloudCommentsData();

    const filtered = commentsData.comments.filter(
      (c) => c.sitemapId === sitemapId,
    );

    // Sort by timestamp (newest first)
    return filtered.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() -
        new Date(a.timestamp).getTime(),
    );
  } catch (error) {
    return []; // Return empty array on error instead of throwing
  }
}

export async function resolveComment(
  commentId: string,
  resolved: boolean,
): Promise<Comment> {
  const commentsData = await loadCloudCommentsData();

  const comment = commentsData.comments.find(
    (c) => c.id === commentId,
  );
  if (!comment) {
    throw new Error("Comment not found");
  }

  comment.resolved = resolved;
  await saveCloudCommentsData(commentsData);

  return comment;
}

export async function deleteComment(
  commentId: string,
): Promise<void> {
  const commentsData = await loadCloudCommentsData();

  const index = commentsData.comments.findIndex(
    (c) => c.id === commentId,
  );
  if (index === -1) {
    throw new Error("Comment not found");
  }

  commentsData.comments.splice(index, 1);
  await saveCloudCommentsData(commentsData);
}

export async function getCommentSettings(
  sitemapId: string,
): Promise<CommentSettings> {
  console.log('Getting comment settings for sitemap:', sitemapId);
  const commentsData = await loadCloudCommentsData();
  
  const settings = commentsData.settings[sitemapId] || {
    commentsEnabled: false,
    allowedDomain: "",
  };
  
  return settings;
}

export async function updateCommentSettings(
  sitemapId: string,
  settings: CommentSettings,
): Promise<CommentSettings> {
  const commentsData = await loadCloudCommentsData();

  commentsData.settings[sitemapId] = {
    commentsEnabled: Boolean(settings.commentsEnabled),
    allowedDomain: settings.allowedDomain || "",
  };

  await saveCloudCommentsData(commentsData);

  return commentsData.settings[sitemapId];
}

// Debug functions
export const cloudStorageDebug = {
  async listAllSitemaps() {
    try {
      const sitemaps = await loadCloudSitemaps();
      return sitemaps;
    } catch (error) {
      console.error("Failed to list sitemaps:", error);
      throw error;
    }
  },

  async listAllPageTypes() {
    try {
      const pageTypes = await loadCloudPageTypes();
      return pageTypes;
    } catch (error) {
      console.error("Failed to list page types:", error);
      throw error;
    }
  },

  async testConnection() {
    return await testCloudConnection();
  },

  getConfig() {
    return {
      ...CLOUD_STORAGE_CONFIG,
      API_KEY:
        CLOUD_STORAGE_CONFIG.API_KEY.length > 10
          ? "***CONFIGURED***"
          : "NOT_CONFIGURED",
    };
  },

  isConfigured() {
    return isCloudStorageConfigured();
  },

  async diagnose() {
    console.log("=== CLOUD STORAGE DIAGNOSTIC ===");
    console.log("Configuration:", {
      enabled: CLOUD_STORAGE_CONFIG.ENABLE_CLOUD_STORAGE,
      apiKeyConfigured:
        CLOUD_STORAGE_CONFIG.API_KEY.length > 10,
      binsConfigured: {
        sitemaps:
          CLOUD_STORAGE_CONFIG.SITEMAPS_BIN_ID.length > 10,
        shortUrls:
          CLOUD_STORAGE_CONFIG.SHORT_URLS_BIN_ID.length > 10,
        pageTypes:
          CLOUD_STORAGE_CONFIG.PAGE_TYPES_BIN_ID.length > 10,
        comments:
          CLOUD_STORAGE_CONFIG.COMMENTS_BIN_ID.length > 10, // New check for comments bin
      },
    });

    const connectionResult = await testCloudConnection();
    console.log(
      "Connection test:",
      connectionResult ? "SUCCESS" : "FAILED",
    );

    return {
      configured: isCloudStorageConfigured(),
      online: navigator.onLine,
      cloudConnection: connectionResult,
    };
  },
};

// Make debug functions available globally (dev only)
if (typeof window !== "undefined" && import.meta.env.DEV) {
  (window as any).vennCloudDebug = cloudStorageDebug;
}
