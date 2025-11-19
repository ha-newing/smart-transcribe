import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Toaster } from "sonner";

// Pages
import LoginPage from "./pages/auth/LoginPage";
import DashboardLayout from "./components/layout/DashboardLayout";
import TranscribePage from "./pages/transcribe/TranscribePage";
import ProjectsPage from "./pages/projects/ProjectsPage";
import ProjectDetailPage from "./pages/projects/ProjectDetailPage";

function App() {
  const { isLoading } = useAuthActions();
  const currentUser = useQuery(api.users.current);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              currentUser ? (
                <DashboardLayout>
                  <Routes>
                    <Route path="/" element={<Navigate to="/projects" replace />} />
                    <Route path="/projects" element={<ProjectsPage />} />
                    <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
                    <Route path="/transcribe" element={<TranscribePage />} />
                    <Route path="*" element={<Navigate to="/projects" replace />} />
                  </Routes>
                </DashboardLayout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
