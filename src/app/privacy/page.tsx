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

      <h2>SMS and Text Messaging</h2>
      <p>
        {PRODUCT_NAME} enables real estate agents to send SMS messages to leads who have provided their phone number
        and consented to receive communications through an intake form or other opt-in mechanism.
      </p>
      <ul>
        <li>
          <strong>How we collect phone numbers:</strong> Phone numbers are collected through agent-controlled intake
          forms. Submission of the form constitutes consent to receive follow-up SMS communications from the agent.
        </li>
        <li>
          <strong>Types of messages sent:</strong> Transactional and relationship-based messages related to real estate
          inquiries, lead follow-up, appointment reminders, and CRM workflow notifications.
        </li>
        <li>
          <strong>Message frequency:</strong> Message frequency varies based on agent activity and lead engagement.
        </li>
        <li>
          <strong>Opting out:</strong> Recipients can reply <strong>STOP</strong> at any time to unsubscribe from SMS
          communications. Reply <strong>HELP</strong> for assistance. Standard message and data rates may apply.
        </li>
        <li>
          <strong>No third-party marketing sharing:</strong> Phone numbers and SMS consent are never sold or shared with
          third parties for marketing purposes.
        </li>
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
