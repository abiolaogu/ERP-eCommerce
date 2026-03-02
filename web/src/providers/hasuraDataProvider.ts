import type { DataProvider, CrudFilters, CrudSorting } from "@refinedev/core";
import { gql } from "graphql-request";
import { graphqlClient, HASURA_URL } from "./graphqlClient";

function mapOperator(op: string): string {
  const map: Record<string, string> = {
    eq: "_eq", ne: "_neq", lt: "_lt", gt: "_gt", lte: "_lte", gte: "_gte",
    in: "_in", nin: "_nin", contains: "_ilike", null: "_is_null",
  };
  return map[op] ?? "_eq";
}

function buildWhere(filters?: CrudFilters): Record<string, unknown> {
  if (!filters?.length) return {};
  const conditions: Record<string, unknown>[] = [];
  for (const f of filters) {
    if ("field" in f) {
      if (f.operator === "contains") {
        conditions.push({ [f.field]: { _ilike: `%${f.value}%` } });
      } else {
        conditions.push({ [f.field]: { [mapOperator(f.operator)]: f.value } });
      }
    }
  }
  return conditions.length === 1 ? conditions[0] : { _and: conditions };
}

function buildOrderBy(sorters?: CrudSorting): Record<string, string>[] | undefined {
  if (!sorters?.length) return undefined;
  return sorters.map((s) => ({ [s.field]: s.order }));
}

const NAMESPACE = "ecom";

function ns(resource: string): string {
  return resource.startsWith(`${NAMESPACE}_`) ? resource : `${NAMESPACE}_${resource}`;
}

export const dataProvider: DataProvider = {
  getList: async ({ resource, pagination, filters, sorters, meta }) => {
    const table = ns(resource);
    const page = pagination?.current ?? 1;
    const pageSize = pagination?.pageSize ?? 25;
    const fields = meta?.fields ? (Array.isArray(meta.fields) ? meta.fields.join("\n") : meta.fields) : "id";
    const where = buildWhere(filters);
    const orderBy = buildOrderBy(sorters);

    const query = gql`
      query ($where: ${table}_bool_exp, $order_by: [${table}_order_by!], $limit: Int, $offset: Int) {
        ${table}(where: $where, order_by: $order_by, limit: $limit, offset: $offset) { ${fields} }
        ${table}_aggregate(where: $where) { aggregate { count } }
      }
    `;
    const result = await graphqlClient.request<Record<string, any>>(query, {
      where: Object.keys(where).length ? where : undefined,
      order_by: orderBy,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return {
      data: result[table] ?? [],
      total: result[`${table}_aggregate`]?.aggregate?.count ?? 0,
    };
  },

  getOne: async ({ resource, id, meta }) => {
    const table = ns(resource);
    const fields = meta?.fields ? (Array.isArray(meta.fields) ? meta.fields.join("\n") : meta.fields) : "id";
    const query = gql`query ($id: String!) { ${table}_by_pk(id: $id) { ${fields} } }`;
    const result = await graphqlClient.request<Record<string, any>>(query, { id: String(id) });
    return { data: result[`${table}_by_pk`] };
  },

  create: async ({ resource, variables, meta }) => {
    const table = ns(resource);
    const fields = meta?.fields ? (Array.isArray(meta.fields) ? meta.fields.join("\n") : meta.fields) : "id";
    const mutation = gql`mutation ($object: ${table}_insert_input!) { insert_${table}_one(object: $object) { ${fields} } }`;
    const result = await graphqlClient.request<Record<string, any>>(mutation, { object: variables });
    return { data: result[`insert_${table}_one`] };
  },

  update: async ({ resource, id, variables, meta }) => {
    const table = ns(resource);
    const fields = meta?.fields ? (Array.isArray(meta.fields) ? meta.fields.join("\n") : meta.fields) : "id";
    const mutation = gql`mutation ($id: String!, $set: ${table}_set_input!) { update_${table}_by_pk(pk_columns: { id: $id }, _set: $set) { ${fields} } }`;
    const result = await graphqlClient.request<Record<string, any>>(mutation, { id: String(id), set: variables });
    return { data: result[`update_${table}_by_pk`] };
  },

  deleteOne: async ({ resource, id, meta }) => {
    const table = ns(resource);
    const fields = meta?.fields ? (Array.isArray(meta.fields) ? meta.fields.join("\n") : meta.fields) : "id";
    const mutation = gql`mutation ($id: String!) { delete_${table}_by_pk(id: $id) { ${fields} } }`;
    const result = await graphqlClient.request<Record<string, any>>(mutation, { id: String(id) });
    return { data: result[`delete_${table}_by_pk`] };
  },

  getApiUrl: () => HASURA_URL,
};
