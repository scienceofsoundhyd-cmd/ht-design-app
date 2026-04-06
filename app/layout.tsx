import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Condensed, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/app/components/AuthProvider";
import GlobalNav from "@/app/components/GlobalNav";
import BackgroundController from "@/app/components/BackgroundController";

const siteSans = IBM_Plex_Sans({
  variable: "--font-site-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const siteDisplay = IBM_Plex_Sans_Condensed({
  variable: "--font-site-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Science of Sound — Home Theater Design Platform",
  description: "Learn, design, and master the perfect home theater. Acoustic engine, knowledge base, and learning paths.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${siteSans.variable} ${siteDisplay.variable} ${geistMono.variable} antialiased`}
        style={{ background: "#f0f1f3" }}
      >
        <AuthProvider>
          <BackgroundController />
          <GlobalNav />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
