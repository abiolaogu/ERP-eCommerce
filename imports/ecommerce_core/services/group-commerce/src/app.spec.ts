import { InMemoryEventBus } from '@fusioncommerce/event-bus';
import { buildApp } from './app.js';

describe('group commerce service', () => {
  it('creates and lists group commerce campaigns', async () => {
    const bus = new InMemoryEventBus();
    const app = buildApp({ eventBus: bus });
    const payload = {
      productId: 'product-1',
      minParticipants: 2,
      maxParticipants: 10,
      price: 10,
      originalPrice: 20,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    const createResponse = await app.inject({ method: 'POST', url: '/campaigns', payload });
    expect(createResponse.statusCode).toBe(201);

    const listResponse = await app.inject({ method: 'GET', url: '/campaigns' });
    const campaigns = listResponse.json();
    expect(campaigns).toHaveLength(1);
  });

  it('allows a user to join a campaign', async () => {
    const bus = new InMemoryEventBus();
    const app = buildApp({ eventBus: bus });
    const createPayload = {
      productId: 'product-1',
      minParticipants: 2,
      maxParticipants: 10,
      price: 10,
      originalPrice: 20,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    const createResponse = await app.inject({ method: 'POST', url: '/campaigns', payload: createPayload });
    const campaign = createResponse.json();

    const joinPayload = { userId: 'user-1' };
    const joinResponse = await app.inject({ method: 'POST', url: `/campaigns/${campaign.id}/join`, payload: joinPayload });
    expect(joinResponse.statusCode).toBe(200);

    const updatedCampaign = joinResponse.json();
    expect(updatedCampaign.actualParticipants).toBe(1);
  });

  it('supports paginated campaign listing', async () => {
    const bus = new InMemoryEventBus();
    const app = buildApp({ eventBus: bus });

    for (let index = 0; index < 3; index += 1) {
      await app.inject({
        method: 'POST',
        url: '/campaigns',
        payload: {
          productId: `product-${index}`,
          minParticipants: 2,
          maxParticipants: 10,
          price: 10,
          originalPrice: 20,
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      });
    }

    const response = await app.inject({
      method: 'GET',
      url: '/campaigns?limit=2&offset=1'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(2);
  });
});
