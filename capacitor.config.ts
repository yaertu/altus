import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.yaaertu.altusteslimat",
  appName: "ALTUS Teslimat",
  webDir: "mobile-shell",
  server: {
    url: process.env.CAPACITOR_SERVER_URL || "https://altuss.vercel.app",
    cleartext: false,
    allowNavigation: ["altuss.vercel.app", "*.supabase.co", "www.google.com", "maps.google.com"]
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#f4f6f8"
  },
  ios: {
    backgroundColor: "#f4f6f8",
    contentInset: "automatic"
  }
};

export default config;
