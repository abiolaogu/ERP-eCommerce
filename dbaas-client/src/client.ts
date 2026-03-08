import { resolveConfig, type DbaasClientConfig } from "./config.js";
import { DbaasClientError } from "./errors.js";
import { requestJSON } from "./http.js";
import { MockDbaasBackend } from "./mock.js";
import type {
  CallOptions,
  CreateInstanceRequest,
  DbaasInstance,
  DbaasOperation,
  ListInstancesResult,
  RequestScope,
  WaitOptions,
} from "./types.js";

export interface DbaasClient {
  health(): Promise<{ status: string }>;
  createInstance(scope: RequestScope, input: CreateInstanceRequest, options?: CallOptions): Promise<DbaasOperation>;
  listInstances(scope: RequestScope): Promise<ListInstancesResult>;
  getInstance(scope: RequestScope, instanceId: string): Promise<DbaasInstance>;
  deleteInstance(scope: RequestScope, instanceId: string, options?: CallOptions): Promise<DbaasOperation>;
  rotateCredentials(scope: RequestScope, instanceId: string, options?: CallOptions): Promise<DbaasOperation>;
  createBackup(scope: RequestScope, instanceId: string, options?: CallOptions): Promise<DbaasOperation>;
  restoreBackup(scope: RequestScope, backupId: string, options?: CallOptions): Promise<DbaasOperation>;
  getOperation(scope: RequestScope, operationId: string): Promise<DbaasOperation>;
  waitForOperation(scope: RequestScope, operationId: string, options?: WaitOptions): Promise<DbaasOperation>;
}

function validateScope(scope: RequestScope): void {
  if (!scope.tenantId) {
    throw new DbaasClientError("tenantId is required", { code: "SCOPE_TENANT_REQUIRED" });
  }
  if (!scope.projectId) {
    throw new DbaasClientError("projectId is required", { code: "SCOPE_PROJECT_REQUIRED" });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createDbaasClient(configInput: Partial<DbaasClientConfig>): DbaasClient {
  const config = resolveConfig(configInput);
  const mock = new MockDbaasBackend();

  return {
    async health() {
      if (config.mockMode) {
        return { status: "ok" };
      }
      return requestJSON<{ status: string }>(config, {
        method: "GET",
        path: "/healthz",
        scope: { tenantId: "system", projectId: "system" },
      });
    },

    async createInstance(scope, input, options) {
      validateScope(scope);
      if (config.mockMode) {
        return mock.createInstance(scope, input);
      }
      return requestJSON<DbaasOperation>(config, {
        method: "POST",
        path: "/v1/dbaas/instances",
        scope,
        body: input,
        idempotencyKey: options?.idempotencyKey,
      });
    },

    async listInstances(scope) {
      validateScope(scope);
      if (config.mockMode) {
        return mock.listInstances(scope);
      }
      return requestJSON<ListInstancesResult>(config, {
        method: "GET",
        path: "/v1/dbaas/instances",
        scope,
      });
    },

    async getInstance(scope, instanceId) {
      validateScope(scope);
      if (!instanceId) {
        throw new DbaasClientError("instanceId is required", { code: "INSTANCE_ID_REQUIRED" });
      }
      if (config.mockMode) {
        return mock.getInstance(scope, instanceId);
      }
      return requestJSON<DbaasInstance>(config, {
        method: "GET",
        path: `/v1/dbaas/instances/${encodeURIComponent(instanceId)}`,
        scope,
      });
    },

    async deleteInstance(scope, instanceId, options) {
      validateScope(scope);
      if (!instanceId) {
        throw new DbaasClientError("instanceId is required", { code: "INSTANCE_ID_REQUIRED" });
      }
      if (config.mockMode) {
        return mock.deleteInstance(scope, instanceId);
      }
      return requestJSON<DbaasOperation>(config, {
        method: "DELETE",
        path: `/v1/dbaas/instances/${encodeURIComponent(instanceId)}`,
        scope,
        idempotencyKey: options?.idempotencyKey,
      });
    },

    async rotateCredentials(scope, instanceId, options) {
      validateScope(scope);
      if (!instanceId) {
        throw new DbaasClientError("instanceId is required", { code: "INSTANCE_ID_REQUIRED" });
      }
      if (config.mockMode) {
        return mock.rotateCredentials(scope, instanceId);
      }
      return requestJSON<DbaasOperation>(config, {
        method: "POST",
        path: `/v1/dbaas/instances/${encodeURIComponent(instanceId)}/credentials/rotate`,
        scope,
        idempotencyKey: options?.idempotencyKey,
      });
    },

    async createBackup(scope, instanceId, options) {
      validateScope(scope);
      if (!instanceId) {
        throw new DbaasClientError("instanceId is required", { code: "INSTANCE_ID_REQUIRED" });
      }
      if (config.mockMode) {
        return mock.createBackup(scope, instanceId);
      }
      return requestJSON<DbaasOperation>(config, {
        method: "POST",
        path: `/v1/dbaas/instances/${encodeURIComponent(instanceId)}/backups`,
        scope,
        idempotencyKey: options?.idempotencyKey,
      });
    },

    async restoreBackup(scope, backupId, options) {
      validateScope(scope);
      if (!backupId) {
        throw new DbaasClientError("backupId is required", { code: "BACKUP_ID_REQUIRED" });
      }
      if (config.mockMode) {
        return mock.restoreBackup(scope, backupId);
      }
      return requestJSON<DbaasOperation>(config, {
        method: "POST",
        path: `/v1/dbaas/backups/${encodeURIComponent(backupId)}/restore`,
        scope,
        idempotencyKey: options?.idempotencyKey,
      });
    },

    async getOperation(scope, operationId) {
      validateScope(scope);
      if (!operationId) {
        throw new DbaasClientError("operationId is required", { code: "OPERATION_ID_REQUIRED" });
      }
      if (config.mockMode) {
        return mock.getOperation(scope, operationId);
      }
      return requestJSON<DbaasOperation>(config, {
        method: "GET",
        path: `/v1/dbaas/operations/${encodeURIComponent(operationId)}`,
        scope,
      });
    },

    async waitForOperation(scope, operationId, options) {
      const timeoutMs = options?.timeoutMs ?? 120000;
      const pollIntervalMs = options?.pollIntervalMs ?? 1500;
      const deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline) {
        const operation = await this.getOperation(scope, operationId);
        if (operation.done) {
          return operation;
        }
        await delay(pollIntervalMs);
      }

      throw new DbaasClientError("operation wait timeout exceeded", {
        code: "WAIT_TIMEOUT",
        details: { operationId, timeoutMs },
      });
    },
  };
}
