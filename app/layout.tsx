import type { Metadata, Viewport } from "next";
import { DM_Sans, Roboto_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin","latin-ext"],
  display: "swap",
  variable: "--font-ui"
});

const mono = Roboto_Mono({
  subsets: ["latin","latin-ext"],
  display: "swap",
  variable: "--font-mono"
});

const themeBoot = `
(function(){
  try{
    var key="altus-teslimat:theme:v12";
    var saved=localStorage.getItem(key);
    var theme="light";
    var root=document.documentElement;
    root.dataset.theme=theme;
    root.classList.toggle("dark",theme==="dark");
    root.style.colorScheme=theme;
  }catch(e){}
})();
`;

export const metadata: Metadata = {
  title: "ALTUS Teslimat | Mağaza & Servis",
  description: "Mağaza ve servis personeli için müşteri, ürün, adres, teslimat ve kontrol yönetimi.",
  applicationName: "ALTUS Teslimat",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ALTUS Teslimat"
  },
  formatDetection: { telephone:false },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg"
  }
};

export const viewport: Viewport = {
  themeColor: "#f00088",
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
      <body className={`${dmSans.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
