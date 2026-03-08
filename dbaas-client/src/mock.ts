import { randomUUID } from "node:crypto";

import type {
  CreateInstanceRequest,
  DbaasBackup,
  DbaasInstance,
  DbaasOperation,
  ListInstancesResult,
  RequestScope,
} from "./types.js";

interface ScopedKey {
  tenantId: string;
  projectId: string;
}

function scopeKey(scope: ScopedKey): string {
  return `${scope.tenantId}::${scope.projectId}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

export class MockDbaasBackend {
  private readonly instances = new Map<string, DbaasInstance>();
  private readonly operations = new Map<string, DbaasOperation>();
  private readonly backups = new Map<string, DbaasBackup>();

  async createInstance(scope: RequestScope, input: CreateInstanceRequest): Promise<DbaasOperation> {
    const id = `db-${randomUUID()}`;
    const operationId = `op-${randomUUID()}`;

    const instance: DbaasInstance = {
      id,
      name: input.name,
      engine: input.engine,
      version: input.version,
      status: "ready",
      regionCode: input.regionCode,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      tags: input.tags ?? {},
      connection: {
        host: `${id}.mock.internal`,
        port: input.engine === "mongodb" ? 27017 : 5433,
        database: "app",
        username: "app_user",
      },
    };

    this.instances.set(`${scopeKey(scope)}::${id}`, instance);

    const op: DbaasOperation = {
      operationId,
      status: "succeeded",
      done: true,
      instanceId: id,
    };

    this.operations.set(`${scopeKey(scope)}::${operationId}`, op);
    return op;
  }

  async listInstances(scope: RequestScope): Promise<ListInstancesResult> {
    const keyPrefix = `${scopeKey(scope)}::`;
    const items = Array.from(this.instances.entries())
      .filter(([key]) => key.startsWith(keyPrefix))
      .map(([, value]) => value);

    return { items };
  }

  async getInstance(scope: RequestScope, instanceId: string): Promise<DbaasInstance> {
    const key = `${scopeKey(scope)}::${instanceId}`;
    const instance = this.instances.get(key);
    if (!instance) {
      throw new Error("instance not found");
    }
    return instance;
  }

  async deleteInstance(scope: RequestScope, instanceId: string): Promise<DbaasOperation> {
    const key = `${scopeKey(scope)}::${instanceId}`;
    this.instances.delete(key);

    const op: DbaasOperation = {
      operationId: `op-${randomUUID()}`,
      status: "succeeded",
      done: true,
      instanceId,
    };
    this.operations.set(`${scopeKey(scope)}::${op.operationId}`, op);
    return op;
  }

  async rotateCredentials(scope: RequestScope, instanceId: string): Promise<DbaasOperation> {
    const key = `${scopeKey(scope)}::${instanceId}`;
    const instance = this.instances.get(key);
    if (!instance) {
      throw new Error("instance not found");
    }

    instance.connection = {
      ...(instance.connection ?? { host: `${instance.id}.mock.internal`, port: 5433, database: "app", username: "app_user" }),
      username: `app_user_${Math.floor(Math.random() * 1000)}`,
    };
    instance.updatedAt = nowISO();
    this.instances.set(key, instance);

    const op: DbaasOperation = {
      operationId: `op-${randomUUID()}`,
      status: "succeeded",
      done: true,
      instanceId,
    };
    this.operations.set(`${scopeKey(scope)}::${op.operationId}`, op);
    return op;
  }

  async createBackup(scope: RequestScope, instanceId: string): Promise<DbaasOperation> {
    const instance = await this.getInstance(scope, instanceId);
    if (!instance) {
      throw new Error("instance not found");
    }

    const backupId = `bkp-${randomUUID()}`;
    this.backups.set(`${scopeKey(scope)}::${backupId}`, {
      id: backupId,
      instanceId,
      tenantId: scope.tenantId,
      projectId: scope.projectId,
      createdAt: nowISO(),
      status: "ready",
    });

    const op: DbaasOperation = {
      operationId: `op-${randomUUID()}`,
      status: "succeeded",
      done: true,
      instanceId,
      backupId,
    };
    this.operations.set(`${scopeKey(scope)}::${op.operationId}`, op);
    return op;
  }

  async restoreBackup(scope: RequestScope, backupId: string): Promise<DbaasOperation> {
    const backup = this.backups.get(`${scopeKey(scope)}::${backupId}`);
    if (!backup) {
      throw new Error("backup not found");
    }

    const op = await this.createInstance(scope, {
      name: `restore-${backup.instanceId}`,
      engine: "yugabytedb",
      regionCode: "restore-region",
      storageGb: 20,
      plan: "dev",
    });

    return {
      ...op,
      backupId,
    };
  }

  async getOperation(scope: RequestScope, operationId: string): Promise<DbaasOperation> {
    const op = this.operations.get(`${scopeKey(scope)}::${operationId}`);
    if (!op) {
      throw new Error("operation not found");
    }
    return op;
  }
}
