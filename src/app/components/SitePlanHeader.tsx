import { useAuth } from './AuthProvider';
import { UserProfile } from './UserProfile';
import { Badge } from './ui/badge';
import { Shield } from 'lucide-react';
import { getOrganizationName } from '../utils/auth-config';

export function SitePlanHeader() {
  const { isAuthenticated } = useAuth();

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-6">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-semibold">Sitemap Builder</h1>
          {isAuthenticated && (
            <Badge variant="outline" className="text-xs">
              <Shield className="h-3 w-3 mr-1" />
              {getOrganizationName()}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          <UserProfile />
        </div>
      </div>
    </header>
  );
}