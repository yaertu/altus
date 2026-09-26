"use client";

import { useMemo, useState } from "react";

const ICONIFY = "https://api.iconify.design";

export type WebIconName =
  | "storefront-outline" | "truck-fast-outline" | "package-variant-closed"
  | "account-group-outline" | "clipboard-check-outline" | "map-marker-path"
  | "bell-ring-outline" | "washing-machine" | "dishwasher" | "fridge-outline"
  | "microwave" | "stove" | "television" | "vacuum-outline" | "air-conditioner"
  | "tools" | "package-check";

export function iconUrl(name: string, color = "0b8f82", size = 28) {
  return `${ICONIFY}/mdi/${name}.svg?color=%23${color}&width=${size}&height=${size}`;
}

export function productIconName(text: string): WebIconName {
  const value = text.toLocaleLowerCase("tr-TR");
  if (value.includes("bulaşık")) return "dishwasher";
  if (value.includes("çamaşır")) return "washing-machine";
  if (value.includes("buzdol") || value.includes("soğut")) return "fridge-outline";
  if (value.includes("mikrodalga")) return "microwave";
  if (value.includes("fırın") || value.includes("ocak")) return "stove";
  if (value.includes("televizyon") || value.includes(" tv") || value.startsWith("tv")) return "television";
  if (value.includes("süpürge") || value.includes("vakum")) return "vacuum-outline";
  if (value.includes("klima")) return "air-conditioner";
  if (value.includes("servis") || value.includes("tamir")) return "tools";
  return "package-variant-closed";
}

export default function WebIcon({
  name,
  product,
  size = 28,
  color = "0b8f82",
  className = "",
  alt = ""
}: {
  name?: WebIconName;
  product?: string;
  size?: number;
  color?: string;
  className?: string;
  alt?: string;
}) {
  const [fallback,setFallback]=useState(false);
  const resolved = useMemo(()=>fallback ? "package-variant-closed" : (name || productIconName(product || "")),[fallback,name,product]);
  return <img
    className={className}
    src={iconUrl(resolved,color,size)}
    width={size}
    height={size}
    loading="lazy"
    decoding="async"
    referrerPolicy="no-referrer"
    alt={alt}
    onError={()=>setFallback(true)}
  />;
}
