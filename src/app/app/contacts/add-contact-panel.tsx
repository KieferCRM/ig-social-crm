"use client";

import { useRouter } from "next/navigation";
import ManualLeadForm from "@/app/app/list/manual-lead-form";

export default function AddContactPanel() {
  const router = useRouter();

  return (
    <ManualLeadForm
      onSaved={() => router.push("/app/contacts")}
      onCancel={() => router.push("/app/contacts")}
    />
  );
}
