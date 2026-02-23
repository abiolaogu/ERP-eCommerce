import { InMemoryEventBus } from '@fusioncommerce/event-bus';
import { buildApp } from './app.js';

import { Payment } from './types.js';

jest.mock('stripe', () => {
    return jest.fn().mockImplementation(() => ({
        paymentIntents: {
            create: jest.fn().mockResolvedValue({
                status: 'succeeded',
                id: 'pi_mock'
            })
        }
    }));
});

// Mock InMemory Repository for testing
class MockPaymentRepository {
    private payments = new Map<string, Payment>();
    async save(payment: Payment) { this.payments.set(payment.id, payment); return payment; }
    async findById(id: string) { return this.payments.get(id) ?? null; }
    async findByOrderId(orderId: string) { return Array.from(this.payments.values()).filter(p => p.orderId === orderId); }
    async init() { }
}

describe('payments service', () => {
    it('processes payment', async () => {
        const bus = new InMemoryEventBus();
        const repo = new MockPaymentRepository();
        const app = buildApp({ eventBus: bus, repository: repo as any });

        const response = await app.inject({
            method: 'POST',
            url: '/payments',
            payload: {
                orderId: 'order-123',
                amount: 100,
                currency: 'USD',
                paymentMethodId: 'pm-123'
            }
        });

        expect(response.statusCode).toBe(201);
        const payment = response.json();
        expect(payment.status).toBe('succeeded'); // Mock logic succeeds
    });

    it('supports marketplace split-settlement payments', async () => {
        const bus = new InMemoryEventBus();
        const repo = new MockPaymentRepository();
        const app = buildApp({ eventBus: bus, repository: repo as any });

        const response = await app.inject({
            method: 'POST',
            url: '/payments',
            payload: {
                orderId: 'order-market-1',
                tenantId: 'tenant-market',
                commerceModel: 'marketplace',
                settlementMode: 'split',
                allocations: [
                    { vendorId: 'vendor-a', amount: 30 },
                    { vendorId: 'vendor-b', amount: 70 }
                ],
                amount: 100,
                currency: 'USD',
                paymentMethodId: 'pm-456'
            }
        });

        expect(response.statusCode).toBe(201);
        expect(response.json().settlementMode).toBe('split');
        expect(response.json().allocations).toHaveLength(2);
    });

    it('rejects invalid split allocations', async () => {
        const bus = new InMemoryEventBus();
        const repo = new MockPaymentRepository();
        const app = buildApp({ eventBus: bus, repository: repo as any });

        const response = await app.inject({
            method: 'POST',
            url: '/payments',
            payload: {
                orderId: 'order-market-2',
                tenantId: 'tenant-market',
                commerceModel: 'marketplace',
                settlementMode: 'split',
                allocations: [
                    { vendorId: 'vendor-a', amount: 20 },
                    { vendorId: 'vendor-b', amount: 20 }
                ],
                amount: 100,
                currency: 'USD',
                paymentMethodId: 'pm-789'
            }
        });

        expect(response.statusCode).toBe(400);
    });
});
