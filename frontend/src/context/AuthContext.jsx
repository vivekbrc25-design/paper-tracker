import { createContext, useContext, useEffect, useState } from "react";

import { setAuthToken, workspaceApi } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("paperflow_auth_token");
    if (!token) {
      setCheckingAuth(false);
      return;
    }

    setAuthToken(token);
    workspaceApi
      .getSession()
      .then((response) => {
        setUser(response.user);
      })
      .catch(() => {
        setAuthToken(null);
        setUser(null);
      })
      .finally(() => {
        setCheckingAuth(false);
      });
  }, []);

  const login = async (userId, password) => {
    const response = await workspaceApi.login({ userId, password });
    setAuthToken(response.accessToken);
    setUser(response.user);
    return response.user;
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        checkingAuth,
        isAuthenticated: Boolean(user),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
