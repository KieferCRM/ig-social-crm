import { notFound } from "next/navigation";
import LockboxMark from "@/components/branding/lockbox-mark";
import GenericFormRenderer from "@/components/forms/GenericFormRenderer";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { GenericForm } from "@/app/forms/generic/[formId]/page";

export const dynamic = "force-dynamic";

export default async function GenericShortPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const admin = supabaseAdmin();

  const { data: form } = await admin
    .from("generic_forms")
    .select("id, agent_id, title, description, questions")
    .eq("short_code", code)
    .maybeSingle();

  if (!form) notFound();

  const typedForm: GenericForm = {
    id: form.id as string,
    agent_id: form.agent_id as string,
    title: form.title as string,
    description: form.description as string | null,
    questions: (form.questions as GenericForm["questions"]) || [],
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px 16px 48px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <LockboxMark variant="full" decorative />
        </div>
        <GenericFormRenderer form={typedForm} />
      </div>
    </main>
  );
}
