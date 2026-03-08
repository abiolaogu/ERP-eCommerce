import assert from "node:assert/strict";
import test from "node:test";

import { createDbaasClient } from "../dist/index.js";

const scope = {
  tenantId: "tenant-demo",
  projectId: "project-alpha",
};

test("mock lifecycle: create/list/get/delete", async () => {
  const client = createDbaasClient({
    baseUrl: "http://localhost:8780",
    mockMode: true,
  });

  const createOp = await client.createInstance(scope, {
    name: "orders-db",
    engine: "yugabytedb",
    regionCode: "ng-lag-1",
    storageGb: 50,
    plan: "dev",
  });

  assert.equal(createOp.done, true);
  assert.ok(createOp.instanceId);

  const list1 = await client.listInstances(scope);
  assert.equal(list1.items.length, 1);
  assert.equal(list1.items[0].name, "orders-db");

  const instance = await client.getInstance(scope, createOp.instanceId);
  assert.equal(instance.engine, "yugabytedb");

  const deleteOp = await client.deleteInstance(scope, createOp.instanceId);
  assert.equal(deleteOp.done, true);

  const list2 = await client.listInstances(scope);
  assert.equal(list2.items.length, 0);
});

test("mock lifecycle: rotate credentials, backup, restore", async () => {
  const client = createDbaasClient({
    baseUrl: "http://localhost:8780",
    mockMode: true,
  });

  const createOp = await client.createInstance(scope, {
    name: "billing-db",
    engine: "tidb",
    regionCode: "uk-lon-1",
    storageGb: 80,
    plan: "standard",
  });

  const rotateOp = await client.rotateCredentials(scope, createOp.instanceId);
  assert.equal(rotateOp.done, true);

  const backupOp = await client.createBackup(scope, createOp.instanceId);
  assert.equal(backupOp.done, true);
  assert.ok(backupOp.backupId);

  const restoreOp = await client.restoreBackup(scope, backupOp.backupId);
  assert.equal(restoreOp.done, true);
  assert.ok(restoreOp.instanceId);
});

test("waitForOperation returns completed operation", async () => {
  const client = createDbaasClient({
    baseUrl: "http://localhost:8780",
    mockMode: true,
  });

  const createOp = await client.createInstance(scope, {
    name: "analytics-db",
    engine: "mongodb",
    regionCode: "us-iad-1",
    storageGb: 120,
    plan: "ha",
  });

  const waited = await client.waitForOperation(scope, createOp.operationId, {
    timeoutMs: 2000,
    pollIntervalMs: 50,
  });

  assert.equal(waited.done, true);
  assert.equal(waited.status, "succeeded");
});
