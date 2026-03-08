export type DbaasEngine = "yugabytedb" | "tidb" | "scylladb" | "mongodb";
export type DbaasPlan = "dev" | "standard" | "ha";

export type OperationStatus = "pending" | "running" | "succeeded" | "failed";

export interface RequestScope {
  tenantId: string;
  projectId: string;
  requestId?: string;
}

export interface CreateInstanceRequest {
  name: string;
  engine: DbaasEngine;
  version?: string;
  regionCode: string;
  plan?: DbaasPlan;
  storageGb: number;
  cpu?: number;
  memoryGb?: number;
  tags?: Record<string, string>;
}

export interface DbaasConnection {
  host: string;
  port: number;
  database: string;
  username: string;
}

export interface DbaasInstance {
  id: string;
  name: string;
  engine: DbaasEngine;
  version?: string;
  status: "provisioning" | "ready" | "deleting" | "deleted" | "error";
  regionCode: string;
  createdAt: string;
  updatedAt: string;
  tags: Record<string, string>;
  connection?: DbaasConnection;
}

export interface DbaasBackup {
  id: string;
  instanceId: string;
  tenantId: string;
  projectId: string;
  createdAt: string;
  status: "creating" | "ready" | "failed";
}

export interface DbaasOperation {
  operationId: string;
  status: OperationStatus;
  done: boolean;
  instanceId?: string;
  backupId?: string;
  error?: string;
}

export interface ListInstancesResult {
  items: DbaasInstance[];
}

export interface WaitOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export interface CallOptions {
  idempotencyKey?: string;
}
