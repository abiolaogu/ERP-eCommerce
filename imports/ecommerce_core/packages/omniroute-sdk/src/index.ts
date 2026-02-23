export interface OmniRouteClientConfig {
  baseUrl: string;
  apiKey: string;
  tenantId?: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
  coverageLaneCacheTtlMs?: number;
}

export interface OmniRouteEnvConfig {
  OMNIROUTE_API_BASE_URL?: string;
  OMNIROUTE_API_KEY?: string;
  OMNIROUTE_TENANT_ID?: string;
}

export interface PolicyCheckRequest {
  brandId: string;
  destinationState: string;
  lines: Array<{
    sku: string;
    category: string;
    quantity: number;
  }>;
}

export interface PolicyCheckResponse {
  compliant: boolean;
  coverageLane: string;
  expectedSlaHours: number;
  checks: Array<{
    category: string;
    quantity: number;
    requiredMOQ: number;
    compliant: boolean;
  }>;
  automationNotes: string[];
}

export interface CoverageLaneResponse {
  laneId: string;
  owner: string;
  ownerType: string;
  slaHours: number;
}

export interface OmniRouteClient {
  evaluateCheckoutPolicy(input: PolicyCheckRequest): Promise<PolicyCheckResponse>;
  listCoverageLanes(destinationState: string): Promise<CoverageLaneResponse[]>;
  triggerRebalance(payload: {
    brandId: string;
    reason: string;
    scope: 'national' | 'regional' | 'local';
  }): Promise<{ workflowId: string; status: string }>;
}

interface CachedCoverageLanes {
  value: CoverageLaneResponse[];
  expiresAt: number;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 3000;
const DEFAULT_COVERAGE_LANE_CACHE_TTL_MS = 15000;

export const createOmniRouteClientFromEnv = (
  env: OmniRouteEnvConfig
): OmniRouteClient | undefined => {
  if (!env.OMNIROUTE_API_BASE_URL || !env.OMNIROUTE_API_KEY) {
    return undefined;
  }

  return createOmniRouteClient({
    baseUrl: env.OMNIROUTE_API_BASE_URL,
    apiKey: env.OMNIROUTE_API_KEY,
    tenantId: env.OMNIROUTE_TENANT_ID,
  });
};

const buildHeaders = (config: OmniRouteClientConfig): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
  };

  if (config.tenantId) {
    headers['X-Tenant-ID'] = config.tenantId;
  }

  return headers;
};

const parseJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OmniRoute API request failed: ${response.status} ${body}`);
  }

  return response.json() as Promise<T>;
};

const cloneCoverageLanes = (lanes: CoverageLaneResponse[]): CoverageLaneResponse[] =>
  lanes.map((lane) => ({ ...lane }));

const fetchJson = async <T>({
  fetchImpl,
  url,
  init,
  timeoutMs,
  operation
}: {
  fetchImpl: typeof fetch;
  url: string;
  init: RequestInit;
  timeoutMs: number;
  operation: string;
}): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      ...init,
      signal: controller.signal
    });

    return parseJson<T>(response);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`OmniRoute API request timed out (${operation}) after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '');
const normalizeCoverageLaneCacheKey = (destinationState: string): string => destinationState.trim().toLowerCase();

export const createOmniRouteClient = (config: OmniRouteClientConfig): OmniRouteClient => {
  const headers = buildHeaders(config);
  const fetchImpl = config.fetchImpl ?? fetch;
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const requestTimeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const coverageLaneCacheTtlMs = config.coverageLaneCacheTtlMs ?? DEFAULT_COVERAGE_LANE_CACHE_TTL_MS;
  const coverageLaneCache = new Map<string, CachedCoverageLanes>();
  const inFlightCoverageLaneRequests = new Map<string, Promise<CoverageLaneResponse[]>>();

  return {
    async evaluateCheckoutPolicy(input: PolicyCheckRequest): Promise<PolicyCheckResponse> {
      return fetchJson<PolicyCheckResponse>({
        fetchImpl,
        url: `${baseUrl}/v1/orchestration/checkout-policy`,
        init: {
          method: 'POST',
          headers,
          body: JSON.stringify(input),
        },
        timeoutMs: requestTimeoutMs,
        operation: 'evaluateCheckoutPolicy'
      });
    },

    async listCoverageLanes(destinationState: string): Promise<CoverageLaneResponse[]> {
      const normalizedDestinationState = destinationState.trim();
      if (!normalizedDestinationState) {
        return [];
      }

      const cacheKey = normalizeCoverageLaneCacheKey(normalizedDestinationState);
      const now = Date.now();
      const cached = coverageLaneCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        return cloneCoverageLanes(cached.value);
      }

      const inFlightRequest = inFlightCoverageLaneRequests.get(cacheKey);
      if (inFlightRequest) {
        return cloneCoverageLanes(await inFlightRequest);
      }

      const requestPromise = (async () => {
        const url = new URL(`${baseUrl}/v1/orchestration/coverage-lanes`);
        url.searchParams.set('destinationState', normalizedDestinationState);

        const lanes = await fetchJson<CoverageLaneResponse[]>({
          fetchImpl,
          url: url.toString(),
          init: {
            method: 'GET',
            headers,
          },
          timeoutMs: requestTimeoutMs,
          operation: 'listCoverageLanes'
        });

        if (coverageLaneCacheTtlMs > 0) {
          coverageLaneCache.set(cacheKey, {
            value: cloneCoverageLanes(lanes),
            expiresAt: Date.now() + coverageLaneCacheTtlMs
          });
        }

        return lanes;
      })().finally(() => {
        inFlightCoverageLaneRequests.delete(cacheKey);
      });

      inFlightCoverageLaneRequests.set(cacheKey, requestPromise);
      return cloneCoverageLanes(await requestPromise);
    },

    async triggerRebalance(payload): Promise<{ workflowId: string; status: string }> {
      return fetchJson<{ workflowId: string; status: string }>({
        fetchImpl,
        url: `${baseUrl}/v1/orchestration/rebalance`,
        init: {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        },
        timeoutMs: requestTimeoutMs,
        operation: 'triggerRebalance'
      });
    },
  };
};

export * from './integration-adapters';
