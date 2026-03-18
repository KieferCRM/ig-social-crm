import { redirect } from "next/navigation";

export default function OnboardingRedirectPage() {
  redirect("/setup/account-type");
}
