import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

// What people see when the link is shared (WhatsApp, text messages, Google): kept general on purpose.
const DESCRIPTION = "Track your Mivtzoim, your routes and the people you visit, all in one place.";

export const metadata: Metadata = {
  metadataBase: new URL("https://sdmivtzoim.com"),
  title: "Shiur Daled Mivtzoim",
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Shiur Daled Mivtzoim",
    title: "Shiur Daled Mivtzoim",
    description: DESCRIPTION,
    images: [{ url: `${base}/icon-512.png`, width: 512, height: 512, alt: "Shiur Daled Mivtzoim" }],
  },
  twitter: { card: "summary", title: "Shiur Daled Mivtzoim", description: DESCRIPTION, images: [`${base}/icon-512.png`] },
  manifest: `${base}/manifest.webmanifest`,
  icons: { apple: `${base}/apple-touch-icon.png` },
  // Opens full screen, like an app, when added to an iPhone home screen.
  appleWebApp: { capable: true, title: "SD Mivtzoim", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#efedf0" },
    { media: "(prefers-color-scheme: dark)", color: "#131315" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,400..700&family=David+Libre:wght@700&display=swap"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
