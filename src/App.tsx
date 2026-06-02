import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./routes/Dashboard";
import Styleguide from "./routes/Styleguide";
import Settings from "./routes/Settings";
import NewProject from "./routes/NewProject/NewProject";
import ProjectDetail from "./routes/ProjectDetail";
import BuildPage from "./routes/BuildPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/styleguide" element={<Styleguide />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/project/new" element={<NewProject />} />
      <Route path="/project/:id" element={<ProjectDetail />} />
      <Route path="/build/:shareId" element={<BuildPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
