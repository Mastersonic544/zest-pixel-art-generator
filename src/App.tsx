import { Routes, Route, Navigate } from "react-router-dom";
import Styleguide from "./routes/Styleguide";
import Settings from "./routes/Settings";
import NewProject from "./routes/NewProject/NewProject";
import ProjectDetail from "./routes/ProjectDetail";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/styleguide" replace />} />
      <Route path="/styleguide" element={<Styleguide />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/project/new" element={<NewProject />} />
      <Route path="/project/:id" element={<ProjectDetail />} />
      <Route path="*" element={<Navigate to="/styleguide" replace />} />
    </Routes>
  );
}
