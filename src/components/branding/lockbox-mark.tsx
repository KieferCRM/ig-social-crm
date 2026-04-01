type LockboxMarkProps = {
  className?: string;
  decorative?: boolean;
  title?: string;
  variant?: "icon" | "full";
  tone?: "light" | "dark";
};

export default function LockboxMark({
  className,
  decorative = true,
  title = "LockboxHQ logo",
  variant = "icon",
  tone = "light",
}: LockboxMarkProps) {
  const ariaProps = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": title };

  return (
    <span
      className={`lockbox-mark lockbox-mark-${variant} lockbox-mark-${tone}${className ? ` ${className}` : ""}`}
      {...ariaProps}
    >
      <svg className="lockbox-mark__icon" viewBox="0 0 72 72" fill="none">
        <rect x="14" y="14" width="44" height="44" rx="18" className="lockbox-mark__shield" />
        <path
          d="M24 45.5L35.4 23.5C35.8 22.7 36.9 22.7 37.3 23.5L48 45.5"
          className="lockbox-mark__stroke"
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M29.8 35.8H42.3"
          className="lockbox-mark__accent"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M22.5 47.8H49.5"
          className="lockbox-mark__stroke"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <path
          d="M47.9 20.5L49.2 17.5L50.5 20.5L53.5 21.8L50.5 23.1L49.2 26.1L47.9 23.1L44.9 21.8L47.9 20.5Z"
          className="lockbox-mark__spark"
        />
      </svg>

      {variant === "full" ? (
        <span className="lockbox-mark__wordmark">
          <span className="lockbox-mark__name">LockboxHQ</span>
          <span className="lockbox-mark__tag">Smart CRM</span>
        </span>
      ) : null}
    </span>
  );
}
