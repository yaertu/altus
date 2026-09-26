import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "yaaTeslimat",
    short_name: "yaaTeslimat",
    description: "Dükkan ve sevkiyat ekibi için teslimat operasyon yönetimi",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f9fc",
    theme_color: "#f7f9fc",
    orientation: "any",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      }
    ]
  };
}
