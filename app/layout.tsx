import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Noto_Serif_KR } from "next/font/google";
import "./globals.css";

const serif = Noto_Serif_KR({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
});

const sans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

const title = "Jinyoung Daniel Jeon — Software & AI Engineer";
const description =
  "Full-stack & AI engineer at NorthBound College. A portfolio drawn as an ink-wash pine: projects in the canopy, experience in the roots.";

// The public address, for absolute link-preview URLs: set SITE_URL (e.g. https://example.com) where the site
// is deployed. On Vercel the production domain is picked up automatically.
const siteUrl = process.env.SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    type: "website",
    title,
    description,
    siteName: "Jinyoung Daniel Jeon",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#F9F8F6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
