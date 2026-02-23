import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('group_commerce_campaigns', (table) => {
        table.string('tenant_id').notNullable().defaultTo('default');
        table.index(['tenant_id']);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('group_commerce_campaigns', (table) => {
        table.dropColumn('tenant_id');
    });
}
