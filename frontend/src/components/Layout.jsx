/* eslint-disable react/prop-types */
import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { appRoleLabels, getAccessibleNavItems, pageTitles } from "../access.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { useFeedback } from "./Feedback.jsx";

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
  const { user, logout } = useAuth();
  const { busy, resetWorkspace } = useWorkspace();
  const { confirm, showToast } = useFeedback();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = getAccessibleNavItems(user?.role);
  const workspaceTitle = pageTitles[location.pathname] ?? "Paper Tracking Workspace";
  const roleLabel = appRoleLabels[user?.role] ?? "User";

  const handleReset = async () => {
    const accepted = await confirm("Are you sure you want to restore all datasets to default templates?");
    if (!accepted) {
      return;
    }
    await resetWorkspace();
    showToast("All workspace datasets restored to default templates", "success");
  };

  const handleLogout = async () => {
    logout();
    showToast("Session closed. Returning to login...", "info");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 transition-colors duration-200">
      <div className="flex h-screen flex-1 overflow-hidden">
        <aside
          className={`z-20 flex shrink-0 flex-col border-r border-slate-700 bg-slate-800 text-slate-100 transition-all duration-300 ${
            isSidebarExpanded ? "w-64" : "w-20"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-700 p-4">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="shrink-0 rounded-lg bg-white p-2 text-slate-900 shadow-sm">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              {isSidebarExpanded && (
                <div>
                  <h1 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Paper Flow</h1>
                  <p className="truncate text-sm font-bold text-white">Exam Control Desk</p>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarExpanded((current) => !current)}
              className="rounded p-1.5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
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
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                <NavIcon name={item.key} />
                {isSidebarExpanded && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-slate-700 bg-slate-900/70 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-bold uppercase text-slate-900 shadow-inner">
                AD
              </div>
              {isSidebarExpanded && (
                <div className="overflow-hidden">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{roleLabel}</h4>
                  <p className="truncate text-sm font-semibold text-white">{user?.displayName ?? "Paper Tracker User"}</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className="flex flex-1 flex-col overflow-hidden bg-white">
          <header className="z-10 flex h-16 shrink-0 items-center justify-between border-b border-slate-700 bg-slate-800 px-6">
            <div className="flex items-center gap-3">
              <span className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 sm:inline-block">University Paper Flow</span>
              <span className="hidden text-slate-500 sm:inline-block">/</span>
              <h2 className="text-sm font-semibold text-white">{workspaceTitle}</h2>
            </div>

            <div className="flex items-center gap-3">
              {user?.role === "admin" && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={busy}
                  className="rounded-md border border-slate-600 bg-slate-700 px-2.5 py-1.5 text-xs text-slate-100 transition-all hover:bg-slate-600 disabled:opacity-50"
                >
                  Reset Data
                </button>
              )}
              <span className="hidden rounded-md border border-slate-600 bg-slate-700/80 px-2 py-1 text-xs text-slate-200 md:inline">
                {user?.displayName ?? "Paper Tracker User"} (<span className="text-white">{user?.userId ?? "user"}</span>)
              </span>
              {busy && <span className="hidden text-xs text-slate-300 md:inline">Syncing workspace...</span>}
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm transition-all hover:bg-slate-100"
              >
                Logout
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto bg-white p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
