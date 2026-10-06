import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { brand } from "@/config/brand";

/**
 * Icone dell'app (monogramma FL su rosa cipria), generate dai colori di brand.ts e rese statiche
 * al build. Il font è Playfair Display (licenza OFL, src/assets/fonts).
 * - "any": quadrato con angoli arrotondati, come la vedono Android e i browser;
 * - "maskable" e "apple": pieno fino ai bordi (il sistema ritaglia la forma), disegno dentro la zona sicura.
 */
export type IconVariant = "any" | "maskable" | "apple";

let font: Promise<Buffer> | null = null;
const loadFont = () => (font ??= readFile(join(process.cwd(), "src/assets/fonts/PlayfairDisplay.ttf")));

export async function renderIcon(size: number, variant: IconVariant): Promise<ImageResponse> {
  const fullBleed = variant !== "any";
  // Nelle maskable il disegno deve stare nel cerchio centrale (80%): monogramma e anello più piccoli.
  const ring = size * (variant === "maskable" ? 0.62 : 0.8);
  const ringWidth = Math.max(1, Math.round(size / 96));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: brand.colors.cipria,
          borderRadius: fullBleed ? 0 : size * 0.22,
        }}
      >
        <div
          style={{
            width: ring,
            height: ring,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            border: size >= 64 ? `${ringWidth}px solid ${brand.colors.avorio}` : "none",
            color: brand.colors.avorio,
            fontFamily: "Playfair",
            fontSize: ring * 0.44,
            letterSpacing: ring * 0.01,
            paddingBottom: ring * 0.04,
          }}
        >
          {brand.monogram}
        </div>
      </div>
    ),
    { width: size, height: size, fonts: [{ name: "Playfair", data: await loadFont(), weight: 400, style: "normal" }] },
  );
}

/** Misure delle icone "any" nel manifest. */
export const ICON_SIZES = [48, 72, 96, 128, 144, 152, 192, 256, 384, 512] as const;
export const MASKABLE_SIZES = [192, 512] as const;
