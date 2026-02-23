import axios from 'axios';

const SERVICES = {
    CATALOG: 'http://localhost:3000',
    ORDERS: 'http://localhost:3001',
    INVENTORY: 'http://localhost:3002',
    PAYMENTS: 'http://localhost:3004',
    SHIPPING: 'http://localhost:3005'
};

describe('E2E Flow', () => {
    let productId: string;
    let orderId: string;

    it('1. Create Product', async () => {
        try {
            const res = await axios.post(`${SERVICES.CATALOG}/products`, {
                name: 'E2E Test Product',
                price: 100,
                tenantId: 'tenant-1',
                vendorId: 'vendor-1'
            });
            expect(res.status).toBe(201);
            productId = res.data.id;
        } catch (e) {
            console.error('Catalog Error:', e.response?.data || e.message);
            throw e;
        }
    });

    it('2. Add Inventory', async () => {
        try {
            const res = await axios.put(`${SERVICES.INVENTORY}/inventory`, {
                productId,
                quantity: 100,
                tenantId: 'tenant-1'
            });
            expect(res.status).toBe(204);
        } catch (e) {
            console.error('Inventory Error:', e.response?.data || e.message);
            throw e;
        }
    });

    it('3. Create Order', async () => {
        try {
            const res = await axios.post(`${SERVICES.ORDERS}/orders`, {
                userId: 'user-1',
                items: [{ productId, quantity: 1 }],
                tenantId: 'tenant-1'
            });
            expect(res.status).toBe(201);
            orderId = res.data.id;
        } catch (e) {
            console.error('Order Error:', e.response?.data || e.message);
            throw e;
        }
    });

    it('4. Process Payment', async () => {
        try {
            const res = await axios.post(`${SERVICES.PAYMENTS}/payments`, {
                orderId,
                amount: 100,
                currency: 'USD',
                paymentMethodId: 'pm_card_visa',
                tenantId: 'tenant-1'
            });
            expect(res.status).toBe(201);
            expect(res.data.status).toBe('succeeded');
        } catch (e) {
            console.error('Payment Error:', e.response?.data || e.message);
            throw e;
        }
    });

    it('5. Create Shipping Label', async () => {
        try {
            const res = await axios.post(`${SERVICES.SHIPPING}/shipping/labels`, {
                orderId,
                address: {
                    street: '123 Test St',
                    city: 'Test City',
                    country: 'US',
                    zip: '12345'
                },
                tenantId: 'tenant-1'
            });
            expect(res.status).toBe(201);
            expect(res.data.trackingNumber).toBeDefined();
        } catch (e) {
            console.error('Shipping Error:', e.response?.data || e.message);
            throw e;
        }
    });
});
