import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";
import { ICON_SIZES, MASKABLE_SIZES } from "@/lib/pwa/icon";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fabiana L. Estetica",
    short_name: brand.name,
    description: brand.description,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "it",
    background_color: brand.colors.avorio,
    theme_color: brand.colors.avorio,
    icons: [
      ...ICON_SIZES.map((s) => ({ src: `/icons/icon-${s}.png`, sizes: `${s}x${s}`, type: "image/png", purpose: "any" as const })),
      ...MASKABLE_SIZES.map((s) => ({ src: `/icons/maskable-${s}.png`, sizes: `${s}x${s}`, type: "image/png", purpose: "maskable" as const })),
    ],
  };
}
