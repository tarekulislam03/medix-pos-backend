import 'dotenv/config';
import mongoose from 'mongoose';
import Inventory from '../src/models/productModel.js';
import Customer from '../src/models/customerModel.js';
import Sales from '../src/models/salesModel.js';
import CreditTransaction from '../src/models/creditModel.js';
import Store from '../src/models/storeModel.js';
import Counter from '../src/models/counterModel.js';

const targetStoreId = "69b520a547a15feffc605d8c";

const migrate = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected!');

        // 1. Store Setup
        const store = await Store.findById(targetStoreId);
        if (!store) {
            console.error(`Target store ${targetStoreId} not found!`);
            process.exit(1);
        }
        console.log(`Target Store: ${store.storeName}`);

        const filter = { 
            $or: [
                { storeId: { $exists: false } },
                { storeId: null }
            ]
        };

        // 2. Inventory Migration
        console.log('Migrating Inventory...');
        const inventoryResult = await Inventory.updateMany(filter, { $set: { storeId: targetStoreId } });
        console.log(`Inventory updated: ${inventoryResult.modifiedCount} records.`);

        // 3. Customer Migration
        console.log('Migrating Customers...');
        const customerResult = await Customer.updateMany(filter, { $set: { storeId: targetStoreId } });
        console.log(`Customers updated: ${customerResult.modifiedCount} records.`);

        // 4. Sales Migration
        console.log('Migrating Sales...');
        const salesResult = await Sales.updateMany(filter, { $set: { storeId: targetStoreId } });
        console.log(`Sales updated: ${salesResult.modifiedCount} records.`);

        // 5. Credit Migration
        console.log('Migrating Credit Transactions...');
        const creditResult = await CreditTransaction.updateMany(filter, { $set: { storeId: targetStoreId } });
        console.log(`Credit Transactions updated: ${creditResult.modifiedCount} records.`);

        // 6. Counter Setup
        console.log('Setting up Counter...');
        const lastProduct = await Inventory.findOne({ storeId: targetStoreId, short_barcode: { $exists: true } })
            .sort({ short_barcode: -1 })
            .collation({ locale: "en_US", numericOrdering: true });

        let nextShortBarcode = 100001;
        if (lastProduct && lastProduct.short_barcode && !isNaN(lastProduct.short_barcode)) {
            nextShortBarcode = parseInt(lastProduct.short_barcode, 10) + 1;
        }
        console.log(`Next available short barcode: ${nextShortBarcode}`);

        await Counter.findOneAndUpdate(
            { storeId: targetStoreId },
            { $set: { short_barcode_seq: nextShortBarcode - 1 } }, // The counter usually stores the last used value
            { upsert: true, new: true }
        );
        console.log(`Counter updated for store ${targetStoreId}`);

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();
