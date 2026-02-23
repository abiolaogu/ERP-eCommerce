import { CommerceModel, SalesChannel } from '@fusioncommerce/contracts';

export interface Product {
  id: string;
  tenantId: string;
  merchantId?: string;
  vendorId: string;
  commerceModel: CommerceModel;
  salesChannels: SalesChannel[];
  sku: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  inventory: number;
}

export interface CreateProductRequest {
  tenantId?: string;
  merchantId?: string;
  vendorId?: string;
  commerceModel?: CommerceModel;
  salesChannels?: SalesChannel[];
  sku: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  inventory: number;
}

export interface ListProductsQuery {
  limit?: number;
  offset?: number;
  tenantId?: string;
  vendorId?: string;
  commerceModel?: CommerceModel;
  salesChannel?: SalesChannel;
}
