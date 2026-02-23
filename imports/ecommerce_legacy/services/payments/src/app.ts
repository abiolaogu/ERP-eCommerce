import Fastify, { FastifyInstance } from 'fastify';
import { EventBus } from '@fusioncommerce/event-bus';
import { PaymentService } from './payment-service.js';
import { PaymentRepository } from './payment-repository.js';
import { CreatePaymentRequest } from './types.js';

export interface BuildAppOptions {
    eventBus: EventBus;
    repository: PaymentRepository;
}

export function buildApp({ eventBus, repository }: BuildAppOptions): FastifyInstance {
    const app = Fastify({ logger: true });
    const service = new PaymentService(repository, eventBus);

    app.get('/health', async () => ({ status: 'ok' }));

    app.post<{ Body: CreatePaymentRequest }>('/payments', {
        schema: {
            body: {
                type: 'object',
                required: ['orderId', 'amount', 'currency', 'paymentMethodId'],
                properties: {
                    orderId: { type: 'string' },
                    tenantId: { type: 'string' },
                    merchantId: { type: 'string' },
                    commerceModel: { type: 'string', enum: ['single_merchant', 'marketplace'] },
                    settlementMode: { type: 'string', enum: ['single', 'split'] },
                    allocations: {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: ['vendorId', 'amount'],
                            properties: {
                                vendorId: { type: 'string' },
                                amount: { type: 'number', minimum: 0 }
                            }
                        }
                    },
                    amount: { type: 'number', minimum: 0 },
                    currency: { type: 'string' },
                    paymentMethodId: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const payment = await service.processPayment(request.body);
            return reply.code(201).send(payment);
        } catch (error) {
            request.log.error({ err: error }, 'failed to process payment');
            return reply.code(400).send({ message: (error as Error).message });
        }
    });

    app.get('/payments/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const payment = await service.getPayment(id);
        if (!payment) {
            return reply.code(404).send({ message: 'Payment not found' });
        }
        return payment;
    });

    return app;
}
