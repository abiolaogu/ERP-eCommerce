import { randomUUID } from "node:crypto";

import {
  createDbaasClient,
  type CreateInstanceRequest,
  type RequestScope,
} from "../../../dbaas-client/dist/index.js";
import { env } from "@/lib/config/env";
import { serverEnv } from "@/lib/config/server-env";

const dbaasClient = createDbaasClient({
  baseUrl: serverEnv.dbaasBaseUrl,
  token: serverEnv.dbaasToken,
  mockMode: serverEnv.dbaasMockMode,
  timeoutMs: 10000,
  retries: 2,
  retryBaseDelayMs: 250,
});

function resolveScope(request: Request): RequestScope {
  const tenantId = request.headers.get("x-tenant-id") ?? env.defaultTenant;
  const projectId = request.headers.get("x-project-id") ?? env.dbaasDefaultProject;
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  return { tenantId, projectId, requestId };
}

export async function listDbaasInstances(request: Request) {
  return dbaasClient.listInstances(resolveScope(request));
}

export async function createDbaasInstance(request: Request, payload: CreateInstanceRequest) {
  return dbaasClient.createInstance(resolveScope(request), payload, {
    idempotencyKey: request.headers.get("idempotency-key") ?? randomUUID(),
  });
}

export async function getDbaasInstance(request: Request, instanceId: string) {
  return dbaasClient.getInstance(resolveScope(request), instanceId);
}

export async function deleteDbaasInstance(request: Request, instanceId: string) {
  return dbaasClient.deleteInstance(resolveScope(request), instanceId, {
    idempotencyKey: request.headers.get("idempotency-key") ?? randomUUID(),
  });
}
