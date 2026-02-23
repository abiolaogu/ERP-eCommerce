import type { DataProvider } from "@refinedev/core";
import { GraphQLClient, gql } from "graphql-request";

const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL || "http://localhost:4000/graphql";
const TENANT_ID = import.meta.env.VITE_TENANT_ID || "default-tenant";
const TOKEN_KEY = "ecommerce_auth_token";

function getClient(): GraphQLClient {
  const token = localStorage.getItem(TOKEN_KEY) || "";
  return new GraphQLClient(GRAPHQL_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Tenant-ID": TENANT_ID,
    },
  });
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function singularize(str: string): string {
  if (str.endsWith("ies")) return str.slice(0, -3) + "y";
  if (str.endsWith("ses")) return str.slice(0, -2);
  if (str.endsWith("s")) return str.slice(0, -1);
  return str;
}

export const dataProvider: DataProvider = {
  getList: async ({ resource, pagination, sorters, filters }) => {
    const client = getClient();
    const current = pagination?.current || 1;
    const pageSize = pagination?.pageSize || 10;
    const offset = (current - 1) * pageSize;

    const sortField = sorters?.[0]?.field || "createdAt";
    const sortOrder = sorters?.[0]?.order || "desc";

    const filterArgs = (filters || []).map((f: any) => {
      return `{ field: "${f.field}", operator: "${f.operator}", value: "${f.value}" }`;
    });
    const filterString = filterArgs.length > 0 ? `, filters: [${filterArgs.join(", ")}]` : "";

    const query = gql`
      query GetList {
        ${resource}(
          offset: ${offset},
          limit: ${pageSize},
          sort: { field: "${sortField}", order: "${sortOrder}" }
          ${filterString}
        ) {
          items {
            id
          }
          total
        }
      }
    `;

    try {
      const data: any = await client.request(query);
      const result = data[resource];
      return {
        data: result?.items || [],
        total: result?.total || 0,
      };
    } catch {
      return { data: [], total: 0 };
    }
  },

  getOne: async ({ resource, id }) => {
    const client = getClient();
    const singular = singularize(resource);
    const query = gql`
      query GetOne {
        ${singular}(id: "${id}") {
          id
        }
      }
    `;

    try {
      const data: any = await client.request(query);
      return { data: data[singular] || { id } };
    } catch {
      return { data: { id } as any };
    }
  },

  create: async ({ resource, variables }) => {
    const client = getClient();
    const singular = singularize(resource);
    const mutationName = `create${capitalizeFirst(singular)}`;
    const mutation = gql`
      mutation Create($input: ${capitalizeFirst(singular)}Input!) {
        ${mutationName}(input: $input) {
          id
        }
      }
    `;

    try {
      const data: any = await client.request(mutation, { input: variables } as Record<string, unknown>);
      return { data: data[mutationName] };
    } catch {
      return { data: { id: String(Date.now()), ...(variables as object) } as any };
    }
  },

  update: async ({ resource, id, variables }) => {
    const client = getClient();
    const singular = singularize(resource);
    const mutationName = `update${capitalizeFirst(singular)}`;
    const mutation = gql`
      mutation Update($id: ID!, $input: ${capitalizeFirst(singular)}Input!) {
        ${mutationName}(id: $id, input: $input) {
          id
        }
      }
    `;

    try {
      const data: any = await client.request(mutation, { id, input: variables } as Record<string, unknown>);
      return { data: data[mutationName] };
    } catch {
      return { data: { id, ...(variables as object) } as any };
    }
  },

  deleteOne: async ({ resource, id }) => {
    const client = getClient();
    const singular = singularize(resource);
    const mutationName = `delete${capitalizeFirst(singular)}`;
    const mutation = gql`
      mutation Delete($id: ID!) {
        ${mutationName}(id: $id) {
          id
        }
      }
    `;

    try {
      const data: any = await client.request(mutation, { id });
      return { data: data[mutationName] };
    } catch {
      return { data: { id } as any };
    }
  },

  getApiUrl: () => GRAPHQL_URL,

  custom: async ({ url, method, payload }) => {
    const client = getClient();
    try {
      const data = await client.request(url || "", payload || {});
      return { data: data as any };
    } catch {
      return { data: {} as any };
    }
  },
};
