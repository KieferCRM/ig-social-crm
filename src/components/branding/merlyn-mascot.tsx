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
        <path
          d="M15 45.5C24.3 41.4 31.6 39.2 40.1 38.7C46.8 38.3 52.4 39 57 41.4C50.1 42.1 43.6 43.6 36.5 45.6C29.5 47.6 22.6 48.3 15 45.5Z"
          className="merlyn-logo__stroke"
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M23.1 38.9C26.6 33.8 29.6 28.8 30.9 23.4C31.8 19.5 33.4 15.5 37.6 13.7C41.4 12 44.3 14.9 44.4 20.2C44.6 25.6 42.1 31.8 40 36.4"
          className="merlyn-logo__stroke"
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M28.3 28.2C31.6 26.8 35.4 26.6 39.6 27.2"
          className="merlyn-logo__accent"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M49.6 20.8L51.3 17.2L53 20.8L56.6 22.5L53 24.2L51.3 27.8L49.6 24.2L46 22.5L49.6 20.8Z"
          className="merlyn-logo__spark"
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
