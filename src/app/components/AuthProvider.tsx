import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { Loader2, Shield, AlertTriangle, Key, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { 
  authConfig, 
  isValidAccessCode, 
  getOrganizationName, 
  isDevelopmentBypassEnabled,
  getSessionDuration,
  shouldShowAccessCode
} from '../utils/auth-config';

interface AuthUser {
  id: string;
  name: string;
  accessCode: string;
  authenticatedAt: number;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  loginWithAccessCode: (name: string, accessCode: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const checkAuth = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      // Check if development bypass is enabled
      if (isDevelopmentBypassEnabled()) {
        setAuthState({
          user: {
            id: 'dev-user',
            name: 'Development User',
            accessCode: 'dev',
            authenticatedAt: Date.now(),
          },
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        return;
      }

      // Check for stored session
      const storedSession = localStorage.getItem(authConfig.session.storageKey);
      
      if (storedSession) {
        try {
          const user: AuthUser = JSON.parse(storedSession);
          
          // Check if session is still valid
          const sessionAge = Date.now() - user.authenticatedAt;
          const sessionDuration = getSessionDuration();
          
          if (sessionAge < sessionDuration && isValidAccessCode(user.accessCode)) {
            setAuthState({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            return;
          } else {
            // Session expired or invalid code
            localStorage.removeItem(authConfig.session.storageKey);
          }
        } catch {
          // Invalid stored data
          localStorage.removeItem(authConfig.session.storageKey);
        }
      }

      // No valid session found
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });

    } catch (error) {
      console.error('Authentication error:', error);
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      });
    }
  };

  const loginWithAccessCode = async (name: string, accessCode: string) => {
    if (!name.trim()) {
      throw new Error('Please enter your name');
    }

    if (!isValidAccessCode(accessCode)) {
      throw new Error('Invalid access code. Please check with your team lead for the correct code.');
    }

    const user: AuthUser = {
      id: `user-${Date.now()}`,
      name: name.trim(),
      accessCode,
      authenticatedAt: Date.now(),
    };

    // Store session
    localStorage.setItem(authConfig.session.storageKey, JSON.stringify(user));

    setAuthState({
      user,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  };

  const logout = () => {
    localStorage.removeItem(authConfig.session.storageKey);
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const contextValue: AuthContextType = {
    ...authState,
    loginWithAccessCode,
    logout,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

function AccessCodeLoginForm({ onLogin }: { onLogin: (name: string, accessCode: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAccessCode, setShowAccessCode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await onLogin(name, accessCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Key className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>{getOrganizationName()} Access</CardTitle>
        <CardDescription>
          Enter your name and the team access code to use the Sitemap Builder
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Your Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accessCode">Access Code</Label>
            <div className="relative">
              <Input
                id="accessCode"
                type={showAccessCode ? "text" : "password"}
                placeholder="Enter team access code"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                required
                disabled={isLoading}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowAccessCode(!showAccessCode)}
                disabled={isLoading}
              >
                {showAccessCode ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          
          {shouldShowAccessCode() && (
            <div className="p-3 bg-warning/10 border border-warning/20 rounded-md">
              <p className="text-sm text-warning-foreground">
                <strong>Dev Mode:</strong> Access code is "{String(authConfig.accessCode)}"
              </p>
            </div>
          )}
          
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Access Sitemap Builder
              </>
            )}
          </Button>
        </form>
        
        <div className="mt-4 text-center text-sm text-muted-foreground">
          <p>Don't have the access code?</p>
          <p>Contact your team lead or project manager.</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, error, loginWithAccessCode } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <div>
            <h2 className="text-lg font-medium">Checking access...</h2>
            <p className="text-sm text-muted-foreground">Verifying your credentials</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <AccessCodeLoginForm onLogin={loginWithAccessCode} />
      </div>
    );
  }

  return <>{children}</>;
}