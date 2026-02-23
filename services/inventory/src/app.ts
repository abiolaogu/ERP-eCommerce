import Fastify, { FastifyInstance } from 'fastify';
import { EventBus, EventEnvelope } from '@fusioncommerce/event-bus';
import { ORDER_CREATED_TOPIC, OrderCreatedEvent } from '@fusioncommerce/contracts';
import { InMemoryInventoryRepository, InventoryRepository } from './inventory-repository.js';
import { InventoryService } from './inventory-service.js';
import { ConfigureStockRequest } from './types.js';

export interface BuildInventoryAppOptions {
  eventBus: EventBus;
  repository?: InventoryRepository;
}

export function buildApp({ eventBus, repository }: BuildInventoryAppOptions): FastifyInstance {
  const app = Fastify({ logger: true });
  const repo = repository ?? new InMemoryInventoryRepository();
  const service = new InventoryService(repo, eventBus);

  app.addHook('onReady', async () => {
    await eventBus.subscribe<OrderCreatedEvent>(ORDER_CREATED_TOPIC, (event) =>
      service.handleOrderCreated(event)
    );
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.put<{ Body: ConfigureStockRequest }>('/inventory', {
    schema: {
      body: {
        type: 'object',
        required: ['sku', 'quantity'],
        properties: {
          tenantId: { type: 'string' },
          vendorId: { type: 'string' },
          commerceModel: { type: 'string', enum: ['single_merchant', 'marketplace'] },
          sku: { type: 'string' },
          quantity: { type: 'integer', minimum: 0 }
        }
      }
    }
  }, async (request, reply) => {
    await service.configureStock(request.body);
    return reply.code(204).send();
  });

  app.get<{ Querystring: { tenantId?: string; vendorId?: string } }>('/inventory', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          tenantId: { type: 'string' },
          vendorId: { type: 'string' }
        }
      }
    }
  }, async (request) => service.listStock(request.query));

  return app;
}
