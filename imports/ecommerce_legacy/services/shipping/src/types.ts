import { CommerceModel } from '@fusioncommerce/contracts';

export interface ShippingLabel {
    id: string;
    orderId: string;
    tenantId: string;
    vendorId?: string;
    commerceModel: CommerceModel;
    trackingNumber: string;
    carrier: string;
    labelUrl: string;
    orchestration?: {
        coverageLane: string;
        ownerType: string;
        expectedSlaHours: number;
        policyCompliant?: boolean;
    };
    createdAt: string;
}

export interface CreateShippingLabelRequest {
    orderId: string;
    tenantId?: string;
    vendorId?: string;
    commerceModel?: CommerceModel;
    brandId?: string;
    destinationState?: string;
    items?: Array<{
        sku: string;
        category: string;
        quantity: number;
    }>;
    address: {
        street: string;
        city: string;
        country: string;
        zip: string;
    };
}

export interface LanePreviewRequest {
    destinationState: string;
}
