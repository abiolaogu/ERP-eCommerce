import { EventBus } from '@fusioncommerce/event-bus';
import { CommerceModel, SHIPPING_LABEL_CREATED_TOPIC, ShippingLabelCreatedEvent } from '@fusioncommerce/contracts';
import {
    CoverageLaneResponse,
    mapFusionOrderToPolicyRequest,
    normalizeFusionPolicyLines,
    OmniRouteClient
} from '@fusioncommerce/omniroute-sdk';
import { randomUUID } from 'crypto';
import { ShippingRepository } from './shipping-repository.js';
import { CreateShippingLabelRequest, ShippingLabel } from './types.js';

export class ShippingService {
    constructor(
        private readonly repository: ShippingRepository,
        private readonly eventBus: EventBus,
        private readonly omnirouteClient?: OmniRouteClient
    ) { }

    async previewLanes(destinationState: string): Promise<CoverageLaneResponse[]> {
        if (!this.omnirouteClient) {
            throw new Error('OmniRoute client not configured');
        }

        return this.omnirouteClient.listCoverageLanes(destinationState);
    }

    async createLabel(request: CreateShippingLabelRequest): Promise<ShippingLabel> {
        // Real integration with a shipping provider (e.g. Shippo/EasyPost)
        const commerceModel = this.resolveCommerceModel(request);
        if (commerceModel === 'marketplace' && !request.vendorId) {
            throw new Error('Marketplace shipping labels require vendorId');
        }

        const tenantId = request.tenantId ?? 'default';

        let selectedLane: CoverageLaneResponse | undefined;
        let policyCompliant: boolean | undefined;
        const canPreviewLanes = Boolean(this.omnirouteClient && request.destinationState);
        const canEvaluatePolicy = Boolean(
            this.omnirouteClient &&
            request.brandId &&
            request.destinationState &&
            request.items?.length
        );

        const [lanes, policy] = await Promise.all([
            canPreviewLanes
                ? this.omnirouteClient!.listCoverageLanes(request.destinationState!)
                : Promise.resolve(undefined),
            canEvaluatePolicy
                ? this.omnirouteClient!.evaluateCheckoutPolicy(
                    mapFusionOrderToPolicyRequest({
                        brandId: request.brandId!,
                        destinationState: request.destinationState!,
                        items: normalizeFusionPolicyLines(request.items!)
                    })
                )
                : Promise.resolve(undefined)
        ]);

        selectedLane = lanes?.[0];

        if (policy) {
            policyCompliant = policy.compliant;
            if (!selectedLane && policy.coverageLane) {
                selectedLane = {
                    laneId: `policy-${request.orderId}`,
                    owner: policy.coverageLane,
                    ownerType: 'policy_lane',
                    slaHours: policy.expectedSlaHours
                };
            }
        }

        const carrier = selectedLane?.ownerType === 'logistics_aggregator'
            ? 'Aggregator Network'
            : 'FedEx';

        // Simulate API response
        const trackingNumber = `TRK-${randomUUID().substring(0, 8).toUpperCase()}`;
        const labelUrl = `https://api.carrier.com/labels/${trackingNumber}.pdf`;

        const label: ShippingLabel = {
            id: randomUUID(),
            orderId: request.orderId,
            tenantId,
            vendorId: request.vendorId,
            commerceModel,
            trackingNumber,
            carrier,
            labelUrl,
            orchestration: selectedLane
                ? {
                    coverageLane: selectedLane.owner,
                    ownerType: selectedLane.ownerType,
                    expectedSlaHours: selectedLane.slaHours,
                    policyCompliant
                }
                : undefined,
            createdAt: new Date().toISOString()
        };

        await this.repository.save(label);

        await this.eventBus.publish<ShippingLabelCreatedEvent>(SHIPPING_LABEL_CREATED_TOPIC, {
            orderId: label.orderId,
            tenantId: label.tenantId,
            commerceModel: label.commerceModel,
            vendorId: label.vendorId,
            trackingNumber: label.trackingNumber,
            carrier: label.carrier,
            labelUrl: label.labelUrl
        });

        return label;
    }

    async getLabel(id: string): Promise<ShippingLabel | null> {
        return this.repository.findById(id);
    }

    private resolveCommerceModel(request: CreateShippingLabelRequest): CommerceModel {
        if (request.commerceModel) {
            return request.commerceModel;
        }

        return request.vendorId ? 'marketplace' : 'single_merchant';
    }
}
