import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable('shipping_labels');
    if (!exists) {
        await knex.schema.createTable('shipping_labels', (table) => {
            table.string('id').primary();
            table.string('order_id').notNullable();
            table.string('tracking_number').notNullable();
            table.string('carrier').notNullable();
            table.string('label_url').notNullable();
            table.timestamp('created_at').notNullable();
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('shipping_labels');
}
