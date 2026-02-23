import { createEventBusFromEnv } from '@fusioncommerce/event-bus';
import { buildApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3000);
const eventBus = createEventBusFromEnv({
  kafkaBrokers: process.env.KAFKA_BROKERS,
  useInMemoryBus: process.env.USE_IN_MEMORY_BUS
});

const app = buildApp({ eventBus });

app
  .listen({ port: PORT, host: '0.0.0.0' })
  .then(() => {
    app.log.info(`Catalog service listening on port ${PORT}`);
  })
  .catch(async (error) => {
    app.log.error({ err: error }, 'failed to start catalog service');
    await eventBus.disconnect();
    process.exit(1);
  });

process.on('SIGINT', async () => {
  await eventBus.disconnect();
  await app.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await eventBus.disconnect();
  await app.close();
  process.exit(0);
});
