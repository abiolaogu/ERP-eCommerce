import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable('group_commerce_campaigns');
    if (!exists) {
        await knex.schema.createTable('group_commerce_campaigns', (table) => {
            table.string('id').primary();
            table.string('product_id').notNullable();
            table.integer('min_participants').notNullable();
            table.integer('max_participants').notNullable();
            table.integer('actual_participants').notNullable();
            table.decimal('price', 10, 2).notNullable();
            table.decimal('original_price', 10, 2).notNullable();
            table.timestamp('start_time').notNullable();
            table.timestamp('end_time').notNullable();
            table.string('status').notNullable();
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('group_commerce_campaigns');
}
