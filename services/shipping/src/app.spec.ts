import { InMemoryEventBus } from '@fusioncommerce/event-bus';
import { OmniRouteClient } from '@fusioncommerce/omniroute-sdk';
import { buildApp } from './app.js';
import { ShippingRepository } from './shipping-repository.js';
import { ShippingLabel } from './types.js';

// Mock Repository
class MockShippingRepository implements ShippingRepository {
    private labels = new Map<string, ShippingLabel>();
    async save(label: ShippingLabel) { this.labels.set(label.id, label); return label; }
    async findById(id: string) { return this.labels.get(id) ?? null; }
    async findByOrderId(orderId: string) { return Array.from(this.labels.values()).filter(l => l.orderId === orderId); }
    async init() { }
}

describe('shipping service', () => {
    it('creates shipping label', async () => {
        const bus = new InMemoryEventBus();
        const repo = new MockShippingRepository();
        const app = buildApp({ eventBus: bus, repository: repo });

        const response = await app.inject({
            method: 'POST',
            url: '/shipping/labels',
            payload: {
                orderId: 'order-123',
                address: {
                    street: '123 Main St',
                    city: 'New York',
                    country: 'US',
                    zip: '10001'
                }
            }
        });

        expect(response.statusCode).toBe(201);
        const label = response.json();
        expect(label.carrier).toBe('FedEx');
    });

  it('previews lanes through omniroute sdk', async () => {
        const bus = new InMemoryEventBus();
        const repo = new MockShippingRepository();
        const mockClient: OmniRouteClient = {
            evaluateCheckoutPolicy: async () => ({
                compliant: true,
                coverageLane: 'National FMCG Channel',
                expectedSlaHours: 24,
                checks: [{ category: 'Noodles', quantity: 10, requiredMOQ: 10, compliant: true }],
                automationNotes: ['MOQ checks passed for all categories.']
            }),
            listCoverageLanes: async () => [
                { laneId: 'lane-1', owner: 'Lagos Mega Distribution', ownerType: 'distributor', slaHours: 30 }
            ],
            triggerRebalance: async () => ({ workflowId: 'wf-2', status: 'queued' })
        };

        const app = buildApp({ eventBus: bus, repository: repo, omnirouteClient: mockClient });
        const response = await app.inject({
            method: 'POST',
            url: '/shipping/lane-preview',
            payload: {
                destinationState: 'Lagos'
            }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().lanes[0].owner).toBe('Lagos Mega Distribution');
    });

    it('requires vendorId for marketplace shipping labels', async () => {
        const bus = new InMemoryEventBus();
        const repo = new MockShippingRepository();
        const app = buildApp({ eventBus: bus, repository: repo });

        const response = await app.inject({
            method: 'POST',
            url: '/shipping/labels',
            payload: {
                orderId: 'order-456',
                commerceModel: 'marketplace',
                address: {
                    street: '200 Market St',
                    city: 'Seattle',
                    country: 'US',
                    zip: '98101'
                }
            }
        });

        expect(response.statusCode).toBe(400);
    });
});
