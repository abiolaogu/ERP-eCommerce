import { Knex } from '@fusioncommerce/database';
import { ShippingLabel } from './types.js';

export interface ShippingRepository {
    save(label: ShippingLabel): Promise<ShippingLabel>;
    findById(id: string): Promise<ShippingLabel | null>;
    findByOrderId(orderId: string): Promise<ShippingLabel[]>;
    init(): Promise<void>;
}

export class PostgresShippingRepository implements ShippingRepository {
    constructor(private readonly knex: Knex) { }

    async init(): Promise<void> {
        const exists = await this.knex.schema.hasTable('shipping_labels');
        if (!exists) {
            await this.knex.schema.createTable('shipping_labels', (table: Knex.CreateTableBuilder) => {
                table.string('id').primary();
                table.string('order_id').notNullable();
                table.string('tenant_id').notNullable().defaultTo('default');
                table.string('vendor_id');
                table.string('commerce_model').notNullable().defaultTo('single_merchant');
                table.string('tracking_number').notNullable();
                table.string('carrier').notNullable();
                table.string('label_url').notNullable();
                table.jsonb('orchestration');
                table.timestamp('created_at').notNullable();
            });
        }

        await this.ensureColumn('shipping_labels', 'tenant_id', (table) => table.string('tenant_id').notNullable().defaultTo('default'));
        await this.ensureColumn('shipping_labels', 'vendor_id', (table) => table.string('vendor_id'));
        await this.ensureColumn('shipping_labels', 'commerce_model', (table) => table.string('commerce_model').notNullable().defaultTo('single_merchant'));

        await this.knex.raw('CREATE INDEX IF NOT EXISTS idx_shipping_labels_order_id ON shipping_labels (order_id)');
        await this.knex.raw('CREATE INDEX IF NOT EXISTS idx_shipping_labels_tenant_id ON shipping_labels (tenant_id)');
        await this.knex.raw('CREATE INDEX IF NOT EXISTS idx_shipping_labels_vendor_id ON shipping_labels (vendor_id)');
        await this.knex.raw('CREATE INDEX IF NOT EXISTS idx_shipping_labels_created_at ON shipping_labels (created_at DESC)');
    }

    async save(label: ShippingLabel): Promise<ShippingLabel> {
        await this.knex('shipping_labels')
            .insert({
                id: label.id,
                order_id: label.orderId,
                tenant_id: label.tenantId,
                vendor_id: label.vendorId ?? null,
                commerce_model: label.commerceModel,
                tracking_number: label.trackingNumber,
                carrier: label.carrier,
                label_url: label.labelUrl,
                orchestration: label.orchestration ? JSON.stringify(label.orchestration) : null,
                created_at: new Date(label.createdAt)
            })
            .onConflict('id')
            .merge();
        return label;
    }

    async findById(id: string): Promise<ShippingLabel | null> {
        const row = await this.knex('shipping_labels').where({ id }).first();
        if (!row) return null;
        return this.mapRowToLabel(row);
    }

    async findByOrderId(orderId: string): Promise<ShippingLabel[]> {
        const rows = await this.knex('shipping_labels').where({ order_id: orderId });
        return rows.map((row: any) => this.mapRowToLabel(row));
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

    private mapRowToLabel(row: {
        id: string;
        order_id: string;
        tenant_id?: string | null;
        vendor_id?: string | null;
        commerce_model?: any;
        tracking_number: string;
        carrier: string;
        label_url: string;
        orchestration?: any;
        created_at: Date;
    }): ShippingLabel {
        return {
            id: row.id,
            orderId: row.order_id,
            tenantId: row.tenant_id ?? 'default',
            vendorId: row.vendor_id ?? undefined,
            commerceModel: row.commerce_model ?? 'single_merchant',
            trackingNumber: row.tracking_number,
            carrier: row.carrier,
            labelUrl: row.label_url,
            orchestration: row.orchestration
                ? typeof row.orchestration === 'string'
                    ? JSON.parse(row.orchestration)
                    : row.orchestration
                : undefined,
            createdAt: row.created_at.toISOString()
        };
    }
}
