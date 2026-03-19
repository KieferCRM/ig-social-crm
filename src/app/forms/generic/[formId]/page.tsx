import { notFound } from "next/navigation";
import LockboxMark from "@/components/branding/lockbox-mark";
import { supabaseAdmin } from "@/lib/supabase/admin";
import GenericFormRenderer from "@/components/forms/GenericFormRenderer";

export const dynamic = "force-dynamic";

export type GenericQuestion = {
  id: string;
  label: string;
  type: "text" | "dropdown" | "yesno";
  required?: boolean;
  options?: string[];
};

export type GenericForm = {
  id: string;
  agent_id: string;
  title: string;
  description: string | null;
  questions: GenericQuestion[];
};

export default async function GenericFormPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
  const admin = supabaseAdmin();

  const { data: form } = await admin
    .from("generic_forms")
    .select("id, agent_id, title, description, questions")
    .eq("id", formId)
    .maybeSingle();

  if (!form) notFound();

  const typedForm: GenericForm = {
    id: form.id as string,
    agent_id: form.agent_id as string,
    title: form.title as string,
    description: form.description as string | null,
    questions: (form.questions as GenericQuestion[]) || [],
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
