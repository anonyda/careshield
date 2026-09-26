import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'CareShield Max: buy health insurance online',
  description: 'Get a quote, complete your medical declaration and buy CareShield Max in minutes.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN">
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded focus:bg-white focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-lg font-bold text-indigo-800">
              CareShield Max
            </Link>
            <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
              Sandbox
            </span>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-xl px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
