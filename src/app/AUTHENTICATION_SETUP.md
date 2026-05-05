# Authentication Setup Guide

This guide explains how to configure authentication for your Sitemap Builder application.

## Quick Setup

1. **Choose your authorization method** in `/utils/auth-config.ts`:

### Option A: Email Domain Restriction
```typescript
allowedEmails: [
  'venncreative.co.uk',        // Allow all @yourcompany.com emails
  'anotherdomain.org',      // Allow all @anotherdomain.org emails
  'specific@email.com',     // Allow specific email
],
```

### Option B: Organization/Team IDs (Advanced)
```typescript
allowedOrganizations: [
  'your-figma-team-id-1',
  'your-figma-team-id-2',
],
```

### Option C: Disable Authentication (Testing Only)
```typescript
development: {
  bypassAuth: true,  // Only for testing - NOT recommended for production
}
```

## Step-by-Step Configuration

### 1. Configure Email Domain Access

Edit `/utils/auth-config.ts`:

```typescript
export const authConfig = {
  allowedEmails: [
    'yourcompany.com',  // Replace with your company domain
  ],
  // ... rest of config
};
```

### 2. Test the Configuration

1. Make sure `bypassAuth` is set to `false`
2. Deploy your plugin to Figma
3. Only users with emails from your configured domains should have access

### 3. Find Your Organization ID (Advanced)

If you want to use organization-based access:

1. In Figma, go to your team settings
2. Look at the URL - it will contain your team ID
3. Or use the Figma API to get team information

### 4. Error Messages

Users will see different messages based on their status:

- **Not logged in**: "Authentication Required"
- **Logged in but unauthorized**: "Access Restricted" 
- **No rules configured**: "No authorization rules configured"

## Security Notes

- **Never set `bypassAuth: true` in production**
- **Always configure at least one authorization method**
- **Email domains are case-insensitive**
- **Organization IDs provide more security but require team API access**

## Testing

1. **During Development**: Set `bypassAuth: true` temporarily
2. **Before Deployment**: Set `bypassAuth: false` and test with real Figma accounts
3. **Production**: Only authorized users should have access

## Troubleshooting

### "No authorization rules configured"
- Add email domains or organization IDs to `authConfig`

### "Access Restricted" for valid users
- Check email domain spelling in config
- Verify user's Figma email matches allowed domains

### Authentication not working
- Ensure the app is running as a Figma plugin (not in browser)
- Check browser console for error messages