import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import WebhookConfigurations from "./pages/WebhookConfigurations";
import AutomatedSummaries from "./pages/AutomatedSummaries";

function App() {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <div className="h-screen bg-discord-900 text-discord-200">
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          currentPath={currentPath}
        />

        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/configurations" element={<Navigate to="/configurations/webhooks" />} />
          <Route path="/configurations/webhooks" element={<WebhookConfigurations />} />
          <Route path="/configurations/summaries" element={<AutomatedSummaries />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
