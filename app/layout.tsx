import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { Toaster } from "@/components/ui/toaster"
import { OrderProcessingProvider } from "@/lib/context/OrderProcessingContext";
import { WebSocketProvider } from "@/lib/context/WebSocketContext";
import { ThemeProvider } from "../components/ui/theme-provider"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"
import { WalletProvider } from '@/lib/context/WalletContext';
import Footer from "@/components/ui/Footer";
import { AutoExecutionProvider } from "@/lib/context/AutoExecutionContext";
import { ChronikProvider } from '@/lib/context/ChronikContext';

import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
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
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        <Script src="https://unpkg.com/@paybutton/paybutton/dist/paybutton.js" strategy="lazyOnload" />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ErrorBoundary>
            <ChronikProvider>
              <WebSocketProvider>
                <OrderProcessingProvider>
                  <WalletProvider>
                    <AutoExecutionProvider>
                      {children}
                      <Footer />
                      <Toaster />
                    </AutoExecutionProvider>
                  </WalletProvider>
                </OrderProcessingProvider>
              </WebSocketProvider>
            </ChronikProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
