import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('shipping_labels', (table) => {
        table.string('tenant_id').notNullable().defaultTo('default');
        table.index(['tenant_id']);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('shipping_labels', (table) => {
        table.dropColumn('tenant_id');
    });
}
