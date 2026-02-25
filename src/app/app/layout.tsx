export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div style={{ padding: 24 }}>{children}</div>;
}