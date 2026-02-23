import Fastify, { FastifyInstance } from 'fastify';
import { EventBus } from '@fusioncommerce/event-bus';
import { OmniRouteClient } from '@fusioncommerce/omniroute-sdk';
import { InMemoryOrderRepository, OrderRepository } from './order-repository.js';
import { OrderService } from './order-service.js';
import { CreateOrderRequest, ListOrdersQuery, PolicyPreviewRequest } from './types.js';

export interface BuildAppOptions {
  eventBus: EventBus;
  repository?: OrderRepository;
  omnirouteClient?: OmniRouteClient;
}

export function buildApp({ eventBus, repository, omnirouteClient }: BuildAppOptions): FastifyInstance {
  const app = Fastify({ logger: true });
  const repo = repository ?? new InMemoryOrderRepository();
  const service = new OrderService(repo, eventBus, omnirouteClient);

  app.get('/health', async () => ({ status: 'ok' }));

  app.post<{ Body: CreateOrderRequest }>('/orders', {
    schema: {
      body: {
        type: 'object',
        required: ['customerId', 'items'],
        properties: {
          customerId: { type: 'string' },
          tenantId: { type: 'string' },
          merchantId: { type: 'string' },
          storeId: { type: 'string' },
          commerceModel: { type: 'string', enum: ['single_merchant', 'marketplace'] },
          salesChannel: { type: 'string', enum: ['storefront', 'marketplace', 'social', 'pos', 'b2b'] },
          brandId: { type: 'string' },
          destinationState: { type: 'string' },
          currency: { type: 'string' },
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['sku', 'quantity', 'price'],
              properties: {
                sku: { type: 'string' },
                category: { type: 'string' },
                quantity: { type: 'integer', minimum: 1 },
                price: { type: 'number', minimum: 0 },
                vendorId: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const order = await service.create(request.body);
      return reply.code(201).send(order);
    } catch (error) {
      request.log.error({ err: error }, 'failed to create order');
      return reply.code(400).send({ message: (error as Error).message });
    }
  });

  app.get<{ Querystring: ListOrdersQuery }>('/orders', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 200 },
          offset: { type: 'integer', minimum: 0 },
          tenantId: { type: 'string' },
          commerceModel: { type: 'string', enum: ['single_merchant', 'marketplace'] },
          salesChannel: { type: 'string', enum: ['storefront', 'marketplace', 'social', 'pos', 'b2b'] },
          vendorId: { type: 'string' }
        }
      }
    }
  }, async (request) => service.list(request.query));

  app.post<{ Body: PolicyPreviewRequest }>('/orders/policy-preview', {
    schema: {
      body: {
        type: 'object',
        required: ['brandId', 'destinationState', 'items'],
        properties: {
          tenantId: { type: 'string' },
          brandId: { type: 'string' },
          destinationState: { type: 'string' },
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['sku', 'category', 'quantity'],
              properties: {
                sku: { type: 'string' },
                category: { type: 'string' },
                quantity: { type: 'integer', minimum: 1 }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const preview = await service.previewPolicy(request.body);
      return reply.code(200).send(preview);
    } catch (error) {
      request.log.error({ err: error }, 'failed to preview policy');
      return reply.code(400).send({ message: (error as Error).message });
    }
  });

  return app;
}
