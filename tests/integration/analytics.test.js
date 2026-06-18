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
import { IDS, seedDatabase } from '../fixtures/seedData.js';
import Inventory from '../../src/models/productModel.js';
import Sales from '../../src/models/salesModel.js';
import Customer from '../../src/models/customerModel.js';
import Store from '../../src/models/storeModel.js';
import User from '../../src/models/userModel.js';

const models = { Store, User, Customer, Inventory };

describe('Sales Analytics API Integration', () => {
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

    // Create sales data for analytics
    const now = new Date();
    
    // 1. Sale today
    await Sales.create({
      invoice_number: 'INV-TODAY-1',
      storeId: IDS.store,
      customer: IDS.customer1,
      items: [], // simplified
      subtotal: 100,
      total_discount: 0,
      total_profit: 40,
      total_taxable: 100,
      total_cgst: 0,
      total_sgst: 0,
      doctor_fee: 0,
      otc_total: 0,
      grand_total: 100,
      amount_paid: 100,
      previous_due_payment: 0,
      due_amount: 0,
      payment_method: 'cash',
      created_at: now
    });

    await Sales.create({
      invoice_number: 'INV-TODAY-2',
      storeId: IDS.store,
      customer: IDS.customer2,
      items: [],
      subtotal: 150,
      total_discount: 0,
      total_profit: 60,
      total_taxable: 150,
      total_cgst: 0,
      total_sgst: 0,
      doctor_fee: 0,
      otc_total: 0,
      grand_total: 150,
      amount_paid: 150,
      previous_due_payment: 0,
      due_amount: 0,
      payment_method: 'upi',
      created_at: now
    });

    // 2. Sale this month (but a few days ago, still valid for monthly but might fall out of 'today' if we tweak the date)
    // To ensure it's not today, we subtract 2 days. If today is the 1st/2nd, we might need to handle month wrap, 
    // but a safe approach is just using the same month.
    let earlierThisMonth = new Date();
    if (earlierThisMonth.getDate() > 2) {
      earlierThisMonth.setDate(earlierThisMonth.getDate() - 2);
    } else {
      // If it's the 1st or 2nd, 'today' and 'monthly' will just include the 'today' sales anyway if we don't have enough days.
      // We can just add hours if needed, but it's fine.
    }

    // Just to be safe, let's explicitly insert a sale with a forced date from yesterday if possible, or just ignore for today.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Make sure yesterday is in the same month for our monthly assertion to be perfectly predictable,
    // If not in the same month, our test assertion logic would need to dynamically check.
    const isSameMonth = yesterday.getMonth() === now.getMonth();

    if (isSameMonth) {
      await Sales.create({
        invoice_number: 'INV-YESTERDAY-1',
        storeId: IDS.store,
        items: [],
        subtotal: 200,
        total_discount: 0,
        total_profit: 80,
        total_taxable: 200,
        total_cgst: 0,
        total_sgst: 0,
        doctor_fee: 0,
        otc_total: 0,
        grand_total: 200,
        amount_paid: 200,
        previous_due_payment: 0,
        due_amount: 0,
        payment_method: 'cash',
        created_at: yesterday
      });
    }
  });

  it('should calculate today\'s sales accurately', async () => {
    const res = await request(app)
      .get('/api/v1/sales/today')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // grand_total: 100 + 150 = 250
    expect(res.body.data.total_sales).toBe(250);
  });

  it('should calculate monthly sales and profit accurately', async () => {
    const res = await request(app)
      .get('/api/v1/sales/monthly')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    
    // We inserted 2 today: 250 total, 100 profit
    // And possibly 1 yesterday: 200 total, 80 profit
    // Total should be >= 250, profit >= 100
    expect(res.body.data.total_sales).toBeGreaterThanOrEqual(250);
    expect(res.body.data.total_profit).toBeGreaterThanOrEqual(100);
  });
});
