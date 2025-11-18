import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

// Pages
import LoginPage from "./pages/auth/LoginPage";
import DashboardLayout from "./components/layout/DashboardLayout";
import TranscribePage from "./pages/transcribe/TranscribePage";

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
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            currentUser ? (
              <DashboardLayout>
                <Routes>
                  <Route path="/" element={<Navigate to="/transcribe" replace />} />
                  <Route path="/transcribe" element={<TranscribePage />} />
                  <Route path="*" element={<Navigate to="/transcribe" replace />} />
                </Routes>
              </DashboardLayout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
