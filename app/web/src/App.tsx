import { useMemo, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import type { Overview } from "./types";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Configurations from "./pages/Configurations";

function App() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [appStatus, setAppStatus] = useState("Ready");
  const location = useLocation();

  const headers = useMemo(() => ({}), []);

  async function handleRefresh() {
    setAppStatus("Refreshing...");
    try {
      const response = await fetch("/api/dashboard/overview", { headers });
      if (response.ok) {
        setOverview(await response.json());
      }
      setAppStatus("Live");
    } catch {
      setAppStatus("Refresh failed");
    }
  }

  const currentPath = location.pathname;

  return (
    <div className="min-h-screen bg-discord-900 text-discord-200">
      <div className="flex min-h-screen">
        <Sidebar
          overview={overview}
          status={appStatus}
          onRefresh={handleRefresh}
          currentPath={currentPath}
        />

        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/configurations" element={<Configurations />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
