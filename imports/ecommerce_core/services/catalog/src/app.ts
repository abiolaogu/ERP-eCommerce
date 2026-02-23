import Fastify, { FastifyInstance } from 'fastify';
import { EventBus } from '@fusioncommerce/event-bus';
import { CatalogService } from './catalog-service.js';
import { InMemoryCatalogRepository, CatalogRepository } from './catalog-repository.js';
import { CreateProductRequest, ListProductsQuery } from './types.js';

export interface BuildCatalogAppOptions {
  eventBus: EventBus;
  repository?: CatalogRepository;
}

export function buildApp({ eventBus, repository }: BuildCatalogAppOptions): FastifyInstance {
  const app = Fastify({ logger: true });
  const repo = repository ?? new InMemoryCatalogRepository();
  const service = new CatalogService(repo, eventBus);

  app.get('/health', async () => ({ status: 'ok' }));

  app.post<{ Body: CreateProductRequest }>('/products', {
    schema: {
      body: {
        type: 'object',
        required: ['sku', 'name', 'price', 'currency', 'inventory'],
        properties: {
          tenantId: { type: 'string' },
          merchantId: { type: 'string' },
          vendorId: { type: 'string' },
          commerceModel: { type: 'string', enum: ['single_merchant', 'marketplace'] },
          salesChannels: {
            type: 'array',
            items: { type: 'string', enum: ['storefront', 'marketplace', 'social', 'pos', 'b2b'] },
            minItems: 1
          },
          sku: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          price: { type: 'number', minimum: 0 },
          currency: { type: 'string', minLength: 3, maxLength: 3 },
          inventory: { type: 'integer', minimum: 0 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const product = await service.create(request.body);
      return reply.code(201).send(product);
    } catch (error) {
      request.log.error({ err: error }, 'failed to create product');
      return reply.code(400).send({ message: (error as Error).message });
    }
  });

  app.get<{ Querystring: ListProductsQuery }>('/products', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 200 },
          offset: { type: 'integer', minimum: 0 },
          tenantId: { type: 'string' },
          vendorId: { type: 'string' },
          commerceModel: { type: 'string', enum: ['single_merchant', 'marketplace'] },
          salesChannel: { type: 'string', enum: ['storefront', 'marketplace', 'social', 'pos', 'b2b'] }
        }
      }
    }
  }, async (request) => service.list(request.query));

  return app;
}
