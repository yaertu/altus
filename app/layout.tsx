import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin","latin-ext"],
  display: "swap",
  variable: "--font-jakarta"
});

const mono = JetBrains_Mono({
  subsets: ["latin","latin-ext"],
  display: "swap",
  variable: "--font-mono"
});

const themeBoot = `
(function(){
  try{
    var key="yaateslimat:theme:v3";
    var saved=localStorage.getItem(key);
    var theme=(saved==="dark"||saved==="light") ? saved : "dark";
    var root=document.documentElement;
    root.dataset.theme=theme;
    root.classList.toggle("dark",theme==="dark");
    root.style.colorScheme=theme;
  }catch(e){}
})();
`;

export const metadata: Metadata = {
  title: "yaaTeslimat | Sevkiyat Yönetimi",
  description: "Dükkan ve saha ekibi için canlı teslimat, sevkiyat ve kontrol yönetimi.",
  applicationName: "yaaTeslimat",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "yaaTeslimat"
  },
  formatDetection: { telephone:false },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg"
  }
};

export const viewport: Viewport = {
  themeColor: "#08090b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className={`${jakarta.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
