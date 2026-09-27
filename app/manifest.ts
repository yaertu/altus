import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ALTUS Teslimat",
    short_name: "ALTUS",
    description: "Dükkan ve sevkiyat ekibi için canlı teslimat operasyon yönetimi",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#f00088",
    orientation: "any",
    categories: ["business","productivity","utilities"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      }
    ],
    shortcuts: [
      {
        name: "Yeni Teslimat",
        short_name: "Yeni",
        description: "Yeni sevkiyat kaydı oluştur",
        url: "/?action=new-delivery",
        icons: [{ src:"/icon.svg", sizes:"any", type:"image/svg+xml" }]
      },
      {
        name: "Bugünkü Teslimatlar",
        short_name: "Bugün",
        description: "Bugünkü sevkiyatları aç",
        url: "/?view=deliveries",
        icons: [{ src:"/icon.svg", sizes:"any", type:"image/svg+xml" }]
      }
    ]
  };
}
