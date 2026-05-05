# Cloud Storage Setup Guide

This guide will help you set up JSONBin.io cloud storage for your sitemap tool.

## Step 1: JSONBin.io Account Setup

1. Go to [jsonbin.io](https://jsonbin.io)
2. Sign up for a free account
3. Navigate to **API Keys** section
4. Create a new API key and copy it

## Step 2: Create Required Bins

You need to create **four bins** with the following initial JSON data:

### Bin 1: Sitemaps Storage
**Name:** `Venn Creative Sitemaps`
**Initial JSON:**
```json
{
  "version": "1.0",
  "organizationId": "784812546842757295",
  "sitemaps": [],
  "lastUpdated": "2024-12-19T10:00:00.000Z"
}
```

### Bin 2: Short URLs Storage  
**Name:** `Venn Creative Short URLs`
**Initial JSON:**
```json
{
  "version": "1.0",
  "organizationId": "784812546842757295",
  "mappings": [],
  "lastUpdated": "2024-12-19T10:00:00.000Z"
}
```

### Bin 3: Page Types Storage  
**Name:** `Venn Creative Page Types`
**Initial JSON:**
```json
{
  "version": "1.0",
  "organizationId": "784812546842757295",
  "pageTypes": [],
  "lastUpdated": "2024-12-19T10:00:00.000Z"
}
```

### Bin 4: Comments Storage (NEW)
**Name:** `Venn Creative Comments`
**Initial JSON:**
```json
{
  "version": "1.0",
  "organizationId": "784812546842757295",
  "comments": [],
  "settings": {},
  "lastUpdated": "2024-12-19T10:00:00.000Z"
}
```

## Step 3: Update Configuration

After creating all four bins, you'll have:
- ✅ API Key (looks like: `$2a$10$8K7QX4P2H1Y9Z3B6C5D8E.F9G0H1I2J3...`)
- ✅ Sitemaps Bin ID (looks like: `676d4f8fad19ca34f8c0d5e2`)
- ✅ Short URLs Bin ID (looks like: `676d4f9aad19ca34f8c0d5e3`)
- ✅ Page Types Bin ID (looks like: `676d4f9bad19ca34f8c0d5e4`)
- ✅ Comments Bin ID (looks like: `676d4f9cad19ca34f8c0d5e5`)

Update `/utils/cloud-storage.ts` with your actual values:

```typescript
const CLOUD_STORAGE_CONFIG = {
  API_BASE: 'https://api.jsonbin.io/v3',
  
  // Replace with your actual values:
  API_KEY: 'YOUR_ACTUAL_API_KEY_HERE',
  SITEMAPS_BIN_ID: 'YOUR_SITEMAPS_BIN_ID_HERE',
  SHORT_URLS_BIN_ID: 'YOUR_SHORT_URLS_BIN_ID_HERE',
  PAGE_TYPES_BIN_ID: 'YOUR_PAGE_TYPES_BIN_ID_HERE',
  COMMENTS_BIN_ID: 'YOUR_COMMENTS_BIN_ID_HERE',
  
  ORG_ID: '784812546842757295',
  
  // Enable cloud storage once configured:
  ENABLE_CLOUD_STORAGE: true, // Change from false to true
};
```

## Step 4: Test the Setup

1. Save your changes to `cloud-storage.ts`
2. Reload your application
3. Check the browser console for:
   - `✅ Cloud storage connection successful`
   - `📊 Loading sitemaps from cloud storage...`

## Data Structure Reference

### Sitemap Data Structure
```typescript
interface CloudSitemaps {
  version: string;
  organizationId: string;
  sitemaps: SerializableSitemap[];
  lastUpdated: string;
}
```

### Short URL Data Structure  
```typescript
interface CloudShortUrls {
  version: string;
  organizationId: string;
  mappings: ShortUrlMapping[];
  lastUpdated: string;
}
```

### Page Types Data Structure  
```typescript
interface CloudPageTypes {
  version: string;
  organizationId: string;
  pageTypes: PageType[];
  lastUpdated: string;
}
```

### Comments Data Structure  
```typescript
interface CloudComments {
  version: string;
  organizationId: string;
  comments: Comment[];
  settings: CommentSettings;
  lastUpdated: string;
}
```

## Benefits After Setup

✅ **Team Collaboration** - All authenticated users see the same sitemaps  
✅ **Ultra-Short URLs** - 6-8 character share links (like `K7mN2x`)  
✅ **Cross-Browser Sync** - Works across all devices and browsers  
✅ **Data Persistence** - No more localStorage limitations  
✅ **Professional Sharing** - Client-friendly short URLs  

## Troubleshooting

### Console Commands for Testing:
```javascript
// Test cloud connection
window.vennCloudDebug.testConnection()

// Check configuration
window.vennCloudDebug.getConfig()

// List all sitemaps
window.vennCloudDebug.listAllSitemaps()

// Test short URL system
window.vennShortUrl.debugShortUrlSystem()
```

### Common Issues:
- **404 Errors**: Check your bin IDs are correct
- **Auth Errors**: Verify your API key is valid
- **No Data**: Ensure organization ID matches (`784812546842757295`)

## Current Status

- ⚠️ **Cloud storage is currently DISABLED**
- ✅ **App works with localStorage fallback**  
- 🔄 **Ready to enable once you configure JSONBin.io**

The app will automatically migrate your existing localStorage data to cloud storage once enabled.