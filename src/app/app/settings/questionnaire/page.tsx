import { redirect } from "next/navigation";

export default function LegacyQuestionnaireRedirectPage() {
  redirect("/app/intake/questionnaire");
}
