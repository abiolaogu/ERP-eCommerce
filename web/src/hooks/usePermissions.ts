import { usePermissions } from "@refinedev/core";
import type { UserRole } from "@/types/auth.types";

interface PermissionResult {
  role: UserRole;
  isAdmin: boolean;
  isEditor: boolean;
  isViewer: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isLoading: boolean;
}

export function useRolePermissions(): PermissionResult {
  const { data, isLoading } = usePermissions<{ role: string }>();
  const role = (data?.role || "viewer") as UserRole;

  return {
    role,
    isAdmin: role === "admin",
    isEditor: role === "admin" || role === "editor",
    isViewer: true,
    canCreate: role === "admin" || role === "editor",
    canEdit: role === "admin" || role === "editor",
    canDelete: role === "admin",
    isLoading,
  };
}
