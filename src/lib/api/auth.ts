import { apiData, setAccessToken } from "./client";
import type { AuthResult, User } from "./types";

export const authApi = {
  async register(input: { name: string; email: string; password: string }) {
    const result = await apiData<AuthResult>("/auth/register", {
      method: "POST", body: input, auth: false, retry401: false,
    });
    setAccessToken(result.accessToken);
    return result;
  },
  async login(input: { email: string; password: string }) {
    const result = await apiData<AuthResult>("/auth/login", {
      method: "POST", body: input, auth: false, retry401: false,
    });
    setAccessToken(result.accessToken);
    return result;
  },
  async refresh() {
    const result = await apiData<AuthResult>("/auth/refresh", {
      method: "POST", auth: false, retry401: false,
    });
    setAccessToken(result.accessToken);
    return result;
  },
  me: () => apiData<User>("/auth/me"),
  async logout() {
    try {
      await apiData<unknown>("/auth/logout", {
        method: "POST", auth: false, retry401: false,
      });
    } finally {
      setAccessToken(null);
    }
  },
};
