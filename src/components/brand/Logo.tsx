import { brand } from "@/config/brand";

const serif = { fontFamily: "var(--font-playfair), Georgia, serif" };
const sans = { fontFamily: "var(--font-inter), system-ui, sans-serif" };

/** Monogramma "FL" in un cerchio sottile oro (logo provvisorio). */
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label={brand.fullName}
    >
      <circle cx="24" cy="24" r="22.5" fill="none" stroke={brand.colors.oro} strokeWidth="1" />
      <text
        x="24"
        y="24"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="17"
        letterSpacing="0.5"
        fill={brand.colors.prugna}
        style={serif}
      >
        {brand.monogram}
      </text>
    </svg>
  );
}

/** Logo completo impilato: monogramma + "Fabiana L." + "ESTETICA". */
export function Logo({ width = 220, className }: { width?: number; className?: string }) {
  return (
    <svg
      width={width}
      viewBox="0 0 240 150"
      className={className}
      role="img"
      aria-label={brand.fullName}
    >
      <circle cx="120" cy="40" r="36" fill="none" stroke={brand.colors.oro} strokeWidth="1" />
      <text
        x="120"
        y="40"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="28"
        letterSpacing="1"
        fill={brand.colors.prugna}
        style={serif}
      >
        {brand.monogram}
      </text>
      <text x="120" y="112" textAnchor="middle" fontSize="24" fill={brand.colors.prugna} style={serif}>
        {brand.name}
      </text>
      <line x1="96" y1="124" x2="144" y2="124" stroke={brand.colors.oro} strokeWidth="0.75" />
      <text
        x="120"
        y="141"
        textAnchor="middle"
        fontSize="10"
        letterSpacing="4"
        fill={brand.colors.prugna}
        style={sans}
      >
        {brand.tagline.toUpperCase()}
      </text>
    </svg>
  );
}
