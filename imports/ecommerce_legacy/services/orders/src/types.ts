import { CommerceModel, SalesChannel } from '@fusioncommerce/contracts';

export interface OrderItem {
  sku: string;
  category?: string;
  quantity: number;
  price: number;
  vendorId?: string;
}

export interface PolicyCheckSnapshot {
  compliant: boolean;
  coverageLane: string;
  expectedSlaHours: number;
  checks: Array<{
    category: string;
    quantity: number;
    requiredMOQ: number;
    compliant: boolean;
  }>;
  automationNotes: string[];
}

export interface Order {
  id: string;
  customerId: string;
  tenantId: string;
  merchantId?: string;
  storeId?: string;
  commerceModel: CommerceModel;
  salesChannel: SalesChannel;
  items: OrderItem[];
  total: number;
  currency: string;
  status: 'created' | 'confirmed' | 'failed';
  brandId?: string;
  destinationState?: string;
  fulfillmentGroups?: Array<{
    vendorId: string;
    itemCount: number;
    subtotal: number;
  }>;
  orchestration?: PolicyCheckSnapshot;
  createdAt: string;
}

export interface CreateOrderRequest {
  customerId: string;
  tenantId?: string;
  merchantId?: string;
  storeId?: string;
  commerceModel?: CommerceModel;
  salesChannel?: SalesChannel;
  items: Array<{
    sku: string;
    category?: string;
    quantity: number;
    price: number;
    vendorId?: string;
  }>;
  currency?: string;
  brandId?: string;
  destinationState?: string;
}

export interface PolicyPreviewRequest {
  tenantId?: string;
  brandId: string;
  destinationState: string;
  items: Array<{
    sku: string;
    category: string;
    quantity: number;
  }>;
}

export interface ListOrdersQuery {
  limit?: number;
  offset?: number;
  tenantId?: string;
  commerceModel?: CommerceModel;
  salesChannel?: SalesChannel;
  vendorId?: string;
}
