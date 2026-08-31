import type { Metadata, Viewport } from 'next';
import { Unbounded, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Fx from '../components/fx';

const display = Unbounded({
  subsets: ['cyrillic', 'latin'],
  weight: ['500', '700', '900'],
  variable: '--font-display',
});

const mono = JetBrains_Mono({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'FRIENDLYPLACE® — анонимные знакомства по всему миру',
  description: 'Говори с миром на своём языке. Автоперевод в реальном времени.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#0a0a0a',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className={`${display.variable} ${mono.variable} antialiased`}>
        <Fx />
        {children}
      </body>
    </html>
  );
}