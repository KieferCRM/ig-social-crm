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
  const hatId = "merlynHatGold";
  const brimId = "merlynBrimGold";
  const keyId = "merlynKeyGold";
  const shadowId = "merlynNavyShadow";

  const ariaProps = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": title };

  return (
    <div className={`merlyn-familiar ${className || ""}`.trim()} {...ariaProps}>
      <svg className="merlyn-glyph" viewBox="0 0 160 160">
        <defs>
          <linearGradient id={hatId} x1="52" y1="20" x2="106" y2="82" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#efd999" />
            <stop offset="56%" stopColor="#d5b56a" />
            <stop offset="100%" stopColor="#b38b3d" />
          </linearGradient>
          <linearGradient id={brimId} x1="18" y1="75" x2="134" y2="75" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#e7cd86" />
            <stop offset="52%" stopColor="#cfaa58" />
            <stop offset="100%" stopColor="#af863a" />
          </linearGradient>
          <linearGradient id={keyId} x1="64" y1="87" x2="101" y2="149" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#efd999" />
            <stop offset="52%" stopColor="#d9b96c" />
            <stop offset="100%" stopColor="#b88f44" />
          </linearGradient>
          <linearGradient id={shadowId} x1="22" y1="10" x2="130" y2="152" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#16314c" />
            <stop offset="100%" stopColor="#09192b" />
          </linearGradient>
        </defs>

        {variant === "full" ? (
          <>
            <path
              d="M57 18C65 10 76 9 85 15C96 22 99 36 95 50C104 50 112 52 118 57C123 62 126 68 127 76C114 71 97 69 79 70C61 71 39 76 18 85C24 72 34 64 48 59C54 57 59 55 63 54C58 47 55 37 57 18Z"
              fill={`url(#${hatId})`}
            />
            <path
              d="M18 86C42 73 61 67 82 66C103 65 120 69 136 79C118 78 99 80 80 84C60 88 40 92 18 86Z"
              fill={`url(#${brimId})`}
            />
            <path
              d="M67 53C72 45 82 42 91 42C100 43 108 46 116 51C105 50 95 51 87 54C79 57 73 60 67 62C67 59 67 56 67 53Z"
              fill={`url(#${shadowId})`}
              opacity="0.88"
            />
            <circle cx="79" cy="100" r="23" fill="none" stroke={`url(#${keyId})`} strokeWidth="8" />
            <path d="M79 123V147" stroke={`url(#${keyId})`} strokeWidth="9" strokeLinecap="round" />
            <path
              d="M79 147H101V139H90V132H101V124H79"
              fill="none"
              stroke={`url(#${keyId})`}
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M55 28C60 33 61 41 58 49C54 56 46 63 38 70C38 58 42 45 47 35C49 31 52 29 55 28Z" fill={`url(#${shadowId})`} />
            <path d="M31 98L35 89L39 98L48 102L39 106L35 115L31 106L22 102L31 98Z" fill="#f6e6b8" />
            <path d="M46 54L49 48L52 54L58 57L52 60L49 66L46 60L40 57L46 54Z" fill="#f1ddb0" />
          </>
        ) : (
          <>
            <path
              d="M54 24C61 17 71 16 79 21C89 27 91 38 88 50C96 50 103 52 109 57C113 61 116 67 116 73C105 69 91 67 76 68C61 69 43 73 27 81C31 69 40 61 51 57C56 55 60 53 63 52C58 46 55 37 54 24Z"
              fill={`url(#${hatId})`}
            />
            <path
              d="M26 82C46 72 62 67 80 66C97 65 112 68 126 76C111 75 95 77 79 80C62 84 45 87 26 82Z"
              fill={`url(#${brimId})`}
            />
            <circle cx="79" cy="104" r="18" fill="none" stroke={`url(#${keyId})`} strokeWidth="8" />
            <path d="M79 122V143" stroke={`url(#${keyId})`} strokeWidth="9" strokeLinecap="round" />
            <path
              d="M79 143H97V136H88V129H97V122H79"
              fill="none"
              stroke={`url(#${keyId})`}
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M55 31C59 35 60 42 57 49C53 55 47 61 40 67C40 57 43 47 47 39C49 35 52 32 55 31Z" fill={`url(#${shadowId})`} />
          </>
        )}
      </svg>
      <div className="merlyn-sigil-ring" />
    </div>
  );
}
