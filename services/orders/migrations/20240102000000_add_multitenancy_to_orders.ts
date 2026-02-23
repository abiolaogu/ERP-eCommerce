import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('orders', (table) => {
        table.string('tenant_id').notNullable().defaultTo('default');
        table.string('organization_id'); // B2B
        table.string('purchase_order_number'); // B2B
        table.index(['tenant_id']);
        table.index(['organization_id']);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('orders', (table) => {
        table.dropColumn('tenant_id');
        table.dropColumn('organization_id');
        table.dropColumn('purchase_order_number');
    });
}
