import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "../components/ui/theme-provider"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"
import { WalletProvider } from '@/lib/context/WalletContext';
import Footer from "@/components/ui/Footer";
import { AutoExecutionProvider } from "@/lib/context/AutoExecutionContext";
import { ChronikProvider } from '@/lib/context/ChronikContext';

import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://agora.cash";
const pageTitle = "agoraUI - eCash Agora DEX Interface";
const pageDescription =
  "agoraUI is the best place to list your eToken, an eToken DEX UI built upon Cashtab's Agora, offering professional exchange-style charts. Join our Telegram community at https://t.me/agoraUI for discussions.";
const ogImagePath = "/og-image.png";

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
  metadataBase: new URL(siteUrl),
  title: pageTitle,
  description: pageDescription,
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Agora Cash",
    title: pageTitle,
    description: pageDescription,
    images: [
      {
        url: ogImagePath,
        width: 2700,
        height: 1790,
        alt: "Agora Cash token table preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
    images: [ogImagePath],
  },
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
          defaultTheme="light"
          enableSystem={false}
          themes={["light", "dark"]}
          disableTransitionOnChange
        >
          <ErrorBoundary>
            <ChronikProvider>
              <WalletProvider>
                <AutoExecutionProvider>
                  {children}
                  <Footer />
                  <Toaster />
                </AutoExecutionProvider>
              </WalletProvider>
            </ChronikProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
