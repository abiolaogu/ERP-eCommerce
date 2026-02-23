import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable('inventory');
    if (!exists) {
        await knex.schema.createTable('inventory', (table) => {
            table.string('product_id').primary();
            table.integer('quantity').notNullable();
            table.integer('version').notNullable().defaultTo(0);
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('inventory');
}
