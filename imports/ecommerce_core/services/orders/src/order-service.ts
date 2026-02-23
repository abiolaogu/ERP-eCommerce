import { EventBus } from '@fusioncommerce/event-bus';
import {
  CommerceModel,
  ORDER_CREATED_TOPIC,
  OrderCreatedEvent,
  SalesChannel
} from '@fusioncommerce/contracts';
import {
  mapFusionOrderToPolicyRequest,
  normalizeFusionPolicyLines,
  OmniRouteClient,
  PolicyCheckResponse,
} from '@fusioncommerce/omniroute-sdk';
import { randomUUID } from 'crypto';
import { OrderRepository } from './order-repository.js';
import { CreateOrderRequest, ListOrdersQuery, Order, PolicyPreviewRequest } from './types.js';

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

export class OrderService {
  constructor(
    private readonly repository: OrderRepository,
    private readonly eventBus: EventBus,
    private readonly omnirouteClient?: OmniRouteClient
  ) { }

  async previewPolicy(request: PolicyPreviewRequest): Promise<PolicyCheckResponse> {
    if (!this.omnirouteClient) {
      throw new Error('OmniRoute client not configured');
    }

    return this.omnirouteClient.evaluateCheckoutPolicy(
      mapFusionOrderToPolicyRequest({
        brandId: request.brandId,
        destinationState: request.destinationState,
        items: normalizeFusionPolicyLines(request.items),
      })
    );
  }

  async create(request: CreateOrderRequest): Promise<Order> {
    if (!request.customerId || request.items.length === 0) {
      throw new Error('Invalid order request');
    }

    const commerceModel = this.resolveCommerceModel(request);
    const salesChannel = this.resolveSalesChannel(request.salesChannel, commerceModel);
    this.assertModelChannelCompatibility(commerceModel, salesChannel);
    const tenantId = request.tenantId ?? 'default';
    const merchantId = request.merchantId ?? request.brandId ?? tenantId;

    const normalizedItems = this.normalizeItemsForModel(request, commerceModel, merchantId);

    let orchestration: PolicyCheckResponse | undefined;
    if (this.omnirouteClient && request.brandId && request.destinationState) {
      orchestration = await this.omnirouteClient.evaluateCheckoutPolicy(
        mapFusionOrderToPolicyRequest({
          brandId: request.brandId,
          destinationState: request.destinationState,
          items: normalizeFusionPolicyLines(normalizedItems),
        })
      );
    }

    const total = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const order: Order = {
      id: randomUUID(),
      customerId: request.customerId,
      tenantId,
      merchantId,
      storeId: request.storeId,
      commerceModel,
      salesChannel,
      items: normalizedItems,
      total,
      currency: request.currency || 'USD',
      status: 'created',
      brandId: request.brandId,
      destinationState: request.destinationState,
      fulfillmentGroups: this.buildFulfillmentGroups(normalizedItems),
      orchestration: orchestration
        ? {
          compliant: orchestration.compliant,
          coverageLane: orchestration.coverageLane,
          expectedSlaHours: orchestration.expectedSlaHours,
          checks: orchestration.checks,
          automationNotes: orchestration.automationNotes,
        }
        : undefined,
      createdAt: new Date().toISOString()
    };
    await this.repository.save(order);
    const event: OrderCreatedEvent = {
      orderId: order.id,
      customerId: order.customerId,
      tenantId: order.tenantId,
      merchantId: order.merchantId,
      storeId: order.storeId,
      commerceModel: order.commerceModel,
      salesChannel: order.salesChannel,
      total: order.total,
      items: order.items
    };
    await this.eventBus.publish(ORDER_CREATED_TOPIC, event);
    return order;
  }

  async list(query: ListOrdersQuery = {}): Promise<Order[]> {
    const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, Math.floor(query.limit ?? DEFAULT_LIST_LIMIT)));
    const offset = Math.max(0, Math.floor(query.offset ?? 0));

    return this.repository.all({
      limit,
      offset,
      tenantId: query.tenantId,
      commerceModel: query.commerceModel,
      salesChannel: query.salesChannel,
      vendorId: query.vendorId,
    });
  }

  private resolveCommerceModel(request: CreateOrderRequest): CommerceModel {
    if (request.commerceModel) {
      return request.commerceModel;
    }

    return request.salesChannel === 'marketplace' ? 'marketplace' : 'single_merchant';
  }

  private resolveSalesChannel(
    salesChannel: SalesChannel | undefined,
    commerceModel: CommerceModel
  ): SalesChannel {
    if (salesChannel) {
      return salesChannel;
    }

    return commerceModel === 'marketplace' ? 'marketplace' : 'storefront';
  }

  private assertModelChannelCompatibility(commerceModel: CommerceModel, salesChannel: SalesChannel): void {
    if (commerceModel === 'marketplace' && salesChannel !== 'marketplace') {
      throw new Error('Marketplace orders must use marketplace salesChannel');
    }

    if (commerceModel === 'single_merchant' && salesChannel === 'marketplace') {
      throw new Error('Single-merchant orders cannot use marketplace salesChannel');
    }
  }

  private normalizeItemsForModel(
    request: CreateOrderRequest,
    commerceModel: CommerceModel,
    merchantId: string
  ): Order['items'] {
    if (commerceModel === 'marketplace') {
      const hasMissingVendor = request.items.some((item) => !item.vendorId);
      if (hasMissingVendor) {
        throw new Error('Marketplace orders require vendorId on each item');
      }

      return request.items.map((item) => ({
        ...item,
        vendorId: item.vendorId!,
      }));
    }

    const vendorCandidates = new Set(
      request.items
        .map((item) => item.vendorId)
        .filter((value): value is string => Boolean(value))
    );

    if (vendorCandidates.size > 1) {
      throw new Error('Single-merchant orders cannot include items from multiple vendors');
    }

    const singleVendorId = vendorCandidates.values().next().value ?? merchantId;
    return request.items.map((item) => ({
      ...item,
      vendorId: item.vendorId ?? singleVendorId
    }));
  }

  private buildFulfillmentGroups(items: Order['items']): NonNullable<Order['fulfillmentGroups']> {
    const grouped = new Map<string, { vendorId: string; itemCount: number; subtotal: number }>();
    for (const item of items) {
      const vendorId = item.vendorId ?? 'unknown';
      const current = grouped.get(vendorId) ?? { vendorId, itemCount: 0, subtotal: 0 };
      current.itemCount += item.quantity;
      current.subtotal += item.quantity * item.price;
      grouped.set(vendorId, current);
    }

    return Array.from(grouped.values()).sort((a, b) => b.subtotal - a.subtotal);
  }
}
