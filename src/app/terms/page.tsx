import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/features";

export default function TermsPage() {
  return (
    <main className="crm-page">
      <Link href="/" className="crm-btn crm-btn-secondary" style={{ width: "fit-content" }}>
        Back to Site
      </Link>
      <h1>Terms of Service</h1>
      <p>Effective date: March 9, 2026</p>

      <h2>Using {PRODUCT_NAME}</h2>
      <p>
        By accessing or using {PRODUCT_NAME}, you agree to these Terms. If you do not agree, please do not use the
        service.
      </p>

      <h2>What the Service Is</h2>
      <p>
        {PRODUCT_NAME} is software for lead capture, ingestion, pipeline management, and follow-up execution. It is a
        business tool, not legal, brokerage, tax, lending, or financial advice.
      </p>

      <h2>Accounts and Security</h2>
      <p>
        You are responsible for your account credentials and all activity under your account. Notify us promptly if you
        believe your account has been compromised.
      </p>

      <h2>Compliance Is Your Responsibility</h2>
      <p>
        You are responsible for using the platform in compliance with applicable law and professional obligations,
        including consent, outreach, and recordkeeping requirements (for example TCPA, CAN-SPAM, DNC, privacy rules,
        and brokerage/MLS policies).
      </p>

      <h2>Acceptable Use</h2>
      <p>You may not use the service to:</p>
      <ul>
        <li>Send unlawful spam or unauthorized automated communications.</li>
        <li>Misuse personal data or violate privacy rights.</li>
        <li>Attempt unauthorized access or disrupt platform security.</li>
        <li>Violate third-party platform terms connected to your workflows.</li>
      </ul>

      <h2>Your Data</h2>
      <p>
        You keep ownership of your content and CRM data. You grant us a limited license to host, process, and transmit
        that data only as needed to provide and support the service.
      </p>

      <h2>Availability and Product Changes</h2>
      <p>
        We aim for reliable service, but uninterrupted uptime is not guaranteed. We may improve, change, or retire
        features over time.
      </p>

      <h2>Third-Party Services</h2>
      <p>
        The platform depends on third-party infrastructure and integrations. Their availability and policies are outside
        our direct control.
      </p>

      <h2>Warranty Disclaimer</h2>
      <p>
        To the extent permitted by law, the service is provided "as is" and "as available," without warranties of any
        kind.
      </p>

      <h2>Limitation of Liability</h2>
      <p>
        To the extent permitted by law, we are not liable for indirect, incidental, special, consequential, or
        punitive damages, or for lost profits, revenue, business opportunities, goodwill, or data.
      </p>

      <h2>Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless the operator of {PRODUCT_NAME} from claims arising from your use of
        the service, your content, or your violation of law or third-party rights.
      </p>

      <h2>Termination</h2>
      <p>
        We may suspend or terminate access for material violations of these Terms, abuse of the service, security risk,
        or legal/compliance requirements.
      </p>

      <h2>Updates to These Terms</h2>
      <p>
        We may update these Terms periodically. Continued use after updates take effect means you accept the revised
        Terms.
      </p>

      <h2>Contact</h2>
      <p>For questions about these Terms, use the support channel associated with your account.</p>
    </main>
  );
}
