import { ImageResponse } from "next/og";
import { brand } from "@/config/brand";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Favicon generata dai colori di brand.ts (le icone PWA arrivano allo step 8).
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: brand.colors.avorio,
          borderRadius: "50%",
          border: `3px solid ${brand.colors.oro}`,
          color: brand.colors.prugna,
          fontSize: 28,
          letterSpacing: 1,
        }}
      >
        {brand.monogram}
      </div>
    ),
    size,
  );
}
