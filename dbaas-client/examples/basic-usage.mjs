import { createDbaasClient } from "../dist/index.js";

const client = createDbaasClient({
  baseUrl: process.env.UCP_DBAAS_BASE_URL ?? "http://localhost:8780",
  token: process.env.UCP_DBAAS_TOKEN,
  mockMode: (process.env.UCP_DBAAS_MOCK_MODE ?? "true").toLowerCase() === "true",
});

const scope = {
  tenantId: "tenant-demo",
  projectId: "project-payments",
};

const create = await client.createInstance(scope, {
  name: "payments-primary",
  engine: "yugabytedb",
  regionCode: "ng-lag-1",
  storageGb: 80,
  plan: "standard",
  tags: {
    service: "payments",
    env: "dev",
  },
});

console.log("create operation", create);

const wait = await client.waitForOperation(scope, create.operationId, {
  timeoutMs: 30_000,
  pollIntervalMs: 1_000,
});
console.log("operation result", wait);

const list = await client.listInstances(scope);
console.log("instances", JSON.stringify(list, null, 2));
