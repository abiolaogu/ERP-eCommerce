export interface LoginFormValues {
  email: string;
  password: string;
  remember?: boolean;
}

export interface UserIdentity {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
  tenantId?: string;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  exp: number;
  iat: number;
}

export interface Permission {
  role: string;
  permissions?: string[];
}

export type UserRole = "admin" | "editor" | "viewer";
