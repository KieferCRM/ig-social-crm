import { redirect } from "next/navigation";

export default function SignupPage() {
  redirect("/auth?mode=sign_up");
}
