import { CommerceModel, SalesChannel } from '@fusioncommerce/contracts';
import { Knex } from '@fusioncommerce/database';
import { Order } from './types.js';

export interface OrderRepository {
  save(order: Order): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  all(options?: {
    limit: number;
    offset: number;
    tenantId?: string;
    commerceModel?: CommerceModel;
    salesChannel?: SalesChannel;
    vendorId?: string;
  }): Promise<Order[]>;
  init(): Promise<void>;
}

export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>();

  async init(): Promise<void> { }

  async save(order: Order): Promise<Order> {
    this.orders.set(order.id, order);
    return order;
  }

  async findById(id: string): Promise<Order | null> {
    return this.orders.get(id) ?? null;
  }

  async all(options?: {
    limit: number;
    offset: number;
    tenantId?: string;
    commerceModel?: CommerceModel;
    salesChannel?: SalesChannel;
    vendorId?: string;
  }): Promise<Order[]> {
    const limit = options?.limit ?? this.orders.size;
    const offset = options?.offset ?? 0;
    const filtered = Array.from(this.orders.values()).filter((order) => {
      if (options?.tenantId && order.tenantId !== options.tenantId) {
        return false;
      }
      if (options?.commerceModel && order.commerceModel !== options.commerceModel) {
        return false;
      }
      if (options?.salesChannel && order.salesChannel !== options.salesChannel) {
        return false;
      }
      if (options?.vendorId && !order.items.some((item) => item.vendorId === options.vendorId)) {
        return false;
      }
      return true;
    });

    return filtered
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(offset, offset + limit);
  }
}

export class PostgresOrderRepository implements OrderRepository {
  constructor(private readonly knex: Knex) { }

  async init(): Promise<void> {
    const exists = await this.knex.schema.hasTable('orders');
    if (!exists) {
      await this.knex.schema.createTable('orders', (table: Knex.CreateTableBuilder) => {
        table.string('id').primary();
        table.string('customer_id').notNullable();
        table.string('tenant_id').notNullable().defaultTo('default');
        table.string('merchant_id');
        table.string('store_id');
        table.string('commerce_model').notNullable().defaultTo('single_merchant');
        table.string('sales_channel').notNullable().defaultTo('storefront');
        table.string('brand_id');
        table.string('destination_state');
        table.jsonb('items').notNullable();
        table.decimal('total', 10, 2).notNullable();
        table.string('currency').notNullable();
        table.string('status').notNullable();
        table.jsonb('fulfillment_groups');
        table.jsonb('orchestration');
        table.timestamp('created_at').defaultTo(this.knex.fn.now());
      });
    }

    await this.ensureColumn('orders', 'tenant_id', (table) => table.string('tenant_id').notNullable().defaultTo('default'));
    await this.ensureColumn('orders', 'merchant_id', (table) => table.string('merchant_id'));
    await this.ensureColumn('orders', 'store_id', (table) => table.string('store_id'));
    await this.ensureColumn('orders', 'commerce_model', (table) => table.string('commerce_model').notNullable().defaultTo('single_merchant'));
    await this.ensureColumn('orders', 'sales_channel', (table) => table.string('sales_channel').notNullable().defaultTo('storefront'));
    await this.ensureColumn('orders', 'fulfillment_groups', (table) => table.jsonb('fulfillment_groups'));

    await this.knex.raw('CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC)');
    await this.knex.raw('CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders (customer_id)');
    await this.knex.raw('CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders (tenant_id)');
    await this.knex.raw('CREATE INDEX IF NOT EXISTS idx_orders_commerce_model ON orders (commerce_model)');
    await this.knex.raw('CREATE INDEX IF NOT EXISTS idx_orders_sales_channel ON orders (sales_channel)');
    await this.knex.raw('CREATE INDEX IF NOT EXISTS idx_orders_brand_destination ON orders (brand_id, destination_state)');
  }

  async save(order: Order): Promise<Order> {
    await this.knex('orders')
      .insert({
        id: order.id,
        customer_id: order.customerId,
        tenant_id: order.tenantId,
        merchant_id: order.merchantId ?? null,
        store_id: order.storeId ?? null,
        commerce_model: order.commerceModel,
        sales_channel: order.salesChannel,
        brand_id: order.brandId ?? null,
        destination_state: order.destinationState ?? null,
        items: JSON.stringify(order.items),
        total: order.total,
        currency: order.currency,
        status: order.status,
        fulfillment_groups: order.fulfillmentGroups ? JSON.stringify(order.fulfillmentGroups) : null,
        orchestration: order.orchestration ? JSON.stringify(order.orchestration) : null,
        created_at: new Date(order.createdAt)
      })
      .onConflict('id')
      .merge();
    return order;
  }

  async findById(id: string): Promise<Order | null> {
    const row = await this.knex('orders').where({ id }).first();
    if (!row) return null;
    return this.mapRowToOrder(row);
  }

  async all(options?: {
    limit: number;
    offset: number;
    tenantId?: string;
    commerceModel?: CommerceModel;
    salesChannel?: SalesChannel;
    vendorId?: string;
  }): Promise<Order[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const query = this.knex('orders')
      .select('*')
      .orderBy('created_at', 'desc');

    if (options?.tenantId) {
      query.where('tenant_id', options.tenantId);
    }
    if (options?.commerceModel) {
      query.where('commerce_model', options.commerceModel);
    }
    if (options?.salesChannel) {
      query.where('sales_channel', options.salesChannel);
    }
    if (options?.vendorId) {
      query.whereRaw(
        "EXISTS (SELECT 1 FROM jsonb_array_elements(items) item WHERE item->>'vendorId' = ?)",
        [options.vendorId]
      );
    }

    const rows = await query.limit(limit).offset(offset);
    return rows.map((row) => this.mapRowToOrder(row));
  }

  private async ensureColumn(
    tableName: string,
    columnName: string,
    addColumn: (table: Knex.AlterTableBuilder) => void
  ): Promise<void> {
    const hasColumn = await this.knex.schema.hasColumn(tableName, columnName);
    if (!hasColumn) {
      await this.knex.schema.alterTable(tableName, addColumn);
    }
  }

  private mapRowToOrder(row: {
    id: string;
    customer_id: string;
    tenant_id?: string | null;
    merchant_id?: string | null;
    store_id?: string | null;
    commerce_model?: CommerceModel | null;
    sales_channel?: SalesChannel | null;
    brand_id?: string | null;
    destination_state?: string | null;
    items: any;
    total: string;
    currency: string;
    status: any;
    fulfillment_groups?: any;
    orchestration?: any;
    created_at: Date;
  }): Order {
    return {
      id: row.id,
      customerId: row.customer_id,
      tenantId: row.tenant_id ?? 'default',
      merchantId: row.merchant_id ?? undefined,
      storeId: row.store_id ?? undefined,
      commerceModel: row.commerce_model ?? 'single_merchant',
      salesChannel: row.sales_channel ?? 'storefront',
      brandId: row.brand_id ?? undefined,
      destinationState: row.destination_state ?? undefined,
      items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
      total: Number(row.total),
      currency: row.currency,
      status: row.status,
      fulfillmentGroups: row.fulfillment_groups
        ? typeof row.fulfillment_groups === 'string'
          ? JSON.parse(row.fulfillment_groups)
          : row.fulfillment_groups
        : undefined,
      orchestration: row.orchestration
        ? typeof row.orchestration === 'string'
          ? JSON.parse(row.orchestration)
          : row.orchestration
        : undefined,
      createdAt: row.created_at.toISOString()
    };
  }
}
