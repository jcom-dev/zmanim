'use client';

import { useState } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { Settings, LogOut, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { UserSettingsModal } from '@/components/shared/UserSettingsModal';

export function UserContextMenu() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!isLoaded || !user) {
    return null;
  }

  const displayName = user.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
    : user.primaryEmailAddress?.emailAddress || 'User';

  const email = user.primaryEmailAddress?.emailAddress || '';
  const initials = user.firstName
    ? user.firstName.charAt(0).toUpperCase()
    : email.charAt(0).toUpperCase();

  const handleSignOut = () => {
    signOut({ redirectUrl: '/' });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 p-1.5 rounded-full hover:bg-muted transition-colors"
            aria-label="User menu"
            data-testid="user-menu-trigger"
          >
            {user.imageUrl ? (
              <img
                src={user.imageUrl}
                alt={displayName}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-semibold text-sm">
                  {initials}
                </span>
              </div>
            )}
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          {/* User info header */}
          <DropdownMenuLabel className="font-normal">
            <div className="flex items-center gap-3">
              {user.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={displayName}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-semibold">
                    {initials}
                  </span>
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{displayName}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                  {email}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {/* Account Settings */}
          <DropdownMenuItem onClick={() => setSettingsOpen(true)} data-testid="user-menu-settings">
            <Settings className="w-4 h-4" />
            Account Settings
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Sign Out */}
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive" data-testid="user-menu-sign-out">
            <LogOut className="w-4 h-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* User Settings Modal */}
      <UserSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
