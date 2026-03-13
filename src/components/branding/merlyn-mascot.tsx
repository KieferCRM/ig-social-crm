type MerlynMascotProps = {
  className?: string;
  decorative?: boolean;
  title?: string;
  variant?: "icon" | "full";
  tone?: "light" | "dark";
};

export default function MerlynMascot({
  className,
  decorative = true,
  title = "Merlyn logo",
  variant = "icon",
  tone = "light",
}: MerlynMascotProps) {
  const ariaProps = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": title };

  return (
    <span
      className={`merlyn-logo merlyn-logo-${variant} merlyn-logo-${tone}${className ? ` ${className}` : ""}`}
      {...ariaProps}
    >
      <svg className="merlyn-logo__icon" viewBox="0 0 72 72" fill="none">
        <circle cx="36" cy="36" r="26" className="merlyn-logo__ring" strokeWidth="1.8" />
        <path
          d="M17 43.2C28.6 38.7 42.3 38.4 55 42.8"
          className="merlyn-logo__stroke"
          strokeWidth="3.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M26.2 39.2L31.7 21.9C32.6 19.1 35.8 17.8 38.4 19.2L49 24.9C51.1 26 50.5 29.1 48.2 29.4L39.7 30.4L44.2 39.2"
          className="merlyn-logo__stroke"
          strokeWidth="3.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M29.5 28.6C33 27.2 36.8 27.1 40.8 28.1"
          className="merlyn-logo__accent"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <path
          d="M50.6 18.2L51.9 15.2L53.2 18.2L56.2 19.5L53.2 20.8L51.9 23.8L50.6 20.8L47.6 19.5L50.6 18.2Z"
          className="merlyn-logo__spark"
        />
        <path
          d="M20.5 49.4C29.2 54.6 42.7 55.1 51.7 50.3"
          className="merlyn-logo__trail"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>

      {variant === "full" ? (
        <span className="merlyn-logo__wordmark">
          <span className="merlyn-logo__name">Merlyn</span>
          <span className="merlyn-logo__tag">Inbound Lead CRM</span>
        </span>
      ) : null}
    </span>
  );
}
