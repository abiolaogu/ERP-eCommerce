/// <reference types="jest" />
import { createEventBusFromEnv, InMemoryEventBus } from './index.js';

describe('createEventBusFromEnv', () => {
  it('returns in--memory bus when brokers not provided', async () => {
    const bus = createEventBusFromEnv({});
    expect(bus).toBeInstanceOf(InMemoryEventBus);
  });

  it('delivers events in-memory', async () => {
    const bus = new InMemoryEventBus();
    const received: string[] = [];
    await bus.subscribe('topic', async (event) => {
      received.push(event.payload as string);
    });
    await bus.publish('topic', 'payload');
    expect(received).toEqual(['payload']);
  });
});
