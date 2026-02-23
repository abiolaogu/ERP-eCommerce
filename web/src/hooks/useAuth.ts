import { useGetIdentity, useLogout, useIsAuthenticated } from "@refinedev/core";
import type { UserIdentity } from "@/types/auth.types";

export function useAuth() {
  const { data: identity, isLoading: identityLoading } = useGetIdentity<UserIdentity>();
  const { data: authStatus, isLoading: authLoading } = useIsAuthenticated();
  const { mutate: logout } = useLogout();

  return {
    user: identity || null,
    isAuthenticated: authStatus?.authenticated ?? false,
    isLoading: identityLoading || authLoading,
    logout: () => logout(),
  };
}
