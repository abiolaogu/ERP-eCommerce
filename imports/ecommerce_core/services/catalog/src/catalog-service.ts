import { CommerceModel, SalesChannel } from '@fusioncommerce/contracts';
import { EventBus } from '@fusioncommerce/event-bus';
import { randomUUID } from 'crypto';
import { CatalogRepository } from './catalog-repository.js';
import { CreateProductRequest, ListProductsQuery, Product } from './types.js';

export const PRODUCT_CREATED_TOPIC = 'product.created';
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

export class CatalogService {
  constructor(private readonly repository: CatalogRepository, private readonly eventBus: EventBus) {}

  async create(request: CreateProductRequest): Promise<Product> {
    const commerceModel = this.resolveCommerceModel(request.commerceModel);
    const tenantId = request.tenantId ?? 'default';
    const merchantId = request.merchantId ?? tenantId;
    const vendorId = this.resolveVendorId(request.vendorId, commerceModel, merchantId);
    const salesChannels = this.resolveSalesChannels(request.salesChannels, commerceModel);

    const product: Product = {
      id: randomUUID(),
      tenantId,
      merchantId,
      vendorId,
      commerceModel,
      salesChannels,
      sku: request.sku,
      name: request.name,
      description: request.description,
      price: request.price,
      currency: request.currency,
      inventory: request.inventory
    };
    await this.repository.create(product);
    await this.eventBus.publish(PRODUCT_CREATED_TOPIC, product);
    return product;
  }

  async list(query: ListProductsQuery = {}): Promise<Product[]> {
    const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, Math.floor(query.limit ?? DEFAULT_LIST_LIMIT)));
    const offset = Math.max(0, Math.floor(query.offset ?? 0));
    return this.repository.all({
      limit,
      offset,
      tenantId: query.tenantId,
      vendorId: query.vendorId,
      commerceModel: query.commerceModel,
      salesChannel: query.salesChannel
    });
  }

  private resolveCommerceModel(model: CommerceModel | undefined): CommerceModel {
    return model ?? 'single_merchant';
  }

  private resolveVendorId(
    vendorId: string | undefined,
    commerceModel: CommerceModel,
    merchantId: string
  ): string {
    if (commerceModel === 'marketplace') {
      if (!vendorId) {
        throw new Error('Marketplace products require vendorId');
      }
      return vendorId;
    }

    return vendorId ?? merchantId;
  }

  private resolveSalesChannels(
    requestedChannels: SalesChannel[] | undefined,
    commerceModel: CommerceModel
  ): SalesChannel[] {
    if (!requestedChannels || requestedChannels.length === 0) {
      return [commerceModel === 'marketplace' ? 'marketplace' : 'storefront'];
    }

    const uniqueChannels = Array.from(new Set(requestedChannels));
    if (commerceModel === 'single_merchant' && uniqueChannels.includes('marketplace')) {
      throw new Error('Single-merchant products cannot be published to marketplace channel');
    }

    return uniqueChannels;
  }
}
