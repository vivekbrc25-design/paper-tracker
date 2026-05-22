import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { useFeedback } from "./Feedback.jsx";

const navItems = [
  { to: "/papers", label: "Paper Entry", key: "papers" },
  { to: "/reports", label: "Reports & KPIs", key: "reports" },
  { to: "/config", label: "Config Masters", key: "config" },
];

const titles = {
  "/papers": "Paper Tracking Workspace",
  "/reports": "Reports & Evaluation Insights",
  "/config": "Configuration & Entities Master",
};

function NavIcon({ name }) {
  if (name === "reports") {
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m6 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14" />
      </svg>
    );
  }
  if (name === "config") {
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

export function AppShell() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const { busy, theme, setTheme, resetWorkspace } = useWorkspace();
  const { confirm, showToast } = useFeedback();
  const location = useLocation();
  const navigate = useNavigate();

  const workspaceTitle = titles[location.pathname] ?? "Paper Tracking Workspace";

  const handleReset = async () => {
    const accepted = await confirm("Are you sure you want to restore all datasets to default templates?");
    if (!accepted) {
      return;
    }
    await resetWorkspace();
    showToast("All workspace datasets restored to default templates", "success");
  };

  const handleLogout = async () => {
    showToast("Session closed. Returning to landing desk...", "info");
    await resetWorkspace();
    navigate("/papers");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex h-screen flex-1 overflow-hidden">
        <aside
          className={`z-20 flex shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-[#0f172a] ${
            isSidebarExpanded ? "w-64" : "w-20"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="shrink-0 rounded-lg bg-brand-500 p-2 text-white">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              {isSidebarExpanded && (
                <div>
                  <h1 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Paper Flow</h1>
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">Exam Control Desk</p>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarExpanded((current) => !current)}
              className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <svg className={`h-4 w-4 transition-transform duration-300 ${isSidebarExpanded ? "rotate-0" : "rotate-180"}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-500"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-100"
                  }`
                }
              >
                <NavIcon name={item.key} />
                {isSidebarExpanded && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs font-bold uppercase text-white shadow-inner">
                AD
              </div>
              {isSidebarExpanded && (
                <div className="overflow-hidden">
                  <h4 className="text-xs font-semibold text-slate-400">Admin</h4>
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">Paper Tracker Admin</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className="flex flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-[#020617]">
          <header className="z-10 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-[#0f172a]">
            <div className="flex items-center gap-3">
              <span className="hidden text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-500 sm:inline-block">University Paper Flow</span>
              <span className="hidden text-slate-300 dark:text-slate-700 sm:inline-block">/</span>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{workspaceTitle}</h2>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleReset}
                disabled={busy}
                className="rounded-md bg-slate-100 px-2.5 py-1.5 text-xs text-slate-500 transition-all hover:bg-slate-200 hover:text-slate-800 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
              >
                Reset Data
              </button>
              <button
                type="button"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                {theme === "dark" ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.364l-.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                  </svg>
                )}
              </button>
              <span className="hidden rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-400 dark:bg-slate-800 md:inline">
                Paper Tracker Admin (<span className="text-slate-600 dark:text-slate-300">admin</span>)
              </span>
              {busy && <span className="hidden text-xs text-brand-500 md:inline">Syncing workspace...</span>}
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                Logout
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
