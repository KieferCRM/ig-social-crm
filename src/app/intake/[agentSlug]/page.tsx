import Link from "next/link";
import { notFound } from "next/navigation";
import LockboxMark from "@/components/branding/lockbox-mark";
import FormRenderer from "@/components/forms/FormRenderer";
import { FORM_ROUTER_OPTIONS, FORM_TEMPLATES } from "@/lib/forms/templates";

export const dynamic = "force-dynamic";

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export default async function AgentIntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ agentSlug: string }>;
  searchParams: Promise<{ form?: string }>;
}) {
  const { agentSlug } = await params;
  const { form } = await searchParams;
  const normalizedSlug = normalizeSlug(decodeURIComponent(agentSlug || ""));

  if (!normalizedSlug) {
    notFound();
  }

  // If a specific form type is requested, render it directly
  if (form && FORM_TEMPLATES[form]) {
    return (
      <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px 16px 48px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ marginBottom: 16 }}>
            <Link
              href={`/intake/${normalizedSlug}`}
              style={{ fontSize: 13, color: "var(--ink-muted)", textDecoration: "none" }}
            >
              ← Back
            </Link>
          </div>
          <FormRenderer formType={form} agentSlug={normalizedSlug} />
        </div>
      </main>
    );
  }

  // Default: show the 7-option router
  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "40px 16px 64px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <LockboxMark variant="full" decorative style={{ height: 36, marginBottom: 24 }} />
          <h1 style={{ margin: "0 0 8px", fontSize: "clamp(1.6rem, 4vw, 2.2rem)" }}>
            What best describes you?
          </h1>
          <p style={{ margin: 0, color: "var(--ink-muted, #64748b)", fontSize: 16 }}>
            Select the option that fits your situation and we&apos;ll get you the right form.
          </p>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {FORM_ROUTER_OPTIONS.map((option) => (
            <Link
              key={option.form_type}
              href={`/intake/${normalizedSlug}?form=${option.form_type}`}
              style={{
                display: "block",
                padding: "18px 24px",
                background: "#ffffff",
                border: "1.5px solid #e2e8f0",
                borderRadius: 12,
                textDecoration: "none",
                color: "#0f172a",
                fontWeight: 600,
                fontSize: 16,
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
            >
              {option.label}
            </Link>
          ))}
        </div>

        <p style={{ marginTop: 32, textAlign: "center", fontSize: 12, color: "#94a3b8" }}>
          Powered by LockboxHQ
        </p>
      </div>
    </main>
  );
}
