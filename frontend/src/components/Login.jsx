import { useState } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { useFeedback } from "./Feedback.jsx";

export function LoginPage() {
  const { isAuthenticated, login, checkingAuth } = useAuth();
  const { showToast } = useFeedback();
  const [form, setForm] = useState({
    userId: "adminbrc",
    password: "brc@123",
  });
  const [submitting, setSubmitting] = useState(false);

  if (!checkingAuth && isAuthenticated) {
    return <Navigate replace to="/papers" />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.18),_transparent_42%),linear-gradient(180deg,_#e2e8f0_0%,_#f8fafc_30%,_#ffffff_100%)] p-6">
        <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl shadow-slate-300/40">
          <div className="border-b border-slate-700 bg-slate-800 p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-white p-3 text-slate-900">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">Paper Flow</p>
                <h1 className="text-xl font-bold text-white">Workspace Login</h1>
              </div>
            </div>
            <p className="text-sm text-slate-300">Sign in with an authorized Paper Tracker account to access the workspace.</p>
          </div>

          <div className="p-8">
            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-600">
              Slate navigation and header are now paired with a bright white workspace for easier scanning.
            </div>

            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                setSubmitting(true);
                try {
                  await login(form.userId.trim(), form.password);
                  showToast("Logged in successfully", "success");
                } catch (error) {
                  showToast(error.message, "error");
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">User ID</label>
                <input
                  value={form.userId}
                  onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-slate-700"
                  placeholder="adminbrc"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-slate-700"
                  placeholder="Enter password"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || checkingAuth}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Signing In..." : "Login"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
