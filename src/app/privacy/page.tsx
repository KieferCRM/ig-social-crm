import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/features";

export default function PrivacyPage() {
  return (
    <main className="crm-page">
      <Link href="/" className="crm-btn crm-btn-secondary" style={{ width: "fit-content" }}>
        Back to Site
      </Link>
      <h1>Privacy Policy</h1>
      <p>Effective date: March 9, 2026</p>

      <h2>Our Commitment</h2>
      <p>
        Privacy is part of product quality. {PRODUCT_NAME} is built to help real estate operators capture and manage
        leads with clear controls, strong access boundaries, and practical data safeguards.
      </p>

      <h2>What We Collect</h2>
      <p>Depending on how you use the platform, we may collect:</p>
      <ul>
        <li>Account details (name, email, login/session identifiers).</li>
        <li>Lead data you submit or import (identity fields, source, notes, stage, reminders, timeline history).</li>
        <li>System telemetry (logs, errors, device/network metadata) for security and reliability.</li>
        <li>Support communications.</li>
      </ul>

      <h2>How We Use Data</h2>
      <p>We use data to operate, secure, and improve the service, including to:</p>
      <ul>
        <li>Process intake submissions, imports, and workflow updates.</li>
        <li>Power pipeline, reminders, and follow-up features.</li>
        <li>Detect abuse, prevent fraud, and protect accounts.</li>
        <li>Troubleshoot incidents and maintain service quality.</li>
      </ul>

      <h2>Your Compliance Responsibilities</h2>
      <p>
        If you store or message consumer leads, you are responsible for lawful collection and outreach practices,
        including consent and opt-out handling under applicable law (for example TCPA, CAN-SPAM, DNC, and state
        privacy rules).
      </p>

      <h2>How We Share Information</h2>
      <p>
        We do not sell personal information. We may share data with service providers that help run the platform (for
        example hosting, database, auth, and monitoring vendors), under confidentiality and security obligations.
      </p>

      <h2>Retention and Security</h2>
      <p>
        We retain data only as long as needed for service operation, security/audit needs, dispute resolution, and
        legal obligations. We use layered safeguards such as encrypted transport, access controls, and monitoring.
      </p>
      <p>
        No platform can guarantee absolute security, but we design for strong operational discipline and rapid issue
        response.
      </p>

      <h2>Your Rights</h2>
      <p>
        Depending on your location, you may have rights to access, correct, delete, or export personal information.
        Submit requests through your account support channel.
      </p>

      <h2>Children</h2>
      <p>{PRODUCT_NAME} is intended for professional use and not directed to children under 13.</p>

      <h2>Policy Changes</h2>
      <p>
        We may update this Privacy Policy. Material updates are reflected with a new effective date and, when
        appropriate, additional notice.
      </p>

      <h2>Contact</h2>
      <p>For privacy requests or questions, use the support channel linked to your account.</p>
    </main>
  );
}
