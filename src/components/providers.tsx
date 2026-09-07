"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { authApi } from "@/lib/api/auth";
import { ApiError, onAuthFailure } from "@/lib/api/client";
import type { User } from "@/lib/api/types";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) =>
        !(
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 500
        ) && count < 2,
    },
    mutations: { retry: false },
  },
});

type AuthContextValue = {
  user: User | null;
  restoring: boolean;
  login(input: { email: string; password: string }): Promise<User>;
  register(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<User>;
  logout(): Promise<void>;
  setUser(user: User | null): void;
};
const AuthContext = createContext<AuthContextValue | null>(null);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [restoring, setRestoring] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const handleFailure = useCallback(() => {
    setUser(null);
    queryClient.clear();
    if (!pathname.startsWith("/login") && !pathname.startsWith("/register")) {
      router.replace("/login");
    }
  }, [pathname, router]);

  useEffect(() => {
    onAuthFailure(handleFailure);
    return () => onAuthFailure(null);
  }, [handleFailure]);

  useEffect(() => {
    let live = true;
    authApi
      .refresh()
      .then((result) => {
        if (live) setUser(result.user);
      })
      .catch(() => {
        if (live) setUser(null);
      })
      .finally(() => {
        if (live) setRestoring(false);
      });
    return () => {
      live = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      restoring,
      setUser,
      login: async (input) => {
        const result = await authApi.login(input);
        setUser(result.user);
        return result.user;
      },
      register: async (input) => {
        const result = await authApi.register(input);
        setUser(result.user);
        return result.user;
      },
      logout: async () => {
        await authApi.logout();
        setUser(null);
        queryClient.clear();
        router.replace("/login");
      },
    }),
    [user, restoring, router],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within Providers");
  return value;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
