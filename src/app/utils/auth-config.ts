// Configuration for Venn Creative authentication
export const authConfig = {
  // Venn Creative organization details
  organization: {
    id: '784812546842757295',
    name: 'Venn Creative',
    domain: 'venncreative.co.uk',
  },
  
  // Simple access code authentication
  // Set VITE_ACCESS_CODE in your .env file
  accessCode: import.meta.env.VITE_ACCESS_CODE || '',
  
  // Alternative: List of valid access codes (comma-separated in env var)
  validAccessCodes: (import.meta.env.VITE_ACCESS_CODES || import.meta.env.VITE_ACCESS_CODE || '')
    .split(',')
    .map((c: string) => c.trim())
    .filter(Boolean),
  
  // Session settings
  session: {
    // How long the session lasts (in days)
    durationDays: 30,
    // Storage key for session
    storageKey: 'venn_sitemap_auth',
  },
  
  // Development settings
  development: {
    // Set to true to bypass authentication completely (for development only)
    bypassAuth: false, // DISABLED - Authentication is now required
    
    // Set to true to show the access code in the UI (for testing)
    showAccessCodeInUI: false, // DISABLED - No longer showing access code hints
  }
} as const;

// Helper function to check if access code is valid
export function isValidAccessCode(code: string): boolean {
  if (!code) return false;
  
  // Trim whitespace and normalize case for comparison
  const normalizedCode = code.trim();
  
  // Check against single access code
  if (authConfig.accessCode && normalizedCode === authConfig.accessCode) {
    return true;
  }
  
  // Check against list of valid codes
  return authConfig.validAccessCodes.some(validCode => 
    normalizedCode === validCode || 
    normalizedCode.toLowerCase() === validCode.toLowerCase()
  );
}

// Helper function to get organization display name
export function getOrganizationName(): string {
  return authConfig.organization.name;
}

// Helper function to check if development bypass is enabled
export function isDevelopmentBypassEnabled(): boolean {
  return authConfig.development.bypassAuth;
}

// Helper to get session duration in milliseconds
export function getSessionDuration(): number {
  return authConfig.session.durationDays * 24 * 60 * 60 * 1000;
}

// Helper to check if we should show access code in UI (for testing)
export function shouldShowAccessCode(): boolean {
  return authConfig.development.showAccessCodeInUI;
}

// Helper to get the primary access code (for display in dev mode)
export function getPrimaryAccessCode(): string {
  return authConfig.accessCode;
}