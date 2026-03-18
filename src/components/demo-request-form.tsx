"use client";

import { useRef, useState } from "react";
import { submitDemoRequest } from "@/app/actions/demo-request";

export default function DemoRequestForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");

    const formData = new FormData(e.currentTarget);
    const result = await submitDemoRequest(formData);

    if (result.success) {
      setStatus("success");
      formRef.current?.reset();
    } else {
      setStatus("error");
      setErrorMsg(result.error ?? "Something went wrong.");
    }
  }

  if (status === "success") {
    return (
      <div className="lockbox-demo-success">
        <strong>Got it — we'll be in touch soon.</strong>
        <p>You'll hear from us within one business day to schedule your demo.</p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="lockbox-demo-form">
      <div className="lockbox-demo-form__fields">
        <input
          type="text"
          name="name"
          placeholder="Your name"
          required
          className="lockbox-demo-form__input"
        />
        <input
          type="email"
          name="email"
          placeholder="Your email"
          required
          className="lockbox-demo-form__input"
        />
        <textarea
          name="note"
          placeholder="Anything you'd like us to know? (optional)"
          rows={3}
          className="lockbox-demo-form__input lockbox-demo-form__textarea"
        />
      </div>

      {status === "error" && (
        <p className="lockbox-demo-form__error">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="lockbox-button lockbox-button-primary"
      >
        {status === "loading" ? "Sending…" : "Request a Demo"}
      </button>
    </form>
  );
}
