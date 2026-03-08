import type { AppSession } from "@/lib/auth/session";
import { env } from "@/lib/config/env";

export interface UiDbaasInstance {
  id: string;
  name: string;
  engine: string;
  status: string;
  regionCode: string;
  updatedAt: string;
}

export class DbaasService {
  static async listInstances(session: AppSession): Promise<UiDbaasInstance[]> {
    const response = await fetch("/api/dbaas/instances", {
      method: "GET",
      headers: {
        "x-tenant-id": session.tenantId,
        "x-project-id": env.dbaasDefaultProject,
        ...(session.accessToken ? { authorization: `Bearer ${session.accessToken}` } : {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`DBaaS list failed with status ${response.status}`);
    }

    const payload = (await response.json()) as { items?: UiDbaasInstance[] };
    return payload.items ?? [];
  }

  static async createDemoInstance(session: AppSession): Promise<void> {
    const response = await fetch("/api/dbaas/instances", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": session.tenantId,
        "x-project-id": env.dbaasDefaultProject,
        ...(session.accessToken ? { authorization: `Bearer ${session.accessToken}` } : {}),
      },
      body: JSON.stringify({
        name: `ecommerce-${Date.now()}`,
        engine: "yugabytedb",
        regionCode: "ng-lag-1",
        storageGb: 40,
        plan: "dev",
        tags: {
          module: "ecommerce",
          environment: env.environment,
        },
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error ?? `DBaaS create failed with status ${response.status}`);
    }
  }
}
