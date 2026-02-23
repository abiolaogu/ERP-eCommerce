import Fastify, { FastifyInstance } from 'fastify';
import { EventBus } from '@fusioncommerce/event-bus';
import { OmniRouteClient } from '@fusioncommerce/omniroute-sdk';
import { ShippingService } from './shipping-service.js';
import { ShippingRepository } from './shipping-repository.js';
import { CreateShippingLabelRequest, LanePreviewRequest } from './types.js';

export interface BuildAppOptions {
    eventBus: EventBus;
    repository: ShippingRepository;
    omnirouteClient?: OmniRouteClient;
}

export function buildApp({ eventBus, repository, omnirouteClient }: BuildAppOptions): FastifyInstance {
    const app = Fastify({ logger: true });
    const service = new ShippingService(repository, eventBus, omnirouteClient);

    app.get('/health', async () => ({ status: 'ok' }));

    app.post<{ Body: CreateShippingLabelRequest }>('/shipping/labels', {
        schema: {
            body: {
                type: 'object',
                required: ['orderId', 'address'],
                properties: {
                    orderId: { type: 'string' },
                    tenantId: { type: 'string' },
                    vendorId: { type: 'string' },
                    commerceModel: { type: 'string', enum: ['single_merchant', 'marketplace'] },
                    brandId: { type: 'string' },
                    destinationState: { type: 'string' },
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: ['sku', 'category', 'quantity'],
                            properties: {
                                sku: { type: 'string' },
                                category: { type: 'string' },
                                quantity: { type: 'integer', minimum: 1 }
                            }
                        }
                    },
                    address: {
                        type: 'object',
                        required: ['street', 'city', 'country', 'zip'],
                        properties: {
                            street: { type: 'string' },
                            city: { type: 'string' },
                            country: { type: 'string' },
                            zip: { type: 'string' }
                        }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const label = await service.createLabel(request.body);
            return reply.code(201).send(label);
        } catch (error) {
            request.log.error({ err: error }, 'failed to create shipping label');
            return reply.code(400).send({ message: (error as Error).message });
        }
    });

    app.get('/shipping/labels/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const label = await service.getLabel(id);
        if (!label) {
            return reply.code(404).send({ message: 'Label not found' });
        }
        return label;
    });

    app.post<{ Body: LanePreviewRequest }>('/shipping/lane-preview', {
        schema: {
            body: {
                type: 'object',
                required: ['destinationState'],
                properties: {
                    destinationState: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const lanes = await service.previewLanes(request.body.destinationState);
            return reply.code(200).send({ lanes });
        } catch (error) {
            request.log.error({ err: error }, 'failed to preview shipping lanes');
            return reply.code(400).send({ message: (error as Error).message });
        }
    });

    return app;
}
