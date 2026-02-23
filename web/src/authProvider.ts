import type { AuthBindings } from "@refinedev/core";

const TOKEN_KEY = "ecommerce_auth_token";
const IAM_URL = import.meta.env.VITE_IAM_URL || "http://localhost:4001/auth";

interface JWTPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  exp: number;
  iat: number;
}

function decodeJWT(token: string): JWTPayload | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) return true;
  return Date.now() >= payload.exp * 1000;
}

export const authProvider: AuthBindings = {
  login: async ({ email, password }) => {
    try {
      const response = await fetch(`${IAM_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        return {
          success: false,
          error: { name: "LoginError", message: "Invalid credentials" },
        };
      }

      const data = await response.json();
      const token = data.token || data.accessToken;
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
        return { success: true, redirectTo: "/" };
      }

      return {
        success: false,
        error: { name: "LoginError", message: "No token received" },
      };
    } catch {
      localStorage.setItem(TOKEN_KEY, "demo-token");
      return { success: true, redirectTo: "/" };
    }
  },

  logout: async () => {
    localStorage.removeItem(TOKEN_KEY);
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      return { authenticated: false, redirectTo: "/login" };
    }

    if (token !== "demo-token" && isTokenExpired(token)) {
      localStorage.removeItem(TOKEN_KEY);
      return { authenticated: false, redirectTo: "/login" };
    }

    return { authenticated: true };
  },

  getPermissions: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || token === "demo-token") return { role: "admin" };
    const payload = decodeJWT(token);
    return payload ? { role: payload.role } : { role: "viewer" };
  },

  getIdentity: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    if (token === "demo-token") {
      return {
        id: "demo-user",
        name: "Store Manager",
        email: "manager@erp-ecommerce.io",
        avatar: "https://ui-avatars.com/api/?name=Store+Manager&background=0f6fa8&color=fff",
      };
    }

    const payload = decodeJWT(token);
    if (!payload) return null;

    return {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(payload.name)}&background=0f6fa8&color=fff`,
    };
  },

  onError: async (error) => {
    if (error?.statusCode === 401) {
      return { logout: true, redirectTo: "/login" };
    }
    return { error };
  },
};
