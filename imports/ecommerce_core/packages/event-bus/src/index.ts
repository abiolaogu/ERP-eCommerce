import { Kafka, logLevel, Message, Producer, Consumer } from 'kafkajs';

export interface EventBus {
  publish<T>(topic: string, payload: T): Promise<void>;
  subscribe<T>(topic: string, handler: EventHandler<T>): Promise<void>;
  disconnect(): Promise<void>;
}

export type EventHandler<T> = (event: EventEnvelope<T>) => Promise<void> | void;

export interface EventEnvelope<T> {
  topic: string;
  payload: T;
  timestamp: number;
}

export interface KafkaEventBusOptions {
  clientId?: string;
  brokers: string[];
  ssl?: boolean;
  sasl?: any;
  logLevel?: logLevel;
}

export class KafkaEventBus implements EventBus {
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private readonly consumers: Map<string, Consumer> = new Map();
  private producerConnectPromise?: Promise<void>;
  private producerConnected = false;

  constructor(private readonly options: KafkaEventBusOptions) {
    this.kafka = new Kafka({
      clientId: options.clientId ?? 'fusioncommerce-service',
      brokers: options.brokers,
      ssl: options.ssl,
      sasl: options.sasl,
      logLevel: options.logLevel ?? logLevel.ERROR
    });
    this.producer = this.kafka.producer();
  }

  async publish<T>(topic: string, payload: T): Promise<void> {
    await this.ensureProducerConnected();
    const message: Message = {
      value: JSON.stringify(payload),
      timestamp: Date.now().toString()
    };
    await this.producer.send({ topic, messages: [message] });
  }

  async subscribe<T>(topic: string, handler: EventHandler<T>): Promise<void> {
    if (this.consumers.has(topic)) {
      return;
    }
    const consumer = this.kafka.consumer({ groupId: `${topic}-consumer` });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });
    await consumer.run({
      eachMessage: async ({ message, topic: receivedTopic }) => {
        if (!message.value) return;
        const payload = JSON.parse(message.value.toString()) as T;
        await handler({ topic: receivedTopic, payload, timestamp: Date.now() });
      }
    });
    this.consumers.set(topic, consumer);
  }

  async disconnect(): Promise<void> {
    await Promise.all(
      Array.from(this.consumers.values()).map(async (consumer) => {
        await consumer.disconnect();
      })
    );
    this.consumers.clear();

    if (this.producerConnected || this.producerConnectPromise) {
      await this.producer.disconnect();
    }

    this.producerConnected = false;
    this.producerConnectPromise = undefined;
  }

  private async ensureProducerConnected(): Promise<void> {
    if (this.producerConnected) {
      return;
    }

    if (!this.producerConnectPromise) {
      this.producerConnectPromise = this.producer.connect()
        .then(() => {
          this.producerConnected = true;
        })
        .catch((error) => {
          this.producerConnectPromise = undefined;
          throw error;
        });
    }

    await this.producerConnectPromise;
  }
}

export class InMemoryEventBus implements EventBus {
  private handlers = new Map<string, Set<EventHandler<unknown>>>();

  async publish<T>(topic: string, payload: T): Promise<void> {
    const handlers = this.handlers.get(topic);
    if (!handlers) return;
    const envelope: EventEnvelope<T> = { topic, payload, timestamp: Date.now() };
    await Promise.all(Array.from(handlers).map((handler) => handler(envelope)));
  }

  async subscribe<T>(topic: string, handler: EventHandler<T>): Promise<void> {
    const handlers = this.handlers.get(topic) ?? new Set();
    handlers.add(handler as EventHandler<unknown>);
    this.handlers.set(topic, handlers);
  }

  async disconnect(): Promise<void> {
    this.handlers.clear();
  }
}

export interface EnvironmentConfig {
  kafkaBrokers?: string;
  useInMemoryBus?: string;
}

export function createEventBusFromEnv(env: EnvironmentConfig): EventBus {
  if (env.useInMemoryBus === 'true' || !env.kafkaBrokers) {
    return new InMemoryEventBus();
  }
  const brokers = env.kafkaBrokers.split(',').map((value) => value.trim()).filter(Boolean);
  if (brokers.length === 0) {
    return new InMemoryEventBus();
  }
  return new KafkaEventBus({ brokers });
}
