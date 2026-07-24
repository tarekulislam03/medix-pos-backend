import request from 'supertest';
import app from '../../src/app.js';
import { connectTestDB, disconnectTestDB, clearTestDB, generateTestToken } from '../setup/testHelpers.js';
import Inventory from '../../src/features/product/models/productModel.js';
import mongoose from 'mongoose';

let token;
let storeId;

beforeAll(async () => {
    process.env.JWT_SECRET = 'medix-test-secret-key-2024';
    await connectTestDB();
    storeId = new mongoose.Types.ObjectId();
    token = generateTestToken(new mongoose.Types.ObjectId(), storeId);
});

afterEach(async () => {
    await clearTestDB();
});

afterAll(async () => {
    await disconnectTestDB();
});

describe('Strict Batch Validation - /api/v1/product/create', () => {

    it('creates a new product successfully', async () => {
        const res = await request(app)
            .post('/api/v1/product/create')
            .set('Authorization', `Bearer ${token}`)
            .send({
                medicine_name: 'Dolo 650',
                mrp: 30,
                quantity: 100,
                batch_number: 'B-001',
                expiry_date: '2025-12-31'
            });

        expect(res.status).toBe(201);
        expect(res.body.data.quantity).toBe(100);
    });

    it('merges quantity when same batch, mrp, and expiry are provided', async () => {
        await Inventory.create({
            storeId,
            medicine_name: 'DOLO 650',
            mrp: 30,
            quantity: 50,
            batch_number: 'B-001',
            expiry_date: '2025-12-31T00:00:00.000Z'
        });

        const res = await request(app)
            .post('/api/v1/product/create')
            .set('Authorization', `Bearer ${token}`)
            .send({
                medicine_name: 'Dolo 650',
                mrp: 30,
                quantity: 10,
                batch_number: 'B-001',
                expiry_date: '2025-12-31'
            });

        expect(res.status).toBe(200);
        expect(res.body.data.quantity).toBe(60);
    });

    it('returns 409 Conflict if MRP differs', async () => {
        await Inventory.create({
            storeId,
            medicine_name: 'DOLO 650',
            mrp: 30,
            quantity: 50,
            batch_number: 'B-001',
            expiry_date: '2025-12-31T00:00:00.000Z'
        });

        const res = await request(app)
            .post('/api/v1/product/create')
            .set('Authorization', `Bearer ${token}`)
            .send({
                medicine_name: 'Dolo 650',
                mrp: 40, // Different MRP
                quantity: 10,
                batch_number: 'B-001',
                expiry_date: '2025-12-31'
            });

        expect(res.status).toBe(409);
        expect(res.body.has_conflict).toBe(true);
        expect(res.body.conflict.conflict_fields).toContain('mrp');
    });

    it('returns 409 Conflict if Expiry Date differs', async () => {
        await Inventory.create({
            storeId,
            medicine_name: 'DOLO 650',
            mrp: 30,
            quantity: 50,
            batch_number: 'B-001',
            expiry_date: '2025-12-31T00:00:00.000Z'
        });

        const res = await request(app)
            .post('/api/v1/product/create')
            .set('Authorization', `Bearer ${token}`)
            .send({
                medicine_name: 'Dolo 650',
                mrp: 30,
                quantity: 10,
                batch_number: 'B-001',
                expiry_date: '2026-01-01' // Different Expiry
            });

        expect(res.status).toBe(409);
        expect(res.body.has_conflict).toBe(true);
        expect(res.body.conflict.conflict_fields).toContain('expiry_date');
    });

    it('overwrites and merges if force_update is true despite conflict', async () => {
        await Inventory.create({
            storeId,
            medicine_name: 'DOLO 650',
            mrp: 30,
            quantity: 50,
            batch_number: 'B-001',
            expiry_date: '2025-12-31T00:00:00.000Z'
        });

        const res = await request(app)
            .post('/api/v1/product/create')
            .set('Authorization', `Bearer ${token}`)
            .send({
                medicine_name: 'Dolo 650',
                mrp: 40,
                quantity: 10,
                batch_number: 'B-001',
                expiry_date: '2026-01-01',
                force_update: true
            });

        expect(res.status).toBe(200);
        expect(res.body.data.quantity).toBe(60);
        expect(res.body.data.mrp).toBe(40);
        expect(new Date(res.body.data.expiry_date).toISOString().split('T')[0]).toBe('2026-01-01');
    });

});
