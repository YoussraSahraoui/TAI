import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import EntitiesPage from "./pages/EntitiesPage";
import ConstraintsPage from "./pages/ConstraintsPage";
import SolverPage from "./pages/SolverPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/entities" element={<EntitiesPage />} />
          <Route path="/constraints" element={<ConstraintsPage />} />
          <Route path="/solver" element={<SolverPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
