import { CommerceModel, SalesChannel } from '@fusioncommerce/contracts';
import { Product } from './types.js';

export interface CatalogRepository {
  create(product: Product): Promise<Product>;
  all(options?: {
    limit: number;
    offset: number;
    tenantId?: string;
    vendorId?: string;
    commerceModel?: CommerceModel;
    salesChannel?: SalesChannel;
  }): Promise<Product[]>;
}

export class InMemoryCatalogRepository implements CatalogRepository {
  private readonly products = new Map<string, Product>();

  async create(product: Product): Promise<Product> {
    this.products.set(product.id, product);
    return product;
  }

  async all(options?: {
    limit: number;
    offset: number;
    tenantId?: string;
    vendorId?: string;
    commerceModel?: CommerceModel;
    salesChannel?: SalesChannel;
  }): Promise<Product[]> {
    const limit = options?.limit ?? this.products.size;
    const offset = options?.offset ?? 0;
    const filtered = Array.from(this.products.values()).filter((product) => {
      if (options?.tenantId && product.tenantId !== options.tenantId) {
        return false;
      }
      if (options?.vendorId && product.vendorId !== options.vendorId) {
        return false;
      }
      if (options?.commerceModel && product.commerceModel !== options.commerceModel) {
        return false;
      }
      if (options?.salesChannel && !product.salesChannels.includes(options.salesChannel)) {
        return false;
      }
      return true;
    });

    return filtered.slice(offset, offset + limit);
  }
}
