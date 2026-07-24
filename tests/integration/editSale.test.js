import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import app from '../../src/app.js';
import {
  connectTestDB,
  disconnectTestDB,
  clearTestDB,
  generateTestToken,
  setTestEnv
} from '../setup/testHelpers.js';
import { IDS, seedDatabase, checkoutPayloads } from '../fixtures/seedData.js';
import Inventory from '../../src/features/product/models/productModel.js';
import Sales from '../../src/features/sales/models/salesModel.js';
import Customer from '../../src/features/customer/models/customerModel.js';
import Store from '../../src/features/store/models/storeModel.js';
import User from '../../src/features/user/models/userModel.js';

const models = { Store, User, Customer, Inventory };

describe('Edit Sale API Integration', () => {
  let token;
  let saleId;

  beforeAll(async () => {
    setTestEnv();
    await connectTestDB();
    token = generateTestToken(IDS.user, IDS.store);
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    await seedDatabase(models);

    // Create an initial sale to be edited
    const payload = {
      ...checkoutPayloads.singleItemCash,
      customer_id: IDS.customer1.toString(),
      amount_paid: 60,
    };
    
    const res = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    saleId = res.body.invoice._id;
  });

  it('should successfully edit a sale, revert old stock, and deduct new stock', async () => {
    // Initial stock: Product 1 has 100 original - 2 from checkout = 98.
    // Product 2 has 50 original.
    let p1 = await Inventory.findById(IDS.product1);
    expect(p1.quantity).toBe(98);

    // Payload for editing the sale:
    // Change quantity of product 1 to 1 (from 2)
    // Add product 2 with quantity 5
    const editPayload = {
      customer_id: IDS.customer1.toString(),
      items: [
        { product_id: IDS.product1.toString(), quantity: 1, discount_percent: 0 },
        { product_id: IDS.product2.toString(), quantity: 5, discount_percent: 0 }
      ],
      payment_method: 'cash',
      amount_paid: 180 // product 1 (1 * 30) + product 2 (5 * 30) = 180
    };

    const res = await request(app)
      .put(`/api/v1/sales/history/${saleId}`)
      .set('Authorization', `Bearer ${token}`)
      .send(editPayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Bill updated successfully');
    
    // Verify stock reversion and new deduction
    // Product 1: reverted +2 (100), deducted -1 -> 99
    p1 = await Inventory.findById(IDS.product1);
    expect(p1.quantity).toBe(99);

    // Product 2: original 50, deducted -5 -> 45
    const p2 = await Inventory.findById(IDS.product2);
    expect(p2.quantity).toBe(45);

    // Verify sale updated in database
    const updatedSale = await Sales.findById(saleId);
    expect(updatedSale.items).toHaveLength(2);
    expect(updatedSale.grand_total).toBe(180);
    expect(updatedSale.amount_paid).toBe(180);
    expect(updatedSale.due_amount).toBe(0);
  });

  it('should revert customer credit when editing a sale and update correctly', async () => {
    // Let's create a credit sale first
    const creditPayload = {
      items: [
        { product_id: IDS.product3.toString(), quantity: 2, discount_percent: 0 }
      ],
      payment_method: 'cash',
      amount_paid: 100, // Total is 240, so 140 is due
      customer_id: IDS.customer2.toString(), // Has 0 credit originally
    };

    const checkoutRes = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send(creditPayload);

    const creditSaleId = checkoutRes.body.invoice._id;
    
    let c2 = await Customer.findById(IDS.customer2);
    expect(c2.credit_balance).toBe(140);

    // Edit the credit sale: Change to 1 quantity (120 total), and amount paid 120 -> due 0
    const editCreditPayload = {
      customer_id: IDS.customer2.toString(),
      items: [
        { product_id: IDS.product3.toString(), quantity: 1, discount_percent: 0 }
      ],
      payment_method: 'cash',
      amount_paid: 120, // 0 due
    };

    const editRes = await request(app)
      .put(`/api/v1/sales/history/${creditSaleId}`)
      .set('Authorization', `Bearer ${token}`)
      .send(editCreditPayload);

    expect(editRes.status).toBe(200);
    
    // Customer credit balance should be reverted from 140, then add 0 due -> 0
    c2 = await Customer.findById(IDS.customer2);
    expect(c2.credit_balance).toBe(0);
  });
  
  it('should not allow editing sale with insufficient stock', async () => {
    const editPayload = {
      customer_id: IDS.customer1.toString(),
      items: [
        { product_id: IDS.product4.toString(), quantity: 9999, discount_percent: 0 } // Very high quantity
      ],
      payment_method: 'cash',
      amount_paid: 100
    };

    const res = await request(app)
      .put(`/api/v1/sales/history/${saleId}`)
      .set('Authorization', `Bearer ${token}`)
      .send(editPayload);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/Insufficient stock/i);

    // Original stock for product 4 should be unchanged
    const p4 = await Inventory.findById(IDS.product4);
    expect(p4.quantity).toBe(200);

    // The sale items should remain the same
    const unchangedSale = await Sales.findById(saleId);
    expect(unchangedSale.items[0].product_id.toString()).toBe(IDS.product1.toString());
  });
});
