const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const PERCENT = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

export function parseDecimalValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^\d.-]/g, "").trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function parsePositiveDecimal(value: unknown): number | null {
  const parsed = parseDecimalValue(value);
  if (parsed === null || parsed <= 0) return null;
  return parsed;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateCommissionAmount(
  dealPrice: number | null,
  commissionPercent: number | null
): number | null {
  if (dealPrice === null || commissionPercent === null) return null;
  if (dealPrice <= 0 || commissionPercent <= 0) return null;
  return roundMoney((dealPrice * commissionPercent) / 100);
}

export function formatCurrency(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "No data yet";
  return CURRENCY.format(value);
}

export function formatPercentLabel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${PERCENT.format(value)}%`;
}

export function asInputNumber(value: number | string | null | undefined, digits = 2): string {
  const parsed = parseDecimalValue(value);
  if (parsed === null) return "";
  const fixed = parsed.toFixed(digits);
  return fixed.replace(/\.?0+$/, "");
}

export function asInputDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}
