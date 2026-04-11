import type { Metadata, Viewport } from "next";
import "./globals.css";

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "GestiCom - Gestion de Commerce",
  description: "Application professionnelle de gestion - Stocks, Ventes, Achats, Comptabilité",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GestiCom",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#f97316",
};

// Retrait des composants de licence

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="antialiased bg-gray-50 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 min-h-screen">
        {children}
      </body>
    </html>
  );
}

