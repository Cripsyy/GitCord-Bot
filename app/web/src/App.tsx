import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import RepositoryConnections from "./pages/RepositoryConnections";
import AutomatedSummaries from "./pages/AutomatedSummaries";
import Leaderboard from "./pages/Leaderboard";
import LeaderboardConfigPage from "./pages/LeaderboardConfigPage";

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
          <Route path="/configurations" element={<Navigate to="/configurations/connections" />} />
          <Route path="/configurations/connections" element={<RepositoryConnections />} />
          <Route path="/configurations/summaries" element={<AutomatedSummaries />} />
          <Route path="/configurations/leaderboard" element={<LeaderboardConfigPage />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
