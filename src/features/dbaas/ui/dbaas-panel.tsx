"use client";

import { Database, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDbaas } from "@/features/dbaas/hooks/use-dbaas";

export function DbaasPanel() {
  const { session, instancesQuery, createMutation } = useDbaas();

  return (
    <section className="space-y-3 rounded-xl border bg-[var(--card)] p-4 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">DBaaS Instances</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Tenant {session.tenantId} on project scope default.
          </p>
        </div>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          variant="outline"
        >
          {createMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          Create Demo DB
        </Button>
      </header>

      {instancesQuery.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : instancesQuery.data && instancesQuery.data.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {instancesQuery.data.map((instance) => (
            <article key={instance.id} className="rounded-lg border p-3">
              <p className="text-sm font-semibold">{instance.name}</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {instance.engine} · {instance.regionCode}
              </p>
              <p className="mt-1 text-xs">Status: {instance.status}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-sm text-[var(--muted-foreground)]">
          No DB instances yet. Create a demo instance to verify DBaaS integration in mock mode.
        </div>
      )}

      {instancesQuery.error ? (
        <p className="text-sm text-red-600">
          {(instancesQuery.error as Error).message}
        </p>
      ) : null}

      {createMutation.error ? (
        <p className="text-sm text-red-600">
          {(createMutation.error as Error).message}
        </p>
      ) : null}
    </section>
  );
}
