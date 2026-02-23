import { CommerceModel } from '@fusioncommerce/contracts';

export interface StockLevel {
  tenantId: string;
  vendorId: string;
  sku: string;
  quantity: number;
}

export interface InventoryReservation {
  orderId: string;
  tenantId: string;
  vendorId: string;
  sku: string;
  quantity: number;
  status: 'reserved' | 'insufficient';
}

export interface ConfigureStockRequest {
  tenantId?: string;
  vendorId?: string;
  commerceModel?: CommerceModel;
  sku: string;
  quantity: number;
}
