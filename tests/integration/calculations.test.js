import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { connectTestDB, disconnectTestDB, clearTestDB, generateTestToken, setTestEnv } from '../setup/testHelpers.js';
import { IDS, products, seedDatabase } from '../fixtures/seedData.js';
import Store from '../../src/features/store/models/storeModel.js';
import User from '../../src/features/user/models/userModel.js';
import Customer from '../../src/features/customer/models/customerModel.js';
import Inventory from '../../src/features/product/models/productModel.js';

describe('Calculations Integration - Billing Checkout', () => {
    let token;

    beforeAll(async () => {
        setTestEnv();
        await connectTestDB();
    });

    afterAll(async () => {
        await disconnectTestDB();
    });

    beforeEach(async () => {
        await clearTestDB();
        await seedDatabase({ Store, User, Customer, Inventory });
        token = generateTestToken(IDS.user, IDS.store);
    });

    it('should correctly calculate total, GST, discount, and profit for a simple cash sale', async () => {
        // Arrange
        // Using Product1: MRP 30, Cost 20, GST 12%
        // Buying 2 qty. No discount.
        const payload = {
            items: [
                { product_id: IDS.product1.toString(), quantity: 2, discount_percent: 0 }
            ],
            payment_method: 'cash',
            amount_paid: 60
        };

        // Act
        const res = await request(app)
            .post('/api/v1/billing/checkout')
            .set('Authorization', `Bearer ${token}`)
            .send(payload);

        // Assert
        expect(res.status).toBe(200);
        const { invoice } = res.body;
        
        // Math breakdown:
        // Subtotal = 30 * 2 = 60
        // Total Discount = 0
        // Total Item = 60
        // Total GST (12%) = (60 * 12) / 112 = 6.428... = 6.43
        // Taxable Amount = 60 - 6.43 = 53.57
        // CGST = 3.22 (totalGst/2 rounded)
        // SGST = 3.21 (totalGst - CGST)
        // Cost = 20 * 2 = 40
        // Profit = 60 - 40 = 20

        expect(invoice.subtotal).toBe(60);
        expect(invoice.total_discount).toBe(0);
        expect(invoice.total_taxable).toBe(53.57);
        expect(invoice.total_cgst).toBe(3.21);
        expect(invoice.total_sgst).toBe(3.22);
        expect(invoice.total_profit).toBe(20);
        expect(invoice.grand_total).toBe(60);
        expect(invoice.due_amount).toBe(0);
        
        // Ensure stock was deducted
        const product = await Inventory.findById(IDS.product1);
        expect(product.quantity).toBe(98); // Originally 100
    });

    it('should correctly calculate multi-item sale with discounts', async () => {
        // Arrange
        // Product 1: MRP 30, Cost 20, GST 12%, Qty 3, Discount 10%
        //   Subtotal: 90. Discount: 9. Total: 81.
        //   Cost: 60. Profit: 81 - 60 = 21.
        //   Total GST: (81 * 12)/112 = 8.68. Taxable: 81 - 8.68 = 72.32
        //   CGST: 4.34. SGST: 4.34.
        // Product 3: MRP 120, Cost 80, GST 12%, Qty 1, Discount 5%
        //   Subtotal: 120. Discount: 6. Total: 114.
        //   Cost: 80. Profit: 114 - 80 = 34.
        //   Total GST: (114 * 12)/112 = 12.21. Taxable: 114 - 12.21 = 101.79
        //   CGST: 6.11. SGST: 6.10.

        // Overall:
        // Subtotal = 90 + 120 = 210
        // Total Discount = 9 + 6 = 15
        // Total Item Amount = 81 + 114 = 195
        // Grand Total = 195
        // Profit = 21 + 34 = 55
        // Taxable = 72.32 + 101.79 = 174.11
        // CGST = 4.34 + 6.11 = 10.45
        // SGST = 4.34 + 6.10 = 10.44

        const payload = {
            items: [
                { product_id: IDS.product1.toString(), quantity: 3, discount_percent: 10 },
                { product_id: IDS.product3.toString(), quantity: 1, discount_percent: 5 },
            ],
            payment_method: 'upi',
            amount_paid: 195
        };

        // Act
        const res = await request(app)
            .post('/api/v1/billing/checkout')
            .set('Authorization', `Bearer ${token}`)
            .send(payload);

        // Assert
        expect(res.status).toBe(200);
        const { invoice } = res.body;

        expect(invoice.subtotal).toBe(210);
        expect(invoice.total_discount).toBe(15);
        expect(invoice.total_profit).toBe(55);
        expect(invoice.total_taxable).toBe(174.11);
        expect(invoice.total_cgst).toBe(10.45);
        expect(invoice.total_sgst).toBe(10.44);
        expect(invoice.grand_total).toBe(195);
        expect(invoice.due_amount).toBe(0);
    });

    it('should calculate Doctor Fee and OTC items without discount', async () => {
        // Arrange
        // Product 4: MRP 25, Cost 15, GST 5%, Qty 5, Discount 0%
        //   Subtotal = 125, Cost = 75, Profit = 50.
        //   Total GST = (125 * 5)/105 = 5.95
        //   Taxable = 125 - 5.95 = 119.05
        //   CGST = 2.98, SGST = 2.97.
        // OTC: Bandage 20. Doctor Fee: 50.
        // Grand total = 125 + 50 + 20 = 195
        
        const payload = {
            items: [
                { product_id: IDS.product4.toString(), quantity: 5, discount_percent: 0 },
            ],
            payment_method: 'upi',
            amount_paid: 195,
            doctor_fee: 50,
            otc_items: [{ name: 'Bandage', price: 20 }]
        };

        // Act
        const res = await request(app)
            .post('/api/v1/billing/checkout')
            .set('Authorization', `Bearer ${token}`)
            .send(payload);

        // Assert
        expect(res.status).toBe(200);
        const { invoice } = res.body;

        expect(invoice.subtotal).toBe(125);
        expect(invoice.total_discount).toBe(0);
        expect(invoice.total_profit).toBe(50);
        expect(invoice.doctor_fee).toBe(50);
        expect(invoice.otc_total).toBe(20);
        expect(invoice.grand_total).toBe(195);
    });

    it('should correctly calculate credit sales and update customer balance', async () => {
        // Arrange
        // Product 3: MRP 120, Qty 2 -> Subtotal = 240
        // Customer 1 initially has 500 credit balance.
        // Paid: 100. Due = 240 - 100 = 140.
        // New Customer Balance = 500 + 140 = 640.

        const payload = {
            items: [
                { product_id: IDS.product3.toString(), quantity: 2, discount_percent: 0 }
            ],
            payment_method: 'cash',
            amount_paid: 100,
            customer_id: IDS.customer1.toString(),
            customer_name_fallback: 'Rahul Sharma'
        };

        // Act
        const res = await request(app)
            .post('/api/v1/billing/checkout')
            .set('Authorization', `Bearer ${token}`)
            .send(payload);

        // Assert
        expect(res.status).toBe(200);
        const { invoice, due_amount, customer_credit_balance } = res.body;

        expect(invoice.grand_total).toBe(240);
        expect(invoice.amount_paid).toBe(100);
        expect(invoice.due_amount).toBe(140);
        expect(due_amount).toBe(140);
        expect(customer_credit_balance).toBe(640);

        // Verify DB state for customer
        const customer = await Customer.findById(IDS.customer1);
        expect(customer.credit_balance).toBe(640);
    });
});
