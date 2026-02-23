
export default function Home() {
  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      fontFamily: "Arial",
      backgroundColor: "#0f172a",
      color: "white"
    }}>
      <h1 style={{ fontSize: "48px", marginBottom: "16px" }}>
        IG Social CRM
      </h1>
      <p style={{ fontSize: "18px", opacity: 0.7 }}>
        Built for solo real estate agents.
      </p>
    </main>
  );
}