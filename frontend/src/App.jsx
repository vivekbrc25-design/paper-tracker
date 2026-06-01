/* eslint-disable react/prop-types */
import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { canAccessPath, getDefaultRoute } from "./access.js";
import { ConfigPage } from "./components/Config.jsx";
import { FeedbackProvider } from "./components/Feedback.jsx";
import { AppShell } from "./components/Layout.jsx";
import { LoginPage } from "./components/Login.jsx";
import { PapersPage } from "./components/Papers.jsx";
import { ReportsPage } from "./components/Reports.jsx";
import { VerificationPage } from "./components/Verification.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { WorkspaceProvider } from "./context/WorkspaceContext.jsx";

const AnalyticsCheckPage = lazy(() => import("./components/AnalyticsCheck.jsx").then((module) => ({ default: module.AnalyticsCheckPage })));

function ProtectedApp() {
  const { checkingAuth, isAuthenticated, user } = useAuth();

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm font-semibold text-slate-700">
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
            path="/papers/analytic-check"
            element={
              <AuthorizedRoute path="/papers/analytic-check">
                <Suspense fallback={<RouteLoadingMessage message="Loading analytics workspace..." />}>
                  <AnalyticsCheckPage />
                </Suspense>
              </AuthorizedRoute>
            }
          />
          <Route
            path="/papers/verification"
            element={
              <AuthorizedRoute path="/papers/verification">
                <VerificationPage />
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

function RouteLoadingMessage({ message }) {
  return (
    <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 shadow-sm">
      {message}
    </div>
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
