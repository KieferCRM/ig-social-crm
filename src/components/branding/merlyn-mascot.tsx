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
  const outlineId = "merlynHatOutline";
  const accentId = "merlynHatAccent";

  const ariaProps = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": title };

  return (
    <div className={`merlyn-familiar ${className || ""}`.trim()} {...ariaProps}>
      <svg className="merlyn-glyph" viewBox="0 0 120 120" fill="none">
        <defs>
          <linearGradient id={outlineId} x1="22" y1="20" x2="95" y2="86" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f1ddb0" />
            <stop offset="55%" stopColor="#d3ae63" />
            <stop offset="100%" stopColor="#b88839" />
          </linearGradient>
          <linearGradient id={accentId} x1="42" y1="40" x2="78" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#e8cc8a" />
            <stop offset="100%" stopColor="#c79843" />
          </linearGradient>
        </defs>

        {variant === "full" ? (
          <>
            <path
              d="M33 74C49 67 61 63 74 62C84 61 93 62 100 66C90 67 80 69 68 72C56 75 45 77 33 74Z"
              stroke={`url(#${outlineId})`}
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M45 63C50 55 54 47 56 38C57 29 60 22 66 19C72 16 76 22 76 30C76 38 72 48 69 58"
              stroke={`url(#${outlineId})`}
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M53 46C58 44 64 44 70 45"
              stroke={`url(#${accentId})`}
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M79 35L82 29L85 35L91 38L85 41L82 47L79 41L73 38L79 35Z"
              fill="#f2ddb0"
              opacity="0.9"
            />
          </>
        ) : (
          <>
            <path
              d="M31 72C46 66 58 63 71 62C81 61 89 62 95 65C85 66 76 68 65 71C54 74 43 75 31 72Z"
              stroke={`url(#${outlineId})`}
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M43 61C48 53 52 46 54 38C55 30 58 24 63 21C69 18 72 24 72 31C72 39 69 48 66 56"
              stroke={`url(#${outlineId})`}
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M51 45C56 43 61 43 66 44"
              stroke={`url(#${accentId})`}
              strokeWidth="4"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
      <div className="merlyn-sigil-ring" />
    </div>
  );
}
