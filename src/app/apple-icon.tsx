import { renderIcon } from "@/lib/pwa/icon";

// Icona per "Aggiungi alla schermata Home" su iPhone (iOS arrotonda da solo gli angoli).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderIcon(180, "apple");
}
