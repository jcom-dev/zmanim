/**
 * @file layout.tsx
 * @purpose Root layout - Clerk, React Query, Theme, PublisherContext providers
 * @pattern next-layout
 * @dependencies ClerkProvider, QueryClient, ThemeProvider
 * @frequency critical - app initialization
 * @compliance Check docs/adr/ for pattern rationale
 */

import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Hebrew } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { QueryProvider } from '@/providers/QueryProvider';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DevModeBanner } from '@/components/shared/DevModeBanner';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });
const notoSansHebrew = Noto_Sans_Hebrew({
  subsets: ['hebrew'],
  variable: '--font-hebrew',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Zmanim Lab - Multi-Publisher Prayer Times Platform',
  description:
    'Calculate Jewish prayer times (zmanim) according to multiple halachic authorities and calculation methods worldwide. Choose your preferred publisher for accurate times.',
  keywords: [
    'zmanim',
    'Jewish prayer times',
    'halachic times',
    'kosher times',
    'prayer times',
    'sunrise',
    'sunset',
    'alos hashachar',
    'tzeis hakochavim',
    'multi-publisher',
    'halachic authorities',
  ],
  authors: [{ name: 'Zmanim Lab' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3b82f6',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🕍</text></svg>" />
        </head>
        <body className={`${inter.className} ${notoSansHebrew.variable}`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <QueryProvider>
              <TooltipProvider delayDuration={300}>
                <DevModeBanner />
                <div className="min-h-screen bg-background text-foreground">
                  {children}
                </div>
                <Toaster richColors position="bottom-right" />
              </TooltipProvider>
            </QueryProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
