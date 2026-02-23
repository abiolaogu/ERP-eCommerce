import { EventBus, EventEnvelope } from '@fusioncommerce/event-bus';
import {
  CommerceModel,
  INVENTORY_FAILED_TOPIC,
  INVENTORY_RESERVED_TOPIC,
  InventoryStatusEvent,
  OrderCreatedEvent
} from '@fusioncommerce/contracts';
import { InventoryRepository } from './inventory-repository.js';
import { ConfigureStockRequest, InventoryReservation, StockLevel } from './types.js';

export class InventoryService {
  constructor(private readonly repository: InventoryRepository, private readonly eventBus: EventBus) {}

  async configureStock(level: ConfigureStockRequest): Promise<void> {
    await this.repository.setStock({
      sku: level.sku,
      quantity: level.quantity,
      tenantId: level.tenantId || 'default',
      vendorId: level.vendorId || 'default',
    });
  }

  async listStock(filters?: { tenantId?: string; vendorId?: string }): Promise<StockLevel[]> {
    return this.repository.all(filters);
  }

  async handleOrderCreated(event: EventEnvelope<OrderCreatedEvent>): Promise<void> {
    const commerceModel: CommerceModel = event.payload.commerceModel ?? 'single_merchant';
    const tenantId = event.payload.tenantId ?? 'default';

    const quantitiesByScope = event.payload.items.reduce((accumulator, item) => {
      const vendorId = item.vendorId ?? event.payload.merchantId ?? tenantId;
      const key = `${tenantId}::${vendorId}::${item.sku}`;
      const current = accumulator.get(key) ?? {
        tenantId,
        vendorId,
        sku: item.sku,
        quantity: 0,
      };
      current.quantity += item.quantity;
      accumulator.set(key, current);
      return accumulator;
    }, new Map<string, { tenantId: string; vendorId: string; sku: string; quantity: number }>());

    const results: InventoryReservation[] = await Promise.all(
      Array.from(quantitiesByScope.values()).map((scope) =>
        this.repository.reserve(event.payload.orderId, scope.sku, scope.quantity, {
          tenantId: scope.tenantId,
          vendorId: scope.vendorId,
        })
      )
    );

    const failed = results.find((result) => result.status === 'insufficient');
    if (failed) {
      const failureEvent: InventoryStatusEvent = {
        orderId: failed.orderId,
        status: 'insufficient',
        tenantId: failed.tenantId,
        vendorId: failed.vendorId,
        commerceModel,
        sku: failed.sku,
        quantity: failed.quantity
      };
      await this.eventBus.publish(INVENTORY_FAILED_TOPIC, failureEvent);
    } else {
      const successEvent: InventoryStatusEvent = {
        orderId: event.payload.orderId,
        status: 'reserved',
        tenantId,
        commerceModel
      };
      await this.eventBus.publish(INVENTORY_RESERVED_TOPIC, successEvent);
    }
  }
}
