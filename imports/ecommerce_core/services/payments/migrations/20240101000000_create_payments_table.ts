import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable('payments');
    if (!exists) {
        await knex.schema.createTable('payments', (table) => {
            table.string('id').primary();
            table.string('order_id').notNullable();
            table.decimal('amount', 10, 2).notNullable();
            table.string('currency').notNullable();
            table.string('status').notNullable();
            table.timestamp('created_at').notNullable();
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('payments');
}
