import type { LiveProvider, LiveEvent } from "@refinedev/core";
import { createClient } from "graphql-ws";
import { HASURA_WS_URL } from "./graphqlClient";

const NAMESPACE = "ecom";

function ns(resource: string): string {
  return resource.startsWith(`${NAMESPACE}_`) ? resource : `${NAMESPACE}_${resource}`;
}

const wsClient = createClient({
  url: HASURA_WS_URL,
  connectionParams: () => {
    const token = localStorage.getItem("erp_token");
    return { headers: token ? { Authorization: `Bearer ${token}` } : {} };
  },
  retryAttempts: Infinity,
  shouldRetry: () => true,
});

export const liveProvider: LiveProvider = {
  subscribe: ({ channel, params, callback, ...rest }) => {
    const resource = (rest as any).resource ?? channel;
    const table = ns(resource);
    const fields = params?.meta?.fields
      ? (Array.isArray(params.meta.fields) ? params.meta.fields.join("\n") : params.meta.fields)
      : "id";

    const query = params?.id
      ? `subscription ($id: String!) { ${table}_by_pk(id: $id) { ${fields} } }`
      : `subscription { ${table}(limit: 100) { ${fields} } }`;

    const variables: Record<string, unknown> = {};
    if (params?.id) variables.id = params.id;

    const unsubscribe = wsClient.subscribe(
      { query, variables },
      {
        next: (result) => {
          callback({ channel, type: "created", date: new Date(), payload: { data: result.data } } as LiveEvent);
        },
        error: (err) => console.error(`[live] ${resource}:`, err),
        complete: () => {},
      },
    );
    return unsubscribe;
  },
  unsubscribe: (unsub: () => void) => unsub(),
};
