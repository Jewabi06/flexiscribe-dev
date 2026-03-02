"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  role: "ADMIN" | "STUDENT" | "EDUCATOR";
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, role?: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string, role?: string) => {
    const endpoint = role ? "/api/auth/login" : "/api/auth/admin/login";
    const body = role 
      ? { email, password, role }
      : { email, password };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Login failed");
    }

    const data = await response.json();
    setUser(data.user);
    
    // Redirect based on role
    if (data.user.role === "ADMIN") {
      router.push("/admin/dashboard");
    } else if (data.user.role === "EDUCATOR") {
      router.push("/educator/dashboard");
    } else if (data.user.role === "STUDENT") {
      router.push("/student/dashboard");
    }
  };

  const logout = async () => {
    const fallbackRole = user?.role;
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setUser(null);
      const role = data.role || fallbackRole;
      if (role === "STUDENT") {
        window.location.href = "/auth/student/login";
      } else if (role === "EDUCATOR") {
        window.location.href = "/auth/educator/login";
      } else if (role === "ADMIN") {
        // Admin login is gated — go to landing page
        window.location.href = "/";
      } else {
        window.location.href = "/auth/role-selection";
      }
    } catch (error) {
      console.error("Logout error:", error);
      setUser(null);
      if (fallbackRole === "STUDENT") {
        window.location.href = "/auth/student/login";
      } else if (fallbackRole === "EDUCATOR") {
        window.location.href = "/auth/educator/login";
      } else if (fallbackRole === "ADMIN") {
        window.location.href = "/";
      } else {
        window.location.href = "/auth/role-selection";
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
