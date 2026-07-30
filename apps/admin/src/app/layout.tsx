import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gbonhi Foot — Administration',
  description: 'Back-office Gbonhi Foot',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
