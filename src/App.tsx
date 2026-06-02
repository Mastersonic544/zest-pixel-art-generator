import { Routes, Route, Navigate } from "react-router-dom";
import Styleguide from "./routes/Styleguide";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/styleguide" replace />} />
      <Route path="/styleguide" element={<Styleguide />} />
      <Route path="*" element={<Navigate to="/styleguide" replace />} />
    </Routes>
  );
}
