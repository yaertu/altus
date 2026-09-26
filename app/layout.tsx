import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin","latin-ext"],
  display: "swap",
  variable: "--font-manrope"
});

export const metadata: Metadata = {
  title: "yaaTeslimat | Sevkiyat Yönetimi",
  description: "Dükkan ve saha ekibi için canlı teslimat, sevkiyat ve kontrol yönetimi.",
  applicationName: "yaaTeslimat",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "yaaTeslimat"
  },
  formatDetection: { telephone:false },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg"
  }
};

export const viewport: Viewport = {
  themeColor: "#f7fbfc",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className={manrope.variable}>{children}</body>
    </html>
  );
}
