import { createEventBusFromEnv } from '@fusioncommerce/event-bus';
import { createDatabase } from '@fusioncommerce/database';
import { buildApp } from './app.js';
import { PostgresGroupCommerceRepository } from './group-commerce-repository.js';

const PORT = Number(process.env.PORT ?? 3003);
const eventBus = createEventBusFromEnv({
  kafkaBrokers: process.env.KAFKA_BROKERS,
  useInMemoryBus: process.env.USE_IN_MEMORY_BUS
});

const db = createDatabase({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ecommerce'
});

const repository = new PostgresGroupCommerceRepository(db);

const app = buildApp({ eventBus, repository });

const start = async (): Promise<void> => {
  try {
    await repository.init();
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`Group Commerce service listening on port ${PORT}`);
  } catch (error) {
    app.log.error({ err: error }, 'failed to start group commerce service');
    await eventBus.disconnect();
    await db.destroy();
    process.exit(1);
  }
};

void start();

const shutdown = async (): Promise<void> => {
  await eventBus.disconnect();
  await db.destroy();
  await app.close();
};

process.on('SIGINT', async () => {
  await shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdown();
  process.exit(0);
});
