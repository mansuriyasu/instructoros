import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { cn } from '@/lib/utils';
import { FirebaseClientProvider } from '@/firebase';
import { PushIdentityGuard } from '@/components/pwa/push-identity-guard';

export const metadata: Metadata = {
  title: 'InstructorOS',
  description: 'A comprehensive app for driving instructors to manage students, payments, and schedules.',
  applicationName: 'InstructorOS',
  appleWebApp: { capable: true, title: 'InstructorOS', statusBarStyle: 'default' },
  verification: {
    google: 'dxxq5DGEPG_014JW_b6x-BUcippWf9BFu5Ktz3Q-97c',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="google-site-verification" content="dxxq5DGEPG_014JW_b6x-BUcippWf9BFu5Ktz3Q-97c" />
        <script src="https://accounts.google.com/gsi/client" async defer></script>
      </head>
      <body className={cn("font-body antialiased", "min-h-screen bg-background font-sans")} suppressHydrationWarning>
        <FirebaseClientProvider>
          <PushIdentityGuard />
          {children}
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
