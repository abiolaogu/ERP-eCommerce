import knex, { Knex } from 'knex';

export interface DatabaseConfig {
  connectionString: string;
  poolMin?: number;
  poolMax?: number;
}

export function createDatabase(config: DatabaseConfig): Knex {
  return knex({
    client: 'pg',
    connection: config.connectionString,
    pool: {
      min: config.poolMin ?? 2,
      max: config.poolMax ?? 10
    }
  });
}

export type { Knex };
