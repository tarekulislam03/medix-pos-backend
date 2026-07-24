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
import Inventory from '../../src/features/product/models/productModel.js';
import Sales from '../../src/features/sales/models/salesModel.js';
import Customer from '../../src/features/customer/models/customerModel.js';
import Store from '../../src/features/store/models/storeModel.js';
import User from '../../src/features/user/models/userModel.js';

const models = { Store, User, Customer, Inventory };

describe('Customer API Integration', () => {
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

  it('should create a new customer', async () => {
    const payload = {
      name: 'John Doe',
      phone_no: '9988776655'
    };

    const res = await request(app)
      .post('/api/v1/customer/create')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Customer created successfully');
    expect(res.body.data.name).toBe('John Doe');

    const customer = await Customer.findOne({ phone_no: '9988776655' });
    expect(customer).toBeDefined();
    expect(customer.name).toBe('John Doe');
    expect(customer.credit_balance).toBe(0); // default should be 0 or undefined mapping to 0
  });

  it('should not create a customer with existing phone number', async () => {
    // Attempt to create customer with phone number of customer1
    const payload = {
      name: 'Duplicate John',
      phone_no: '9111111111' // existing in seedData for customer1
    };

    const res = await request(app)
      .post('/api/v1/customer/create')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('should update an existing customer', async () => {
    const payload = {
      name: 'Rahul Sharma Updated',
      phone_no: '9111111112'
    };

    const res = await request(app)
      .put(`/api/v1/customer/update/${IDS.customer1}`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Customer updated successfully');

    const customer = await Customer.findById(IDS.customer1);
    expect(customer.name).toBe('Rahul Sharma Updated');
    expect(customer.phone_no).toBe('9111111112');
  });

  it('should fetch customer credit balance correctly', async () => {
    // customer1 has 500 credit balance from seedData
    const res = await request(app)
      .get(`/api/v1/customer/credit/${IDS.customer1}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.customer_credit_balance).toBe(500);
  });

  it('should pay customer due and update credit balance', async () => {
    // Pay 200 out of 500
    const payload = {
      amount_paid: 200
    };

    const res = await request(app)
      .post(`/api/v1/customer/pay-due/${IDS.customer1}`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Payment recorded successfully');
    expect(res.body.new_balance).toBe(300);

    const customer = await Customer.findById(IDS.customer1);
    expect(customer.credit_balance).toBe(300);
  });

  it('should fetch all customers', async () => {
    const res = await request(app)
      .get('/api/v1/customer/get')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2); // At least 2 seeded customers
  });
});
