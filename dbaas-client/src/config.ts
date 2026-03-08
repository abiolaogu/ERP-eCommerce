export interface DbaasClientConfig {
  baseUrl: string;
  token?: string;
  tokenProvider?: () => Promise<string> | string;
  timeoutMs?: number;
  retries?: number;
  retryBaseDelayMs?: number;
  mockMode?: boolean;
  userAgent?: string;
}

export interface ResolvedClientConfig {
  baseUrl: string;
  timeoutMs: number;
  retries: number;
  retryBaseDelayMs: number;
  mockMode: boolean;
  userAgent: string;
  token?: string;
  tokenProvider?: () => Promise<string> | string;
}

function envBool(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function envNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
}

export function resolveConfig(input: Partial<DbaasClientConfig>): ResolvedClientConfig {
  const baseUrl = input.baseUrl ?? process.env.UCP_DBAAS_BASE_URL ?? "http://localhost:8780";
  const token = input.token ?? process.env.UCP_DBAAS_TOKEN;

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    timeoutMs: input.timeoutMs ?? envNumber(process.env.UCP_DBAAS_TIMEOUT_MS, 10000),
    retries: input.retries ?? envNumber(process.env.UCP_DBAAS_RETRIES, 2),
    retryBaseDelayMs: input.retryBaseDelayMs ?? envNumber(process.env.UCP_DBAAS_RETRY_BASE_DELAY_MS, 250),
    mockMode: input.mockMode ?? envBool(process.env.UCP_DBAAS_MOCK_MODE, false),
    userAgent: input.userAgent ?? "ugcp-dbaas-client-template/0.1.0",
    token,
    tokenProvider: input.tokenProvider,
  };
}
