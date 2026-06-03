import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./routes/Dashboard";
import Settings from "./routes/Settings";
import NewProject from "./routes/NewProject/NewProject";
import ProjectDetail from "./routes/ProjectDetail";
import BuildPage from "./routes/BuildPage";
import Studio from "./routes/Studio/Studio";

// Styleguide is dev-only. React.lazy + Suspense means it is tree-shaken
// from the production bundle entirely (Vite only includes dynamic imports
// that are reachable at runtime, and import.meta.env.DEV is false in prod).
const Styleguide = import.meta.env.DEV
  ? lazy(() => import("./routes/Styleguide"))
  : null;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      {import.meta.env.DEV && Styleguide && (
        <Route
          path="/styleguide"
          element={
            <Suspense fallback={null}>
              <Styleguide />
            </Suspense>
          }
        />
      )}
      <Route path="/settings" element={<Settings />} />
      <Route path="/project/new" element={<NewProject />} />
      <Route path="/project/:id" element={<ProjectDetail />} />
      <Route path="/project/:id/studio" element={<Studio />} />
      <Route path="/build/:shareId" element={<BuildPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
