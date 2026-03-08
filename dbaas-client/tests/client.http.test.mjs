import assert from "node:assert/strict";
import test from "node:test";

import { createDbaasClient, DbaasClientError } from "../dist/index.js";

const originalFetch = globalThis.fetch;

function withMockFetch(impl) {
  globalThis.fetch = impl;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

test("real mode sends auth and scope headers", async () => {
  const seen = {
    auth: "",
    tenant: "",
    project: "",
    idempotency: "",
  };

  const restore = withMockFetch(async (_url, init) => {
    seen.auth = init.headers.authorization;
    seen.tenant = init.headers["x-tenant-id"];
    seen.project = init.headers["x-project-id"];
    seen.idempotency = init.headers["idempotency-key"];

    return new Response(
      JSON.stringify({ operationId: "op-1", status: "succeeded", done: true, instanceId: "db-1" }),
      { status: 202, headers: { "content-type": "application/json" } },
    );
  });

  try {
    const client = createDbaasClient({
      baseUrl: "http://api.example.internal",
      token: "token-123",
      mockMode: false,
    });

    const op = await client.createInstance(
      { tenantId: "tenant-1", projectId: "project-1" },
      { name: "core-db", engine: "yugabytedb", regionCode: "ng-lag-1", storageGb: 40 },
      { idempotencyKey: "idem-1" },
    );

    assert.equal(op.done, true);
    assert.equal(seen.auth, "Bearer token-123");
    assert.equal(seen.tenant, "tenant-1");
    assert.equal(seen.project, "project-1");
    assert.equal(seen.idempotency, "idem-1");
  } finally {
    restore();
  }
});

test("real mode retries transient failure", async () => {
  let attempts = 0;

  const restore = withMockFetch(async (_url, _init) => {
    attempts += 1;

    if (attempts === 1) {
      return new Response(JSON.stringify({ error: "busy" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  try {
    const client = createDbaasClient({
      baseUrl: "http://api.example.internal",
      token: "token-123",
      mockMode: false,
      retries: 1,
      retryBaseDelayMs: 1,
    });

    const list = await client.listInstances({ tenantId: "tenant-1", projectId: "project-1" });
    assert.equal(Array.isArray(list.items), true);
    assert.equal(attempts, 2);
  } finally {
    restore();
  }
});

test("real mode without token fails fast", async () => {
  const client = createDbaasClient({
    baseUrl: "http://api.example.internal",
    mockMode: false,
  });

  await assert.rejects(
    () => client.listInstances({ tenantId: "tenant-1", projectId: "project-1" }),
    (error) => error instanceof DbaasClientError && error.code === "AUTH_MISSING",
  );
});
