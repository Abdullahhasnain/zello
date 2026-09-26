// Keep deployment availability distinct from unfinished admin functionality.
export default function RootPage() {
  return (
    <main style={{ maxWidth: 640, margin: "80px auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1>Zello AI — Ops Console</h1>
      <p>This service is deployed. Platform administration screens are not implemented yet.</p>
      <p>The merchant dashboard is available for managing your store catalog and orders.</p>
      <a href="https://zello-ai-dashboard-production.up.railway.app/dashboard">
        Open merchant dashboard
      </a>
    </main>
  );
}
