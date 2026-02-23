import { EventBus } from '@fusioncommerce/event-bus';
import Stripe from 'stripe';
import {
    CommerceModel,
    PAYMENT_CREATED_TOPIC,
    PAYMENT_SUCCEEDED_TOPIC,
    PAYMENT_FAILED_TOPIC,
    PaymentCreatedEvent,
    PaymentSucceededEvent,
    PaymentFailedEvent
} from '@fusioncommerce/contracts';
import { randomUUID } from 'crypto';
import { PaymentRepository } from './payment-repository.js';
import { CreatePaymentRequest, Payment } from './types.js';

export class PaymentService {
    private stripe: Stripe;

    constructor(private readonly repository: PaymentRepository, private readonly eventBus: EventBus) {
        this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
            apiVersion: '2025-11-17.clover',
        });
    }

    async processPayment(request: CreatePaymentRequest): Promise<Payment> {
        const commerceModel = request.commerceModel ?? 'single_merchant';
        const settlementMode = request.settlementMode ?? (commerceModel === 'marketplace' ? 'split' : 'single');
        const tenantId = request.tenantId ?? 'default';
        const merchantId = request.merchantId ?? tenantId;
        const allocations = this.resolveAllocations(request, commerceModel, settlementMode, merchantId);

        const payment: Payment = {
            id: randomUUID(),
            orderId: request.orderId,
            tenantId,
            merchantId,
            commerceModel,
            settlementMode,
            allocations,
            amount: request.amount,
            currency: request.currency,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        await this.repository.save(payment);

        await this.eventBus.publish<PaymentCreatedEvent>(PAYMENT_CREATED_TOPIC, {
            paymentId: payment.id,
            orderId: payment.orderId,
            amount: payment.amount,
            currency: payment.currency as any, // Cast to Currency type
            tenantId: payment.tenantId,
            merchantId: payment.merchantId,
            commerceModel: payment.commerceModel,
            status: 'pending'
        });

        // Real Stripe integration
        try {
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: Math.round(request.amount * 100), // Stripe uses cents
                currency: request.currency.toLowerCase(),
                payment_method: request.paymentMethodId,
                confirm: true,
                return_url: 'http://localhost:3000/return', // Placeholder
                automatic_payment_methods: {
                    enabled: true,
                    allow_redirects: 'never' // For simplicity in this backend-only flow
                }
            });

            if (paymentIntent.status === 'succeeded') {
                payment.status = 'succeeded';
                await this.repository.save(payment);
                await this.eventBus.publish<PaymentSucceededEvent>(PAYMENT_SUCCEEDED_TOPIC, {
                    paymentId: payment.id,
                    orderId: payment.orderId,
                    tenantId: payment.tenantId,
                    commerceModel: payment.commerceModel
                });
            } else {
                // Handle other statuses (requires_action, etc.) as failed for now
                payment.status = 'failed';
                await this.repository.save(payment);
                await this.eventBus.publish<PaymentFailedEvent>(PAYMENT_FAILED_TOPIC, {
                    paymentId: payment.id,
                    orderId: payment.orderId,
                    tenantId: payment.tenantId,
                    commerceModel: payment.commerceModel,
                    reason: `Stripe status: ${paymentIntent.status}`
                });
            }
        } catch (error) {
            payment.status = 'failed';
            await this.repository.save(payment);
            await this.eventBus.publish<PaymentFailedEvent>(PAYMENT_FAILED_TOPIC, {
                paymentId: payment.id,
                orderId: payment.orderId,
                tenantId: payment.tenantId,
                commerceModel: payment.commerceModel,
                reason: (error as Error).message
            });
        }

        return payment;
    }

    async getPayment(id: string): Promise<Payment | null> {
        return this.repository.findById(id);
    }

    private resolveAllocations(
        request: CreatePaymentRequest,
        commerceModel: CommerceModel,
        settlementMode: 'single' | 'split',
        merchantId: string
    ): Payment['allocations'] {
        if (settlementMode === 'single') {
            return [{ vendorId: merchantId, amount: request.amount }];
        }

        if (!request.allocations || request.allocations.length === 0) {
            throw new Error('Split settlement requires allocations');
        }

        const duplicateVendor = new Set<string>();
        for (const allocation of request.allocations) {
            if (duplicateVendor.has(allocation.vendorId)) {
                throw new Error('Split settlement cannot contain duplicate vendor allocations');
            }
            duplicateVendor.add(allocation.vendorId);
        }

        const totalAllocated = request.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
        const delta = Math.abs(totalAllocated - request.amount);
        if (delta > 0.01) {
            throw new Error('Split allocations must equal total payment amount');
        }

        if (commerceModel === 'single_merchant' && request.allocations.length > 1) {
            throw new Error('Single-merchant payments cannot split across multiple vendors');
        }

        return request.allocations;
    }
}
