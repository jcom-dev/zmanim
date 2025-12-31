'use client';

import { ReactNode, useState } from 'react';
import { PublisherProvider, usePublisherContext } from '@/providers/PublisherContext';
import { PublisherSwitcher } from '@/components/publisher/PublisherSwitcher';
import { PublisherSelectionModal } from '@/components/publisher/PublisherSelectionModal';
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner';
import { ModeToggle } from '@/components/mode-toggle';
import { UserContextMenu } from '@/components/shared/UserContextMenu';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUserRoles } from '@/lib/hooks';
import { Shield, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PublisherLayoutProps {
  children: ReactNode;
}

interface Publisher {
  id: string;
  name: string;
  status: string;
}

// Inner component that can access PublisherContext
function PublisherLayoutContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin, isLoaded } = useUserRoles();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { publishers, requiresSelection, setSelectedPublisherId } = usePublisherContext();

  const navItems = [
    { href: '/publisher/dashboard', label: 'Dashboard' },
    { href: '/publisher/profile', label: 'Profile' },
    { href: '/publisher/settings/calculation', label: 'Settings' },
    { href: '/publisher/coverage', label: 'Coverage' },
    { href: '/publisher/algorithm', label: 'Zmanim' },
    { href: '/publisher/registry', label: 'Registry' },
    { href: '/publisher/primitives', label: 'Primitives' },
    { href: '/publisher/corrections', label: 'Locations' },
    { href: '/publisher/team', label: 'Team' },
  ];

  return (
    <>
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        {/* Impersonation Banner */}
        <ImpersonationBanner />

        {/* Header - Fixed height, no shrink */}
        <header className="flex-none bg-card border-b border-border sticky top-0 z-50">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Desktop Header */}
            <div className="hidden sm:flex justify-between items-center h-16">
              {/* Left: Logo & Publisher Switcher */}
              <div className="flex items-center gap-6">
                <Link href="/" className="text-xl font-bold text-foreground hover:text-primary transition-colors">
                  Shtetl Zmanim
                </Link>
                <div className="h-6 w-px bg-border" />
                <PublisherSwitcher />
              </div>

              {/* Right: Theme Toggle, Admin Link & User Menu */}
              <div className="flex items-center gap-3">
                <ModeToggle />
                {isLoaded && isAdmin && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900 transition-colors"
                  >
                    <Shield className="w-4 h-4" />
                    <span className="hidden lg:inline">Admin Portal</span>
                  </Link>
                )}
                <UserContextMenu />
              </div>
            </div>

            {/* Mobile Header */}
            <div className="sm:hidden">
              {/* Top Row: Logo, Theme, Menu */}
              <div className="flex justify-between items-center h-14">
                <Link href="/" className="text-lg font-bold text-foreground hover:text-primary transition-colors">
                  Shtetl Zmanim
                </Link>
                <div className="flex items-center gap-2">
                  <ModeToggle />
                  <UserContextMenu />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    aria-label="Toggle navigation menu"
                    aria-expanded={mobileMenuOpen}
                  >
                    {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  </Button>
                </div>
              </div>
              {/* Bottom Row: Publisher Switcher */}
              <div className="pb-3">
                <PublisherSwitcher />
              </div>
            </div>
          </div>
        </header>

        {/* Desktop Navigation - Fixed height, hidden scrollbar */}
        <nav className="flex-none hidden sm:block bg-card/50 border-b border-border">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between overflow-x-auto scrollbar-hide">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex-1 text-center py-3 px-2 border-b-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="sm:hidden bg-card border-b border-border shadow-lg">
            <div className="px-4 py-3 space-y-1 max-h-[calc(100vh-8rem)] overflow-y-auto">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-4 py-3 rounded-lg text-base font-medium transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              {isLoaded && isAdmin && (
                <>
                  <div className="my-2 border-t border-border"></div>
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950 transition-colors"
                  >
                    <Shield className="w-5 h-5" />
                    Admin Portal
                  </Link>
                </>
              )}
            </div>
          </nav>
        )}

        {/* Main Content - Fills remaining space */}
        <main className="flex-1">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>

        {/* Blocking Publisher Selection Modal */}
        <PublisherSelectionModal
          open={requiresSelection}
          publishers={publishers}
          onSelect={(publisher: Publisher) => {
            setSelectedPublisherId(publisher.id);
            router.push('/publisher/dashboard');
          }}
          required={true}
        />
      </div>
    </>
  );
}

// Outer component that provides the PublisherContext
export default function PublisherLayout({ children }: PublisherLayoutProps) {
  return (
    <PublisherProvider>
      <PublisherLayoutContent>{children}</PublisherLayoutContent>
    </PublisherProvider>
  );
}
