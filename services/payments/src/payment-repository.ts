import { Knex } from '@fusioncommerce/database';
import { Payment } from './types.js';

export interface PaymentRepository {
    save(payment: Payment): Promise<Payment>;
    findById(id: string): Promise<Payment | null>;
    findByOrderId(orderId: string): Promise<Payment[]>;
    init(): Promise<void>;
}

export class PostgresPaymentRepository implements PaymentRepository {
    constructor(private readonly knex: Knex) { }

    async init(): Promise<void> {
        const exists = await this.knex.schema.hasTable('payments');
        if (!exists) {
            await this.knex.schema.createTable('payments', (table: Knex.CreateTableBuilder) => {
                table.string('id').primary();
                table.string('order_id').notNullable();
                table.string('tenant_id').notNullable().defaultTo('default');
                table.string('merchant_id');
                table.string('commerce_model').notNullable().defaultTo('single_merchant');
                table.string('settlement_mode').notNullable().defaultTo('single');
                table.jsonb('allocations');
                table.decimal('amount', 10, 2).notNullable();
                table.string('currency').notNullable();
                table.string('status').notNullable();
                table.timestamp('created_at').notNullable();
            });
        }

        await this.ensureColumn('payments', 'tenant_id', (table) => table.string('tenant_id').notNullable().defaultTo('default'));
        await this.ensureColumn('payments', 'merchant_id', (table) => table.string('merchant_id'));
        await this.ensureColumn('payments', 'commerce_model', (table) => table.string('commerce_model').notNullable().defaultTo('single_merchant'));
        await this.ensureColumn('payments', 'settlement_mode', (table) => table.string('settlement_mode').notNullable().defaultTo('single'));
        await this.ensureColumn('payments', 'allocations', (table) => table.jsonb('allocations'));

        await this.knex.raw('CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments (order_id)');
        await this.knex.raw('CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments (tenant_id)');
        await this.knex.raw('CREATE INDEX IF NOT EXISTS idx_payments_commerce_model ON payments (commerce_model)');
        await this.knex.raw('CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments (created_at DESC)');
    }

    async save(payment: Payment): Promise<Payment> {
        await this.knex('payments')
            .insert({
                id: payment.id,
                order_id: payment.orderId,
                tenant_id: payment.tenantId,
                merchant_id: payment.merchantId ?? null,
                commerce_model: payment.commerceModel,
                settlement_mode: payment.settlementMode,
                allocations: payment.allocations ? JSON.stringify(payment.allocations) : null,
                amount: payment.amount,
                currency: payment.currency,
                status: payment.status,
                created_at: new Date(payment.createdAt)
            })
            .onConflict('id')
            .merge();
        return payment;
    }

    async findById(id: string): Promise<Payment | null> {
        const row = await this.knex('payments').where({ id }).first();
        if (!row) return null;
        return this.mapRowToPayment(row);
    }

    async findByOrderId(orderId: string): Promise<Payment[]> {
        const rows = await this.knex('payments').where({ order_id: orderId });
        return rows.map((row: any) => this.mapRowToPayment(row));
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

    private mapRowToPayment(row: {
        id: string;
        order_id: string;
        tenant_id?: string | null;
        merchant_id?: string | null;
        commerce_model?: any;
        settlement_mode?: any;
        allocations?: any;
        amount: string;
        currency: string;
        status: any;
        created_at: Date
    }): Payment {
        return {
            id: row.id,
            orderId: row.order_id,
            tenantId: row.tenant_id ?? 'default',
            merchantId: row.merchant_id ?? undefined,
            commerceModel: row.commerce_model ?? 'single_merchant',
            settlementMode: row.settlement_mode ?? 'single',
            allocations: row.allocations
                ? typeof row.allocations === 'string'
                    ? JSON.parse(row.allocations)
                    : row.allocations
                : undefined,
            amount: Number(row.amount),
            currency: row.currency,
            status: row.status,
            createdAt: row.created_at.toISOString()
        };
    }
}
