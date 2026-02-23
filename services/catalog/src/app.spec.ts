import { InMemoryEventBus } from '@fusioncommerce/event-bus';
import { buildApp } from './app.js';

describe('catalog service', () => {
  it('creates and lists products', async () => {
    const bus = new InMemoryEventBus();
    const app = buildApp({ eventBus: bus });
    const payload = {
      sku: 'sku-1',
      name: 'Test Product',
      description: 'A sample product',
      price: 20,
      currency: 'USD',
      inventory: 10
    };

    const createResponse = await app.inject({ method: 'POST', url: '/products', payload });
    expect(createResponse.statusCode).toBe(201);

    const listResponse = await app.inject({ method: 'GET', url: '/products' });
    const products = listResponse.json();
    expect(products).toHaveLength(1);
  });

  it('supports paginated product listing', async () => {
    const bus = new InMemoryEventBus();
    const app = buildApp({ eventBus: bus });

    for (let index = 0; index < 3; index += 1) {
      await app.inject({
        method: 'POST',
        url: '/products',
        payload: {
          sku: `sku-${index}`,
          name: `Test Product ${index}`,
          price: 20 + index,
          currency: 'USD',
          inventory: 10
        }
      });
    }

    const response = await app.inject({
      method: 'GET',
      url: '/products?limit=2&offset=1'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(2);
  });

  it('requires vendorId for marketplace products', async () => {
    const bus = new InMemoryEventBus();
    const app = buildApp({ eventBus: bus });

    const response = await app.inject({
      method: 'POST',
      url: '/products',
      payload: {
        tenantId: 'tenant-market',
        commerceModel: 'marketplace',
        sku: 'market-sku-1',
        name: 'Marketplace Item',
        price: 33,
        currency: 'USD',
        inventory: 5
      }
    });

    expect(response.statusCode).toBe(400);
  });

  it('filters products by model, tenant, and channel', async () => {
    const bus = new InMemoryEventBus();
    const app = buildApp({ eventBus: bus });

    await app.inject({
      method: 'POST',
      url: '/products',
      payload: {
        tenantId: 'tenant-a',
        merchantId: 'merchant-a',
        sku: 'shop-sku',
        name: 'Shop Product',
        price: 15,
        currency: 'USD',
        inventory: 10
      }
    });

    await app.inject({
      method: 'POST',
      url: '/products',
      payload: {
        tenantId: 'tenant-market',
        commerceModel: 'marketplace',
        vendorId: 'vendor-1',
        salesChannels: ['marketplace'],
        sku: 'market-sku',
        name: 'Market Product',
        price: 25,
        currency: 'USD',
        inventory: 20
      }
    });

    const response = await app.inject({
      method: 'GET',
      url: '/products?tenantId=tenant-market&commerceModel=marketplace&salesChannel=marketplace'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    expect(response.json()[0].vendorId).toBe('vendor-1');
  });
});
