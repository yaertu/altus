import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin","latin-ext"],
  display: "swap",
  variable: "--font-inter"
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin","latin-ext"],
  display: "swap",
  variable: "--font-space"
});

const themeBoot = `
(function(){
  try{
    var key="yaateslimat:theme:v2";
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
  themeColor: "#050506",
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
      <body className={`${inter.variable} ${spaceGrotesk.variable}`}>{children}</body>
    </html>
  );
}
