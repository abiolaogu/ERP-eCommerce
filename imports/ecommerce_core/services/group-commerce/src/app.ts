import Fastify, { FastifyInstance } from 'fastify';
import { EventBus } from '@fusioncommerce/event-bus';
import { GroupCommerceService } from './group-commerce-service.js';
import { InMemoryGroupCommerceRepository, GroupCommerceRepository } from './group-commerce-repository.js';
import { CreateGroupCommerceCampaignRequest, JoinGroupCommerceCampaignRequest, ListCampaignsQuery } from './types.js';

export interface BuildGroupCommerceAppOptions {
  eventBus: EventBus;
  repository?: GroupCommerceRepository;
}

export function buildApp({ eventBus, repository }: BuildGroupCommerceAppOptions): FastifyInstance {
  const app = Fastify({ logger: true });
  const repo = repository ?? new InMemoryGroupCommerceRepository();
  const service = new GroupCommerceService(repo, eventBus);

  app.get('/health', async () => ({ status: 'ok' }));

  app.post<{ Body: CreateGroupCommerceCampaignRequest }>('/campaigns', {
    schema: {
      body: {
        type: 'object',
        required: [
          'productId',
          'minParticipants',
          'maxParticipants',
          'price',
          'originalPrice',
          'startTime',
          'endTime'
        ],
        properties: {
          productId: { type: 'string' },
          minParticipants: { type: 'integer', minimum: 1 },
          maxParticipants: { type: 'integer', minimum: 1 },
          price: { type: 'number', minimum: 0 },
          originalPrice: { type: 'number', minimum: 0 },
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' }
        }
      }
    }
  }, async (request, reply) => {
    const campaign = await service.create(request.body);
    return reply.code(201).send(campaign);
  });

  app.get<{ Querystring: ListCampaignsQuery }>('/campaigns', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 200 },
          offset: { type: 'integer', minimum: 0 }
        }
      }
    }
  }, async (request) => service.list(request.query));

  app.get('/campaigns/:id', async (request) => {
    const { id } = request.params as { id: string };
    return service.findById(id);
  });

  app.post<{ Body: JoinGroupCommerceCampaignRequest; Params: { id: string } }>('/campaigns/:id/join', {
    schema: {
      body: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const { userId } = request.body;
    const campaign = await service.join(id, userId);
    return reply.code(200).send(campaign);
  });

  return app;
}
