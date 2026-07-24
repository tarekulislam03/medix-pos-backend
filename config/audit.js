import fs from 'fs';
import { performance } from 'perf_hooks';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import { connectTestDB, disconnectTestDB, clearTestDB, generateTestToken, setTestEnv } from '../tests/setup/testHelpers.js';
import { IDS, seedDatabase, autoImportConfirmPayload } from '../tests/fixtures/seedData.js';
import Store from '../src/features/store/models/storeModel.js';
import User from '../src/features/user/models/userModel.js';
import Customer from '../src/features/customer/models/customerModel.js';
import Inventory from '../src/features/product/models/productModel.js';

async function runAudit() {
    setTestEnv();
    await connectTestDB();
    await clearTestDB();
    await seedDatabase({ Store, User, Customer, Inventory });
    const token = generateTestToken(IDS.user, IDS.store);

    // Mongoose Debug wrapper to capture DB times
    mongoose.set('debug', function (collectionName, method, query, doc, options) {
        console.log(`Mongoose: ${collectionName}.${method} - Query: ${JSON.stringify(query)}`);
    });

    console.log("=========================================");
    console.log("PHASE 1: UPLOAD & EXTRACT (AUTO-IMPORT)");
    console.log("=========================================");
    
    // Create a dummy image (1x1 pixel PNG) to trigger the upload
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
    console.log("Phase 1 Response Body:", JSON.stringify(res1.body).slice(0, 100) + '...');

    console.log("\n=========================================");
    console.log("PHASE 2: CONFIRM IMPORT (BULK DB UPDATES)");
    console.log("=========================================");
    
    // Make payload 10 times larger to simulate a real big invoice
    let bigPayload = { items: [] };
    for (let i = 0; i < 10; i++) {
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
    
    console.log(`\nPhase 2 Total Request Time: ${(endPhase2 - startPhase2).toFixed(2)} ms`);
    console.log("Phase 2 Response Code:", res2.status);
    console.log("Phase 2 Response Body:", res2.body);

    fs.unlinkSync('dummy.png');
    await disconnectTestDB();
}

runAudit().catch(console.error);
