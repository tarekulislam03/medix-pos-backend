import request from 'supertest';
import app from '../../src/app.js';
import { connectTestDB, disconnectTestDB, clearTestDB, generateTestToken, setTestEnv } from '../setup/testHelpers.js';
import { IDS, seedDatabase, autoImportConfirmPayload } from '../fixtures/seedData.js';
import Store from '../../src/models/storeModel.js';
import User from '../../src/models/userModel.js';
import Customer from '../../src/models/customerModel.js';
import Inventory from '../../src/models/productModel.js';
import mongoose from 'mongoose';
import fs from 'fs';
import { performance } from 'perf_hooks';

describe('Performance Audit', () => {
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
        await seedDatabase({ Store, User, Customer, Inventory });
    });

    it('should audit Phase 1 (Upload)', async () => {
        mongoose.set('debug', function (collectionName, method, query, doc, options) {
            console.log(`Mongoose: ${collectionName}.${method}`);
        });

        const dummyImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
        fs.writeFileSync('dummy.png', dummyImage);

        const startPhase1 = performance.now();
        const res1 = await request(app)
            .post('/api/v1/product/auto-import')
            .set('Authorization', `Bearer ${token}`)
            .attach('invoice', 'dummy.png', { contentType: 'image/png' });
        const endPhase1 = performance.now();
        
        console.log(`\nPhase 1 Total Request Time: ${(endPhase1 - startPhase1).toFixed(2)} ms`);
        console.log("Phase 1 Response Code:", res1.status);
        if (res1.status !== 200) console.log("Phase 1 Msg:", res1.body.message);

        fs.unlinkSync('dummy.png');
        mongoose.set('debug', false);
    }, 30000);

    it('should audit Phase 2 (Confirm)', async () => {
        mongoose.set('debug', function (collectionName, method, query, doc, options) {
            console.log(`Mongoose: ${collectionName}.${method}`);
        });

        let bigPayload = { items: [] };
        for (let i = 0; i < 50; i++) { // 100 items total
            for (let item of autoImportConfirmPayload.items) {
                 bigPayload.items.push({
                     ...item,
                     medicine_name: item.medicine_name + (i > 0 ? `_${i}` : '')
                 });
            }
        }

        const startPhase2 = performance.now();
        const res2 = await request(app)
            .post('/api/v1/product/auto-import/confirm')
            .set('Authorization', `Bearer ${token}`)
            .send(bigPayload);
        const endPhase2 = performance.now();
        
        console.log(`\nPhase 2 Total Request Time (100 items): ${(endPhase2 - startPhase2).toFixed(2)} ms`);
        console.log("Phase 2 Response Code:", res2.status);

        mongoose.set('debug', false);
    }, 30000);
});
