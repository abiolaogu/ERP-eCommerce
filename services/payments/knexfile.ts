import type { Knex } from 'knex';

const config: Knex.Config = {
    client: 'pg',
    connection: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ecommerce',
    migrations: {
        directory: './migrations',
        extension: 'ts'
    }
};

export default config;
