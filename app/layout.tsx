import type { Metadata, Viewport } from "next";
import { Geist, Caveat } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"], weight: ["600", "700"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const description = "Plan the week, write the list, cross it off at the store. A shared meal planner and grocery list for one household.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "mise", template: "%s · mise" },
  description,
  applicationName: "mise",
  keywords: ["meal planning", "grocery list", "recipes", "household", "shopping list"],
  authors: [{ name: "Eli Feldman" }],
  creator: "Eli Feldman",
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: "website",
    siteName: "mise",
    title: "mise",
    description,
    url: siteUrl,
    locale: "en_US",
    images: [{ url: "/preview.png", width: 1200, height: 630, alt: "mise — plan the week, write the list, cross it off at the store." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "mise",
    description,
    images: ["/preview.png"],
  },
  appleWebApp: { capable: true, title: "mise", statusBarStyle: "default" },
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#f8f5f0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${caveat.variable} antialiased`}>
      <body className="min-h-dvh bg-paper text-ink font-sans">{children}</body>
    </html>
  );
}
