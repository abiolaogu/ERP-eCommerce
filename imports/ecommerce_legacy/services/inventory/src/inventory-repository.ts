import { Knex } from '@fusioncommerce/database';
import { InventoryReservation, StockLevel } from './types.js';

export interface InventoryRepository {
  setStock(level: StockLevel): Promise<void>;
  getStock(sku: string, scope?: { tenantId?: string; vendorId?: string }): Promise<StockLevel | undefined>;
  reserve(
    orderId: string,
    sku: string,
    quantity: number,
    scope?: { tenantId?: string; vendorId?: string }
  ): Promise<InventoryReservation>;
  all(filters?: { tenantId?: string; vendorId?: string }): Promise<StockLevel[]>;
  init(): Promise<void>;
}

export class InMemoryInventoryRepository implements InventoryRepository {
  private readonly stock = new Map<string, { tenantId: string; vendorId: string; sku: string; quantity: number }>();

  async init(): Promise<void> { }

  async setStock(level: StockLevel): Promise<void> {
    const tenantId = level.tenantId || 'default';
    const vendorId = level.vendorId || 'default';
    const key = this.scopeKey(level.sku, tenantId, vendorId);
    this.stock.set(key, {
      tenantId,
      vendorId,
      sku: level.sku,
      quantity: level.quantity
    });
  }

  async getStock(sku: string, scope?: { tenantId?: string; vendorId?: string }): Promise<StockLevel | undefined> {
    const tenantId = scope?.tenantId ?? 'default';
    const vendorId = scope?.vendorId ?? 'default';
    const level = this.stock.get(this.scopeKey(sku, tenantId, vendorId));
    if (!level) return undefined;
    return {
      tenantId: level.tenantId,
      vendorId: level.vendorId,
      sku: level.sku,
      quantity: level.quantity
    };
  }

  async reserve(
    orderId: string,
    sku: string,
    quantity: number,
    scope?: { tenantId?: string; vendorId?: string }
  ): Promise<InventoryReservation> {
    const tenantId = scope?.tenantId ?? 'default';
    const vendorId = scope?.vendorId ?? 'default';
    const key = this.scopeKey(sku, tenantId, vendorId);
    const available = this.stock.get(key)?.quantity ?? 0;
    if (available < quantity) {
      return { orderId, tenantId, vendorId, sku, quantity, status: 'insufficient' };
    }

    this.stock.set(key, { tenantId, vendorId, sku, quantity: available - quantity });
    return { orderId, tenantId, vendorId, sku, quantity, status: 'reserved' };
  }

  async all(filters?: { tenantId?: string; vendorId?: string }): Promise<StockLevel[]> {
    return Array.from(this.stock.values())
      .filter((level) => {
        if (filters?.tenantId && level.tenantId !== filters.tenantId) {
          return false;
        }
        if (filters?.vendorId && level.vendorId !== filters.vendorId) {
          return false;
        }
        return true;
      })
      .map((level) => ({
        tenantId: level.tenantId,
        vendorId: level.vendorId,
        sku: level.sku,
        quantity: level.quantity
      }));
  }

  private scopeKey(sku: string, tenantId: string, vendorId: string): string {
    return `${tenantId}::${vendorId}::${sku}`;
  }
}

export class PostgresInventoryRepository implements InventoryRepository {
  constructor(private readonly knex: Knex) { }

  async init(): Promise<void> {
    const exists = await this.knex.schema.hasTable('inventory');
    if (!exists) {
      await this.knex.schema.createTable('inventory', (table: Knex.CreateTableBuilder) => {
        table.string('tenant_id').notNullable().defaultTo('default');
        table.string('vendor_id').notNullable().defaultTo('default');
        table.string('sku').notNullable();
        table.integer('quantity').notNullable();
        table.primary(['tenant_id', 'vendor_id', 'sku']);
      });
    }

    await this.ensureColumn('inventory', 'tenant_id', (table) => table.string('tenant_id').notNullable().defaultTo('default'));
    await this.ensureColumn('inventory', 'vendor_id', (table) => table.string('vendor_id').notNullable().defaultTo('default'));
    await this.knex.raw('CREATE INDEX IF NOT EXISTS idx_inventory_tenant_vendor ON inventory (tenant_id, vendor_id)');
    await this.knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_scope_sku ON inventory (tenant_id, vendor_id, sku)');
  }

  async setStock(level: StockLevel): Promise<void> {
    const tenantId = level.tenantId || 'default';
    const vendorId = level.vendorId || 'default';
    await this.knex('inventory')
      .insert({
        tenant_id: tenantId,
        vendor_id: vendorId,
        sku: level.sku,
        quantity: level.quantity
      })
      .onConflict(['tenant_id', 'vendor_id', 'sku'])
      .merge();
  }

  async getStock(sku: string, scope?: { tenantId?: string; vendorId?: string }): Promise<StockLevel | undefined> {
    const row = await this.knex('inventory')
      .where({
        sku,
        tenant_id: scope?.tenantId ?? 'default',
        vendor_id: scope?.vendorId ?? 'default'
      })
      .first();
    if (!row) return undefined;
    return {
      tenantId: row.tenant_id,
      vendorId: row.vendor_id,
      sku: row.sku,
      quantity: row.quantity
    };
  }

  async reserve(
    orderId: string,
    sku: string,
    quantity: number,
    scope?: { tenantId?: string; vendorId?: string }
  ): Promise<InventoryReservation> {
    const tenantId = scope?.tenantId ?? 'default';
    const vendorId = scope?.vendorId ?? 'default';
    // Optimistic locking via SQL condition
    const count = await this.knex('inventory')
      .where({
        sku,
        tenant_id: tenantId,
        vendor_id: vendorId
      })
      .andWhere('quantity', '>=', quantity)
      .decrement('quantity', quantity);

    if (count) {
      return { orderId, tenantId, vendorId, sku, quantity, status: 'reserved' };
    }
    return { orderId, tenantId, vendorId, sku, quantity, status: 'insufficient' };
  }

  async all(filters?: { tenantId?: string; vendorId?: string }): Promise<StockLevel[]> {
    const query = this.knex('inventory').select('*');
    if (filters?.tenantId) {
      query.where('tenant_id', filters.tenantId);
    }
    if (filters?.vendorId) {
      query.where('vendor_id', filters.vendorId);
    }

    const rows = await query;
    return rows.map((row: { tenant_id: string; vendor_id: string; sku: string; quantity: number }) => ({
      tenantId: row.tenant_id,
      vendorId: row.vendor_id,
      sku: row.sku,
      quantity: row.quantity
    }));
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
}
