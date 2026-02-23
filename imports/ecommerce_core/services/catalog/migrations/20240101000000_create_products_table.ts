import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable('products');
    if (!exists) {
        await knex.schema.createTable('products', (table) => {
            table.string('id').primary();
            table.string('tenant_id').notNullable(); // Multi-tenancy
            table.string('vendor_id').notNullable(); // Marketplace
            table.string('name').notNullable();
            table.text('description');
            table.decimal('price', 10, 2).notNullable();
            table.decimal('wholesale_price', 10, 2); // B2B
            table.jsonb('tier_pricing'); // B2B: [{ min_qty: 10, price: 90 }]
            table.string('currency').notNullable().defaultTo('USD');
            table.timestamp('created_at').notNullable();

            table.index(['tenant_id']);
            table.index(['vendor_id']);
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('products');
}
