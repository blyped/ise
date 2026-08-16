import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { fr } from '@/i18n/fr';
import { ConnectionLostBanner } from '@/components/system/ConnectionLostBanner';
import './globals.css';

export const metadata: Metadata = {
  title: { default: fr.brand.name, template: `%s · ${fr.brand.name}` },
  description: fr.brand.promise,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B214A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        {children}
        {/* SYS-010 — bandeau global « Connexion perdue » (role=status). */}
        <ConnectionLostBanner />
        <Analytics />
      </body>
    </html>
  );
}
