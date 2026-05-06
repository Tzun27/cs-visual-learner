import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CS Concept Visualizer",
    template: "%s — CS Concept Visualizer",
  },
  description:
    "Learn computer science concepts through interactive visualizations — sorting algorithms, data structures, and more.",
  openGraph: {
    type: "website",
    siteName: "CS Concept Visualizer",
    title: "CS Concept Visualizer",
    description:
      "Learn computer science by watching algorithms run. Step through them, scrub backwards, change the inputs.",
  },
  twitter: {
    card: "summary_large_image",
    title: "CS Concept Visualizer",
    description: "Learn computer science by watching algorithms run.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>
          <Nav />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
