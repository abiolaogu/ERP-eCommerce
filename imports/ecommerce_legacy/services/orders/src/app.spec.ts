import { InMemoryEventBus } from '@fusioncommerce/event-bus';
import { ORDER_CREATED_TOPIC } from '@fusioncommerce/contracts';
import { OmniRouteClient } from '@fusioncommerce/omniroute-sdk';
import { buildApp } from './app.js';

describe('orders service', () => {
  it('creates orders and publishes events', async () => {
    const bus = new InMemoryEventBus();
    const events: unknown[] = [];
    await bus.subscribe(ORDER_CREATED_TOPIC, async (event) => {
      events.push(event.payload);
    });

    const app = buildApp({ eventBus: bus });
    const payload = {
      customerId: 'customer-123',
      items: [
        { sku: 'sku-1', quantity: 2, price: 10 },
        { sku: 'sku-2', quantity: 1, price: 5 }
      ]
    };
    const response = await app.inject({
      method: 'POST',
      url: '/orders',
      payload
    });
    expect(response.statusCode).toBe(201);
    const order = response.json();
    expect(order.total).toBe(25);
    expect(events).toHaveLength(1);
  });

  it('previews checkout policy through omniroute sdk', async () => {
    const bus = new InMemoryEventBus();
    const mockClient: OmniRouteClient = {
      evaluateCheckoutPolicy: async () => ({
        compliant: true,
        coverageLane: 'National FMCG Channel',
        expectedSlaHours: 24,
        checks: [{ category: 'Noodles', quantity: 10, requiredMOQ: 10, compliant: true }],
        automationNotes: ['MOQ checks passed for all categories.']
      }),
      listCoverageLanes: async () => [],
      triggerRebalance: async () => ({ workflowId: 'wf-1', status: 'queued' })
    };

    const app = buildApp({ eventBus: bus, omnirouteClient: mockClient });
    const response = await app.inject({
      method: 'POST',
      url: '/orders/policy-preview',
      payload: {
        brandId: 'indomie',
        destinationState: 'Lagos',
        items: [{ sku: 'IND-CHK-40', category: 'Noodles', quantity: 10 }]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().coverageLane).toBe('National FMCG Channel');
  });

  it('returns paginated orders list', async () => {
    const bus = new InMemoryEventBus();
    const app = buildApp({ eventBus: bus });

    for (let index = 0; index < 3; index += 1) {
      await app.inject({
        method: 'POST',
        url: '/orders',
        payload: {
          customerId: `customer-${index}`,
          items: [{ sku: `sku-${index}`, quantity: 1, price: 5 }]
        }
      });
    }

    const response = await app.inject({
      method: 'GET',
      url: '/orders?limit=2&offset=1'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(2);
  });

  it('rejects mixed-vendor orders in single-merchant mode', async () => {
    const bus = new InMemoryEventBus();
    const app = buildApp({ eventBus: bus });

    const response = await app.inject({
      method: 'POST',
      url: '/orders',
      payload: {
        customerId: 'customer-1',
        commerceModel: 'single_merchant',
        merchantId: 'merchant-1',
        items: [
          { sku: 'sku-1', quantity: 1, price: 10, vendorId: 'vendor-a' },
          { sku: 'sku-2', quantity: 1, price: 10, vendorId: 'vendor-b' }
        ]
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain('Single-merchant');
  });

  it('supports marketplace orders with vendor fulfillment groups', async () => {
    const bus = new InMemoryEventBus();
    const app = buildApp({ eventBus: bus });

    const response = await app.inject({
      method: 'POST',
      url: '/orders',
      payload: {
        customerId: 'customer-2',
        tenantId: 'tenant-market',
        commerceModel: 'marketplace',
        salesChannel: 'marketplace',
        items: [
          { sku: 'sku-1', quantity: 1, price: 10, vendorId: 'vendor-a' },
          { sku: 'sku-2', quantity: 2, price: 20, vendorId: 'vendor-b' }
        ]
      }
    });

    expect(response.statusCode).toBe(201);
    const order = response.json();
    expect(order.commerceModel).toBe('marketplace');
    expect(order.fulfillmentGroups).toHaveLength(2);

    const filtered = await app.inject({
      method: 'GET',
      url: '/orders?tenantId=tenant-market&commerceModel=marketplace&vendorId=vendor-b'
    });
    expect(filtered.statusCode).toBe(200);
    expect(filtered.json()).toHaveLength(1);
  });

  it('rejects incompatible model and sales channel combinations', async () => {
    const bus = new InMemoryEventBus();
    const app = buildApp({ eventBus: bus });

    const response = await app.inject({
      method: 'POST',
      url: '/orders',
      payload: {
        customerId: 'customer-3',
        commerceModel: 'marketplace',
        salesChannel: 'storefront',
        items: [{ sku: 'sku-1', quantity: 1, price: 10, vendorId: 'vendor-a' }]
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain('marketplace salesChannel');
  });
});
