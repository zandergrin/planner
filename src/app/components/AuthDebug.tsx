import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useAuth } from './AuthProvider';
import { authConfig, isValidAccessCode, shouldShowAccessCode } from '../utils/auth-config';
import { Eye, EyeOff, RefreshCw, LogOut, CheckCircle, XCircle } from 'lucide-react';

export function AuthDebug() {
  const { user, isAuthenticated, logout, checkAuth } = useAuth();
  const [showCodes, setShowCodes] = useState(false);

  const testCodes = [
    'VennSitemap2024',
    'VennSitemap2024!',
    'VennTeam2024',
    'vennsitemap2024',
    'wrong-code'
  ];

  const getStatusIcon = () => {
    if (isAuthenticated) return <CheckCircle className="w-3 h-3 text-green-500" />;
    return <XCircle className="w-3 h-3 text-red-500" />;
  };

  const getStatusText = () => {
    if (isAuthenticated) return 'Authenticated';
    return 'Not Authenticated';
  };

  const getStatusColor = () => {
    if (isAuthenticated) return 'bg-green-100 text-green-800';
    return 'bg-red-100 text-red-800';
  };

  // Safe rendering helpers to prevent object-as-child errors
  const renderUserInfo = () => {
    if (!user) return null;
    
    return (
      <div className="p-2 bg-muted/50 rounded text-xs">
        <div><strong>User:</strong> {String(user.name || 'Unknown')}</div>
        <div><strong>Code:</strong> {showCodes ? String(user.accessCode || '') : '••••••••'}</div>
        <div><strong>Session:</strong> {user.authenticatedAt ? new Date(user.authenticatedAt).toLocaleTimeString() : 'Unknown'}</div>
      </div>
    );
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-xs">
      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            🔐 Auth Debug
            <Badge className={`${getStatusColor()} flex items-center gap-1`}>
              {getStatusIcon()}
              {getStatusText()}
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Debug authentication status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Current User */}
          {renderUserInfo()}

          {/* Access Code Testing */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium">Valid Codes:</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setShowCodes(!showCodes)}
              >
                {showCodes ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </Button>
            </div>
            
            {showCodes && (
              <div className="space-y-1">
                {testCodes.map((code, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <code className="bg-muted px-1 rounded">{code}</code>
                    {isValidAccessCode(code) ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <XCircle className="w-3 h-3 text-red-500" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Development Settings */}
          <div className="text-xs space-y-1 pt-2 border-t">
            <div>
              <strong>Dev Bypass:</strong> {String(authConfig.development.bypassAuth)}
            </div>
            <div>
              <strong>Show Codes:</strong> {String(shouldShowAccessCode())}
            </div>
            <div>
              <strong>Primary Code:</strong> {showCodes ? String(authConfig.accessCode) : '••••••••'}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-7 text-xs"
              onClick={checkAuth}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </Button>
            
            {isAuthenticated && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-7 text-xs"
                onClick={logout}
              >
                <LogOut className="w-3 h-3 mr-1" />
                Logout
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}