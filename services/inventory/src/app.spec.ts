import { InMemoryEventBus } from '@fusioncommerce/event-bus';
import {
  INVENTORY_FAILED_TOPIC,
  INVENTORY_RESERVED_TOPIC,
  ORDER_CREATED_TOPIC,
  OrderCreatedEvent
} from '@fusioncommerce/contracts';
import { buildApp } from './app.js';

describe('inventory service', () => {
  it('reserves inventory and emits success event', async () => {
    const bus = new InMemoryEventBus();
    const reserved: unknown[] = [];
    await bus.subscribe(INVENTORY_RESERVED_TOPIC, async (event) => {
      reserved.push(event.payload);
    });

    const app = buildApp({ eventBus: bus });
    await app.ready();

    await app.inject({
      method: 'PUT',
      url: '/inventory',
      payload: { sku: 'sku-1', quantity: 5 }
    });

    const orderEvent: OrderCreatedEvent = {
      orderId: 'order-1',
      customerId: 'customer',
      total: 100,
      items: [{ sku: 'sku-1', quantity: 2, price: 50 }]
    };
    await bus.publish(ORDER_CREATED_TOPIC, orderEvent);

    expect(reserved).toHaveLength(1);
  });

  it('emits failure event when stock insufficient', async () => {
    const bus = new InMemoryEventBus();
    const failures: unknown[] = [];
    await bus.subscribe(INVENTORY_FAILED_TOPIC, async (event) => {
      failures.push(event.payload);
    });

    const app = buildApp({ eventBus: bus });
    await app.ready();

    const orderEvent: OrderCreatedEvent = {
      orderId: 'order-2',
      customerId: 'customer',
      total: 100,
      items: [{ sku: 'sku-2', quantity: 1, price: 100 }]
    };
    await bus.publish(ORDER_CREATED_TOPIC, orderEvent);

    expect(failures).toHaveLength(1);
  });

  it('aggregates duplicate order lines before reservation', async () => {
    const bus = new InMemoryEventBus();
    const failures: Array<{ sku?: string; quantity?: number }> = [];
    await bus.subscribe(INVENTORY_FAILED_TOPIC, async (event) => {
      failures.push(event.payload as { sku?: string; quantity?: number });
    });

    const app = buildApp({ eventBus: bus });
    await app.ready();

    await app.inject({
      method: 'PUT',
      url: '/inventory',
      payload: { sku: 'sku-1', quantity: 3 }
    });

    const orderEvent: OrderCreatedEvent = {
      orderId: 'order-3',
      customerId: 'customer',
      total: 200,
      items: [
        { sku: 'sku-1', quantity: 2, price: 50 },
        { sku: 'sku-1', quantity: 2, price: 50 }
      ]
    };

    await bus.publish(ORDER_CREATED_TOPIC, orderEvent);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ sku: 'sku-1', quantity: 4 });
  });

  it('scopes inventory reservations per tenant and vendor for marketplace orders', async () => {
    const bus = new InMemoryEventBus();
    const failures: Array<{ vendorId?: string; sku?: string }> = [];
    await bus.subscribe(INVENTORY_FAILED_TOPIC, async (event) => {
      failures.push(event.payload as { vendorId?: string; sku?: string });
    });

    const app = buildApp({ eventBus: bus });
    await app.ready();

    await app.inject({
      method: 'PUT',
      url: '/inventory',
      payload: { tenantId: 'tenant-m', vendorId: 'vendor-a', sku: 'sku-1', quantity: 2 }
    });

    const orderEvent: OrderCreatedEvent = {
      orderId: 'order-market-1',
      customerId: 'customer',
      tenantId: 'tenant-m',
      commerceModel: 'marketplace',
      total: 100,
      items: [{ sku: 'sku-1', vendorId: 'vendor-b', quantity: 1, price: 100 }]
    };
    await bus.publish(ORDER_CREATED_TOPIC, orderEvent);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ vendorId: 'vendor-b', sku: 'sku-1' });
  });
});
