import { createContext, useContext, useEffect, useState } from "react";

import { workspaceApi } from "../api.js";
import { useAuth } from "./AuthContext.jsx";

const WorkspaceContext = createContext(null);

const initialState = {
  universities: [],
  exams: [],
  operators: [],
  papers: [],
};

export function WorkspaceProvider({ children }) {
  const { isAuthenticated, checkingAuth } = useAuth();
  const [workspace, setWorkspace] = useState(initialState);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("paperflow_theme", "light");
  }, [theme]);

  const refreshWorkspace = async (initial = false) => {
    if (initial) {
      setLoading(true);
    } else {
      setBusy(true);
    }
    try {
      const data = await workspaceApi.getBootstrap();
      setWorkspace(data);
      setError("");
      return data;
    } catch (fetchError) {
      setError(fetchError.message);
      throw fetchError;
    } finally {
      setLoading(false);
      setBusy(false);
    }
  };

  useEffect(() => {
    if (checkingAuth) {
      return;
    }
    if (!isAuthenticated) {
      setWorkspace(initialState);
      setLoading(false);
      setBusy(false);
      setError("");
      return;
    }
    refreshWorkspace(true).catch(() => {});
  }, [checkingAuth, isAuthenticated]);

  const runMutation = async (action, bootstrapResponse = false) => {
    setBusy(true);
    try {
      const response = await action();
      if (bootstrapResponse) {
        setWorkspace(response);
      } else {
        const data = await workspaceApi.getBootstrap();
        setWorkspace(data);
      }
      setError("");
      return response;
    } catch (mutationError) {
      setError(mutationError.message);
      throw mutationError;
    } finally {
      setBusy(false);
    }
  };

  const value = {
    ...workspace,
    loading,
    busy,
    error,
    theme,
    setTheme,
    refreshWorkspace,
    resetWorkspace: () => runMutation(() => workspaceApi.resetWorkspace(), true),
    createUniversity: (payload) => runMutation(() => workspaceApi.createUniversity(payload)),
    deleteUniversity: (id) => runMutation(() => workspaceApi.deleteUniversity(id)),
    createExam: (payload) => runMutation(() => workspaceApi.createExam(payload)),
    deleteExam: (id) => runMutation(() => workspaceApi.deleteExam(id)),
    createOperator: (payload) => runMutation(() => workspaceApi.createOperator(payload)),
    deleteOperator: (id) => runMutation(() => workspaceApi.deleteOperator(id)),
    createPaper: (payload) => runMutation(() => workspaceApi.createPaper(payload)),
    importPapers: (file, payload) => runMutation(() => workspaceApi.importPapers(file, payload)),
    updatePaper: (id, payload) => runMutation(() => workspaceApi.updatePaper(id, payload)),
    deletePaper: (id) => runMutation(() => workspaceApi.deletePaper(id)),
    bulkUpdatePapers: (payload) => runMutation(() => workspaceApi.bulkUpdatePapers(payload)),
    bulkDeletePapers: (payload) => runMutation(() => workspaceApi.bulkDeletePapers(payload)),
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}
