"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ensureSession } from "@/lib/auth/session";
import { env } from "@/lib/config/env";
import { DbaasService } from "@/features/dbaas/services/dbaas-service";

export function useDbaas() {
  const session = ensureSession(env.defaultTenant);
  const queryClient = useQueryClient();

  const instancesQuery = useQuery({
    queryKey: ["dbaas", "instances", session.tenantId, env.dbaasDefaultProject],
    queryFn: () => DbaasService.listInstances(session),
    staleTime: 1000 * 30,
  });

  const createMutation = useMutation({
    mutationFn: () => DbaasService.createDemoInstance(session),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dbaas", "instances", session.tenantId, env.dbaasDefaultProject] });
    },
  });

  return {
    session,
    instancesQuery,
    createMutation,
  };
}
