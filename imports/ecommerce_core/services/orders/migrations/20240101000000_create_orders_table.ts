import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable('orders');
    if (!exists) {
        await knex.schema.createTable('orders', (table) => {
            table.string('id').primary();
            table.string('user_id').notNullable();
            table.string('product_id').notNullable();
            table.integer('quantity').notNullable();
            table.decimal('total_price', 10, 2).notNullable();
            table.string('currency').notNullable();
            table.string('status').notNullable();
            table.timestamp('created_at').notNullable();
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('orders');
}
