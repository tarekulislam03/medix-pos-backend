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
import Inventory from '../../src/models/productModel.js';
import Sales from '../../src/models/salesModel.js';
import Customer from '../../src/models/customerModel.js';
import Store from '../../src/models/storeModel.js';
import User from '../../src/models/userModel.js';

const models = { Store, User, Customer, Inventory };

describe('Billing Checkout API Integration', () => {
  let token;

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
  });

  it('should process a single item cash sale successfully', async () => {
    const payload = checkoutPayloads.singleItemCash;
    
    const res = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Billing successful');
    expect(res.body.invoice).toBeDefined();
    
    // Verify stock deduction
    const product = await Inventory.findById(IDS.product1);
    expect(product.quantity).toBe(100 - 2); // original 100 - sold 2

    // Verify sale record
    const sale = await Sales.findOne({ invoice_number: res.body.invoice.invoice_number });
    expect(sale).toBeDefined();
    expect(sale.grand_total).toBe(60); // 2 * 30 (mrp)
  });

  it('should process multiple items cash sale with discount successfully', async () => {
    const payload = checkoutPayloads.multiItemCash;

    const res = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.invoice.items).toHaveLength(2);

    // Verify stock deduction for both items
    const product1 = await Inventory.findById(IDS.product1);
    expect(product1.quantity).toBe(100 - 3);

    const product3 = await Inventory.findById(IDS.product3);
    expect(product3.quantity).toBe(30 - 1);
  });

  it('should process a credit sale and update customer balance', async () => {
    const payload = checkoutPayloads.creditSale; // product3 * 2 = 240, paid 100

    const res = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Billing successful. Due recorded.');
    expect(res.body.due_amount).toBe(140); // 240 - 100 paid

    // Verify customer credit balance
    const customer = await Customer.findById(IDS.customer1);
    // original credit balance was 500
    expect(customer.credit_balance).toBe(500 + 140);
  });

  it('should reject checkout when cart is empty', async () => {
    const payload = checkoutPayloads.emptyCart;

    const res = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Cart is empty');
  });

  it('should reject checkout on insufficient stock', async () => {
    const payload = checkoutPayloads.insufficientStock; // product5, qty 999

    const res = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Insufficient stock for/i);

    // Verify stock has not changed
    const product = await Inventory.findById(IDS.product5);
    expect(product.quantity).toBe(5); // original quantity
  });

  it('should correctly handle checkout with doctor fee and otc items', async () => {
    const payload = checkoutPayloads.withDoctorFeeAndOtc; // product4 * 5 = 125, doc 50, otc 20

    const res = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(200);
    
    const invoice = res.body.invoice;
    expect(invoice.doctor_fee).toBe(50);
    expect(invoice.otc_total).toBe(20);
    expect(invoice.grand_total).toBe(125 + 50 + 20); // 195
    // amount paid is 200, so due should be 0
    expect(res.body.due_amount).toBe(0);
  });
});
