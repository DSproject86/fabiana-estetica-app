import { notFound } from "next/navigation";
import { ICON_SIZES, MASKABLE_SIZES, renderIcon } from "@/lib/pwa/icon";

// Icone del manifest, generate al build: /icons/icon-192.png, /icons/maskable-512.png …
export const dynamic = "force-static";
export const dynamicParams = false;

const FILES = new Map<string, { size: number; variant: "any" | "maskable" }>([
  ...ICON_SIZES.map((size) => [`icon-${size}.png`, { size, variant: "any" as const }] as const),
  ...MASKABLE_SIZES.map((size) => [`maskable-${size}.png`, { size, variant: "maskable" as const }] as const),
]);

export function generateStaticParams() {
  return [...FILES.keys()].map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const icon = FILES.get((await params).file);
  if (!icon) notFound();
  return renderIcon(icon.size, icon.variant);
}
