import React, { useState, useEffect, useCallback } from "react";
import {
  User,
  LoginPayload,
  RegisterPayload,
  getCurrentUserApi,
  loginApi,
  registerApi,
  logoutApi,
  refreshSessionApi,
} from "../api/client";
import { AuthContext } from "./authContextDef";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUserApi();
      setUser(currentUser);
    } catch {
      const refreshed = await refreshSessionApi();
      if (refreshed) {
        setUser(refreshed.user);
      } else {
        setUser(null);
      }
    }
  }, []);

  // Initialize session on mount
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      setIsLoading(true);
      try {
        const currentUser = await getCurrentUserApi();
        if (isMounted) setUser(currentUser);
      } catch {
        try {
          const refreshed = await refreshSessionApi();
          if (isMounted && refreshed) {
            setUser(refreshed.user);
          } else if (isMounted) {
            setUser(null);
          }
        } catch {
          if (isMounted) setUser(null);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    initSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (payload: LoginPayload) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await loginApi(payload);
      setUser(response.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await registerApi(payload);
      setUser(response.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await logoutApi();
    } catch {
      // Ignore network errors on logout
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        register,
        logout,
        clearError,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
