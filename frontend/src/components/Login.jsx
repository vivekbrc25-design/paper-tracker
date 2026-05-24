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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0f172a] p-8 shadow-2xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl bg-brand-500 p-3 text-white">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">Paper Flow</p>
              <h1 className="text-xl font-bold text-white">Workspace Login</h1>
            </div>
          </div>

          <p className="mb-6 text-sm text-slate-400">Sign in with an authorized Paper Tracker account to access the workspace.</p>

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
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">User ID</label>
              <input
                value={form.userId}
                onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-brand-500"
                placeholder="adminbrc"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-brand-500"
                placeholder="Enter password"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || checkingAuth}
              className="w-full rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Signing In..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
