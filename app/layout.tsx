import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin","latin-ext"],
  display: "swap",
  variable: "--font-manrope"
});

const themeBoot = `
(function(){
  try{
    var key="yaateslimat:theme";
    var saved=localStorage.getItem(key);
    var theme=(saved==="dark"||saved==="light")
      ? saved
      : (window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");
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
  themeColor: [
    { media:"(prefers-color-scheme: light)", color:"#f6f8fb" },
    { media:"(prefers-color-scheme: dark)", color:"#07111f" }
  ],
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
      <body className={manrope.variable}>{children}</body>
    </html>
  );
}
