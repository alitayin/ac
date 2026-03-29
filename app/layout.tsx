import type { Metadata } from "next";
import { Inter } from 'next/font/google'
import localFont from "next/font/local";
import Script from "next/script";
import { Toaster } from "@/components/ui/toaster"
import { OrderProcessingProvider } from "@/lib/context/OrderProcessingContext";
import { WebSocketProvider } from "@/lib/context/WebSocketContext";
import { ThemeProvider } from "../components/ui/theme-provider"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"
import { WalletProvider } from '@/lib/context/WalletContext';
import Footer from "@/components/ui/Footer";

import "./globals.css";

// Inter is used for general text
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

// Marlin is used only for special headings
const marlinFont = localFont({
  src: "./fonts/MarlinSoftSQ-ExtraBold.woff2",
  variable: "--font-marlin",
  weight: "200",  // ExtraBold fonts usually expose a single weight
});

export const metadata: Metadata = {
  title: "agoraUI - A eCash Agora DEX Interface",
  description: "agoraUI is the best place to list your eToken, an eToken DEX UI built upon Cashtab's Agora, offering professional exchange-style charts. Join our Telegram community at https://t.me/agoraUI for discussions.",
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${marlinFont.variable} antialiased`}>
        <Script src="https://unpkg.com/@paybutton/paybutton/dist/paybutton.js" strategy="lazyOnload" />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ErrorBoundary>
            <WebSocketProvider>
              <OrderProcessingProvider>
                <WalletProvider>
                  {children}
                  <Footer />
                  <Toaster />
                </WalletProvider>
              </OrderProcessingProvider>
            </WebSocketProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
