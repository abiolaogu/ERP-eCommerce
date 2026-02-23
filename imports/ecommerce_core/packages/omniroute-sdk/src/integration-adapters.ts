import type { CoverageLaneResponse, PolicyCheckRequest, PolicyCheckResponse } from './index';

export interface FusionPolicyLineInput {
  sku: string;
  category?: string;
  quantity: number;
}

export interface FusionOrderDraft {
  brandId: string;
  destinationState: string;
  items: FusionPolicyLineInput[];
}

export interface FusionCheckoutLine {
  sku: string;
  category?: string;
  quantity: number;
  price: number;
  vendorId?: string;
}

export interface FusionPolicyPreviewRequest {
  tenantId?: string;
  brandId: string;
  destinationState: string;
  items: FusionPolicyLineInput[];
}

export interface FusionCreateOrderRequest {
  customerId: string;
  tenantId?: string;
  merchantId?: string;
  storeId?: string;
  commerceModel?: 'single_merchant' | 'marketplace';
  salesChannel?: 'storefront' | 'marketplace' | 'social' | 'pos' | 'b2b';
  brandId?: string;
  destinationState?: string;
  currency?: string;
  items: FusionCheckoutLine[];
}

export interface FusionServiceAdapterConfig {
  ordersServiceUrl: string;
  shippingServiceUrl: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
  laneCacheTtlMs?: number;
}

const normalizeServiceUrl = (value: string): string => value.replace(/\/+$/, '');
const normalizeLaneCacheKey = (destinationState: string): string => destinationState.trim().toLowerCase();
const DEFAULT_REQUEST_TIMEOUT_MS = 3000;
const DEFAULT_LANE_CACHE_TTL_MS = 10000;

const parseServiceResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Fusion service request failed: ${response.status} ${message}`);
  }

  return response.json() as Promise<T>;
};

const fetchWithTimeout = async ({
  fetchImpl,
  timeoutMs,
  url,
  init,
  operation
}: {
  fetchImpl: typeof fetch;
  timeoutMs: number;
  url: string;
  init: RequestInit;
  operation: string;
}): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Fusion service request timed out (${operation}) after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const normalizeFusionPolicyLines = (
  items: FusionPolicyLineInput[],
  fallbackCategory = 'General'
): Array<{ sku: string; category: string; quantity: number }> => {
  return items.map((item) => ({
    sku: item.sku,
    category: item.category || fallbackCategory,
    quantity: item.quantity,
  }));
};

export const mapFusionOrderToPolicyRequest = (draft: FusionOrderDraft): PolicyCheckRequest => {
  return {
    brandId: draft.brandId,
    destinationState: draft.destinationState,
    lines: normalizeFusionPolicyLines(draft.items),
  };
};

export const createFusionServiceAdapters = (config: FusionServiceAdapterConfig) => {
  const fetchImpl = config.fetchImpl ?? fetch;
  const ordersServiceUrl = normalizeServiceUrl(config.ordersServiceUrl);
  const shippingServiceUrl = normalizeServiceUrl(config.shippingServiceUrl);
  const requestTimeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const laneCacheTtlMs = config.laneCacheTtlMs ?? DEFAULT_LANE_CACHE_TTL_MS;
  const laneCache = new Map<string, { value: CoverageLaneResponse[]; expiresAt: number }>();
  const inFlightLaneRequests = new Map<string, Promise<CoverageLaneResponse[]>>();

  return {
    async previewPolicy(input: FusionPolicyPreviewRequest): Promise<PolicyCheckResponse> {
      const response = await fetchWithTimeout({
        fetchImpl,
        timeoutMs: requestTimeoutMs,
        url: `${ordersServiceUrl}/orders/policy-preview`,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenantId: input.tenantId,
            brandId: input.brandId,
            destinationState: input.destinationState,
            items: normalizeFusionPolicyLines(input.items),
          }),
        },
        operation: 'previewPolicy'
      });

      return parseServiceResponse<PolicyCheckResponse>(response);
    },

    async createOrder(input: FusionCreateOrderRequest): Promise<Record<string, unknown>> {
      const response = await fetchWithTimeout({
        fetchImpl,
        timeoutMs: requestTimeoutMs,
        url: `${ordersServiceUrl}/orders`,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        },
        operation: 'createOrder'
      });

      return parseServiceResponse<Record<string, unknown>>(response);
    },

    async previewShippingLanes(destinationState: string): Promise<CoverageLaneResponse[]> {
      const normalizedDestinationState = destinationState.trim();
      if (!normalizedDestinationState) {
        return [];
      }

      const cacheKey = normalizeLaneCacheKey(normalizedDestinationState);
      const now = Date.now();
      const cached = laneCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        return cached.value.map((lane) => ({ ...lane }));
      }

      const inFlightRequest = inFlightLaneRequests.get(cacheKey);
      if (inFlightRequest) {
        return (await inFlightRequest).map((lane) => ({ ...lane }));
      }

      const requestPromise = (async () => {
        const response = await fetchWithTimeout({
          fetchImpl,
          timeoutMs: requestTimeoutMs,
          url: `${shippingServiceUrl}/shipping/lane-preview`,
          init: {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ destinationState: normalizedDestinationState }),
          },
          operation: 'previewShippingLanes'
        });

        const payload = await parseServiceResponse<{ lanes: CoverageLaneResponse[] }>(response);

        if (laneCacheTtlMs > 0) {
          laneCache.set(cacheKey, {
            value: payload.lanes.map((lane) => ({ ...lane })),
            expiresAt: Date.now() + laneCacheTtlMs
          });
        }

        return payload.lanes;
      })().finally(() => {
        inFlightLaneRequests.delete(cacheKey);
      });

      inFlightLaneRequests.set(cacheKey, requestPromise);
      return (await requestPromise).map((lane) => ({ ...lane }));
    },
  };
};
