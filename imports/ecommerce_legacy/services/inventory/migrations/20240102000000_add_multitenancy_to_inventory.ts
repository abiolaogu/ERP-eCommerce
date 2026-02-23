import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('inventory', (table) => {
        table.string('tenant_id').notNullable().defaultTo('default');
        table.index(['tenant_id']);
        // Drop primary key and recreate composite primary key
        table.dropPrimary();
        table.primary(['product_id', 'tenant_id']);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('inventory', (table) => {
        table.dropPrimary();
        table.primary(['product_id']);
        table.dropColumn('tenant_id');
    });
}
