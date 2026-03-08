function parseBool(input: string | undefined, fallback: boolean): boolean {
  if (!input) return fallback;
  return ["1", "true", "yes", "on"].includes(input.toLowerCase());
}

export const serverEnv = {
  dbaasBaseUrl:
    process.env.UCP_DBAAS_BASE_URL ?? process.env.NEXT_PUBLIC_DBAAS_BASE_URL ?? "http://localhost:8780",
  dbaasToken: process.env.UCP_DBAAS_TOKEN ?? "",
  dbaasMockMode: parseBool(
    process.env.UCP_DBAAS_MOCK_MODE ?? process.env.NEXT_PUBLIC_DBAAS_MOCK_MODE,
    true,
  ),
};
