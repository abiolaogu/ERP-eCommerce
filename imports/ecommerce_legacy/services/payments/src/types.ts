import { CommerceModel } from '@fusioncommerce/contracts';

export interface PaymentAllocation {
    vendorId: string;
    amount: number;
}

export interface Payment {
    id: string;
    orderId: string;
    tenantId: string;
    merchantId?: string;
    commerceModel: CommerceModel;
    settlementMode: 'single' | 'split';
    allocations?: PaymentAllocation[];
    amount: number;
    currency: string;
    status: 'pending' | 'succeeded' | 'failed';
    createdAt: string;
}

export interface CreatePaymentRequest {
    orderId: string;
    tenantId?: string;
    merchantId?: string;
    commerceModel?: CommerceModel;
    settlementMode?: 'single' | 'split';
    allocations?: PaymentAllocation[];
    amount: number;
    currency: string;
    paymentMethodId: string;
}
