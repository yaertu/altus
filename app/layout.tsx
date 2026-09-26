import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "yaaTeslimat | Sevkiyat Yönetimi",
  description: "Dükkan ve saha ekibi için teslimat, sevkiyat ve kontrol yönetimi.",
  applicationName: "yaaTeslimat",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "yaaTeslimat"
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg"
  }
};

export const viewport: Viewport = {
  themeColor: "#f7f9fc",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
