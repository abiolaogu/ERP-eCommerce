import { randomUUID } from "node:crypto";

import { type ResolvedClientConfig } from "./config.js";
import { DbaasClientError, isRetryableStatus } from "./errors.js";
import type { RequestScope } from "./types.js";

interface HttpRequest {
  method: "GET" | "POST" | "DELETE";
  path: string;
  scope: RequestScope;
  body?: unknown;
  idempotencyKey?: string;
  query?: Record<string, string | number | boolean | undefined>;
}

async function resolveToken(config: ResolvedClientConfig): Promise<string | undefined> {
  if (config.tokenProvider) {
    const value = config.tokenProvider();
    return typeof value === "string" ? value : await value;
  }
  return config.token;
}

function buildUrl(baseUrl: string, path: string, query?: HttpRequest["query"]): string {
  const url = new URL(path, baseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function requestJSON<T>(config: ResolvedClientConfig, req: HttpRequest): Promise<T> {
  const token = await resolveToken(config);
  if (!config.mockMode && !token) {
    throw new DbaasClientError("missing auth token for non-mock mode", { code: "AUTH_MISSING" });
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-tenant-id": req.scope.tenantId,
    "x-project-id": req.scope.projectId,
    "x-request-id": req.scope.requestId ?? randomUUID(),
    "user-agent": config.userAgent,
  };

  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  if (req.idempotencyKey) {
    headers["idempotency-key"] = req.idempotencyKey;
  }

  const url = buildUrl(config.baseUrl, req.path, req.query);
  const maxAttempts = Math.max(1, config.retries + 1);

  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    attempt += 1;
    const aborter = new AbortController();
    const timer = setTimeout(() => aborter.abort(), config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: req.method,
        headers,
        body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
        signal: aborter.signal,
      });
      clearTimeout(timer);

      const rawBody = await response.text();
      const payload = rawBody ? (JSON.parse(rawBody) as unknown) : {};

      if (!response.ok) {
        if (attempt < maxAttempts && isRetryableStatus(response.status)) {
          await delay(config.retryBaseDelayMs * 2 ** (attempt - 1));
          continue;
        }

        throw new DbaasClientError("dbaas api request failed", {
          statusCode: response.status,
          details: payload,
        });
      }

      return payload as T;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      const isAbort = error instanceof Error && error.name === "AbortError";
      const isNetwork = error instanceof TypeError;

      if (attempt < maxAttempts && (isAbort || isNetwork)) {
        await delay(config.retryBaseDelayMs * 2 ** (attempt - 1));
        continue;
      }

      if (error instanceof DbaasClientError) {
        throw error;
      }

      throw new DbaasClientError("dbaas api transport failure", {
        code: "TRANSPORT_FAILURE",
        details: lastError,
      });
    }
  }

  throw new DbaasClientError("dbaas api request exhausted retries", {
    code: "RETRY_EXHAUSTED",
    details: lastError,
  });
}
