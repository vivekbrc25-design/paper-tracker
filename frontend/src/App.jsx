/* eslint-disable react/prop-types */
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { canAccessPath, getDefaultRoute } from "./access.js";
import { ConfigPage } from "./components/Config.jsx";
import { FeedbackProvider } from "./components/Feedback.jsx";
import { AppShell } from "./components/Layout.jsx";
import { LoginPage } from "./components/Login.jsx";
import { PapersPage } from "./components/Papers.jsx";
import { ReportsPage } from "./components/Reports.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { WorkspaceProvider } from "./context/WorkspaceContext.jsx";

function ProtectedApp() {
  const { checkingAuth, isAuthenticated, user } = useAuth();

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm font-semibold text-slate-300">
        Checking session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate replace to="/login" />;
  }

  return (
    <WorkspaceProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate replace to={getDefaultRoute(user?.role)} />} />
          <Route
            path="/papers"
            element={
              <AuthorizedRoute path="/papers">
                <PapersPage />
              </AuthorizedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <AuthorizedRoute path="/reports">
                <ReportsPage />
              </AuthorizedRoute>
            }
          />
          <Route
            path="/config"
            element={
              <AuthorizedRoute path="/config">
                <ConfigPage />
              </AuthorizedRoute>
            }
          />
        </Route>
      </Routes>
    </WorkspaceProvider>
  );
}

function AuthorizedRoute({ path, children }) {
  const { user } = useAuth();

  if (!canAccessPath(user?.role, path)) {
    return <Navigate replace to={getDefaultRoute(user?.role)} />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <FeedbackProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={<ProtectedApp />} />
          </Routes>
        </AuthProvider>
      </FeedbackProvider>
    </BrowserRouter>
  );
}

export default App;
