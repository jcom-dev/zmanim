'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { UserContextMenu } from '@/components/shared/UserContextMenu';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, BarChart3, Settings, Sun, Clock, UserCog, Building2, FileQuestion, MapPinCheck, ScrollText } from 'lucide-react';
import { useUserRoles } from '@/lib/hooks';
import { ModeToggle } from '@/components/mode-toggle';
import { useAdminApi } from '@/lib/api-client';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const { hasPublisherAccess, isLoaded } = useUserRoles();
  const { isLoaded: userLoaded } = useUser();
  const api = useAdminApi();
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  // Fetch pending zman request count for badge
  useEffect(() => {
    if (!userLoaded) return;

    const fetchPendingCount = async () => {
      try {
        const data = await api.get<{ requests: unknown[]; total: number }>('/admin/zman-requests?status=pending');
        setPendingRequestCount(data?.requests?.length || 0);
      } catch {
        // Silently fail - badge just won't show
      }
    };

    fetchPendingCount();
    // Refresh every 60 seconds
    const interval = setInterval(fetchPendingCount, 60000);
    return () => clearInterval(interval);
  }, [userLoaded, api]);

  const navItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: BarChart3 },
    { href: '/admin/users', label: 'Users', icon: UserCog },
    { href: '/admin/publishers', label: 'Publishers', icon: Users },
    { href: '/admin/zmanim/primitives', label: 'Primitives', icon: Sun },
    { href: '/admin/zmanim/registry', label: 'Registry', icon: Clock },
    { href: '/admin/zman-requests', label: 'Requests', icon: FileQuestion, badge: pendingRequestCount },
    { href: '/admin/correction-requests', label: 'Corrections', icon: MapPinCheck },
    { href: '/admin/audit', label: 'Audit', icon: ScrollText },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href) && (href !== '/admin' || pathname === '/admin');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header - Fixed height, no shrink */}
      <header className="flex-none bg-card border-b border-border">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left: Logo & Breadcrumb */}
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Home className="w-5 h-5" />
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-xl font-bold">Admin Portal</span>
            </div>

            {/* Right: Theme Toggle, Publisher Link (if dual-role) & User Button */}
            <div className="flex items-center gap-4">
              <ModeToggle />
              {isLoaded && hasPublisherAccess && (
                <Link
                  href="/publisher"
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                >
                  <Building2 className="w-4 h-4" />
                  Publisher Portal
                </Link>
              )}
              <UserContextMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Navigation - Fixed height, hidden scrollbar, horizontal scroll on overflow */}
      <nav className="flex-none bg-card/50 border-b border-border">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between overflow-x-auto scrollbar-hide">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, item.exact);
              const badge = 'badge' in item ? (item.badge ?? 0) : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                    active
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                  {badge > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-destructive-foreground bg-destructive rounded-full min-w-5">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content - Fills remaining space */}
      <main className="flex-1">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
