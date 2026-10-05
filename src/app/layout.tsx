import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { brand, brandCssVariables } from "@/config/brand";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: brand.fullName, template: `%s · ${brand.name}` },
  description: brand.description,
  applicationName: brand.fullName,
};

export const viewport: Viewport = {
  themeColor: brand.colors.avorio,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${inter.variable} ${playfair.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: brandCssVariables() }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
