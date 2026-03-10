import { useId } from "react";

type MerlynMascotProps = {
  className?: string;
  decorative?: boolean;
  title?: string;
  variant?: "full" | "icon";
};

export default function MerlynMascot({
  className,
  decorative = true,
  title = "Merlyn logo",
  variant = "full",
}: MerlynMascotProps) {
  const uid = useId().replace(/:/g, "");
  const hatId = `merlynWizardHat-${uid}`;
  const robeId = `merlynWizardRobe-${uid}`;
  const accentId = `merlynWizardAccent-${uid}`;
  const glowId = `merlynWizardGlow-${uid}`;

  const ariaProps = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": title };

  return (
    <div className={`merlyn-familiar ${className || ""}`.trim()} {...ariaProps}>
      <svg className="merlyn-glyph" viewBox="0 0 120 120">
        <defs>
          <linearGradient id={hatId} x1="30" y1="18" x2="88" y2="62" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#95BFFF" />
            <stop offset="52%" stopColor="#4F7ECC" />
            <stop offset="100%" stopColor="#25345A" />
          </linearGradient>
          <linearGradient id={robeId} x1="26" y1="50" x2="93" y2="108" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#223C67" />
            <stop offset="100%" stopColor="#101A31" />
          </linearGradient>
          <linearGradient id={accentId} x1="86" y1="46" x2="103" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22C55E" />
            <stop offset="100%" stopColor="#16A34A" />
          </linearGradient>
          <radialGradient id={glowId} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(97 45) rotate(90) scale(11)">
            <stop offset="0%" stopColor="#B8FFD7" />
            <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
          </radialGradient>
        </defs>

        {variant === "icon" ? (
          <>
            <circle cx="60" cy="60" r="46" fill="#0F1A2E" stroke="#90BFFF" strokeOpacity="0.45" strokeWidth="2" />
            <path d="M35 52 L60 21 L85 52 Z" fill={`url(#${hatId})`} />
            <path d="M30 54 Q60 46 90 54 Q60 62 30 54 Z" fill="#1B2E4F" />
            <path d="M42 66 L60 58 L78 66 L71 86 L60 97 L49 86 Z" fill="#E7F2FF" />
            <path d="M88 44 L88 87" stroke={`url(#${accentId})`} strokeWidth="4" strokeLinecap="round" />
            <circle cx="88" cy="42" r="6" fill="#22C55E" />
            <circle cx="88" cy="42" r="10" fill={`url(#${glowId})`} />
          </>
        ) : (
          <>
            <path d="M23 97 C33 71 46 60 60 60 C74 60 87 71 97 97 Z" fill={`url(#${robeId})`} />
            <path d="M35 54 L60 16 L85 54 Z" fill={`url(#${hatId})`} />
            <path d="M27 56 Q60 45 93 56 Q60 66 27 56 Z" fill="#192A47" />

            <path d="M45 66 Q60 59 75 66 L69 89 Q60 102 51 89 Z" fill="#EFF7FF" />
            <path d="M46 67 Q60 75 74 67" stroke="#CFE2FF" strokeWidth="2" strokeLinecap="round" />
            <path d="M54 74 Q60 79 66 74" stroke="#DCEBFF" strokeWidth="2.2" strokeLinecap="round" />

            <circle cx="60" cy="61" r="6.5" fill="#E3BECA" />
            <path d="M56 61.5 a1.4 1.4 0 1 0 0.01 0 M64 61.5 a1.4 1.4 0 1 0 0.01 0" fill="#121C31" />

            <path d="M91 43 L91 92" stroke={`url(#${accentId})`} strokeWidth="4.6" strokeLinecap="round" />
            <circle cx="91" cy="41" r="6.8" fill="#22C55E" />
            <circle cx="91" cy="41" r="12" fill={`url(#${glowId})`} />
          </>
        )}
      </svg>
      <div className="merlyn-sigil-ring" />
    </div>
  );
}
