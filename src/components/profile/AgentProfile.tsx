import type { PublicProfile } from "./WholesalerProfile";

// Traditional agent profile template — not yet built.
export default function AgentProfile({ profile }: { profile: PublicProfile }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          {profile.fullName || profile.companyName} — profile coming soon.
        </p>
      </div>
    </div>
  );
}
