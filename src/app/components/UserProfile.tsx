import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Badge } from './ui/badge';
import { User, Shield, LogOut, RefreshCw, Key, Clock } from 'lucide-react';
import { getOrganizationName, getSessionDuration } from '../utils/auth-config';

export function UserProfile() {
  const { user, isAuthenticated, logout, checkAuth } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!isAuthenticated || !user) {
    return null;
  }

  const handleRefreshAuth = async () => {
    setIsRefreshing(true);
    try {
      await checkAuth();
    } finally {
      setIsRefreshing(false);
    }
  };

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getSessionTimeRemaining = () => {
    if (!user?.authenticatedAt) return null;
    
    const sessionAge = Date.now() - user.authenticatedAt;
    const sessionDuration = getSessionDuration();
    const timeRemaining = sessionDuration - sessionAge;
    
    if (timeRemaining <= 0) return 'Expired';
    
    const daysRemaining = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));
    const hoursRemaining = Math.floor((timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    if (daysRemaining > 0) {
      return `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`;
    } else if (hoursRemaining > 0) {
      return `${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'} remaining`;
    } else {
      return 'Less than 1 hour remaining';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              {getUserInitials(user.name)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center space-x-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">
                  {getUserInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <p className="text-sm font-medium leading-none">{user.name}</p>
            </div>
            <p className="text-xs leading-none text-muted-foreground">
              {getOrganizationName()} Team Member
            </p>
            <div className="flex flex-col space-y-1">
              <Badge variant="default" className="text-xs w-fit">
                <Shield className="h-3 w-3 mr-1" />
                Authenticated
              </Badge>
              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{getSessionTimeRemaining()}</span>
              </div>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleRefreshAuth}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Session
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={logout}
          className="text-destructive"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}