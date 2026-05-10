import { Routes, Route, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Configurations from "./pages/Configurations";

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
          <Route path="/configurations" element={<Configurations />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
