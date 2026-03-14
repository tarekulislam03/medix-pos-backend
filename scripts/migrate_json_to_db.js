import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import Customer from '../src/models/customerModel.js';
import Inventory from '../src/models/productModel.js';
import Sales from '../src/models/salesModel.js';

const STORE_ID = '69b520a547a15feffc605d8c';

const migrate = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const dataDir = path.join(process.cwd(), 'data');

        // Helper function to load and migrate data
        const migrateCollection = async (fileName, Model, name) => {
            const filePath = path.join(dataDir, fileName);
            if (!fs.existsSync(filePath)) {
                console.warn(`File ${fileName} not found, skipping...`);
                return;
            }

            const rawData = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(rawData);

            const modifiedData = data.map(item => ({
                ...item,
                storeId: STORE_ID
            }));

            console.log(`Migrating ${modifiedData.length} ${name}...`);
            
            try {
                // Using insertMany with ordered: false to skip duplicates if any
                const result = await Model.insertMany(modifiedData, { ordered: false });
                console.log(`Successfully migrated ${result.length} ${name}.`);
            } catch (err) {
                if (err.writeErrors) {
                    const insertedCount = err.result.nInserted;
                    const errorCount = err.writeErrors.length;
                    console.log(`Migrated ${insertedCount} ${name} (Skipped ${errorCount} duplicates/errors).`);
                } else {
                    console.error(`Error migrating ${name}:`, err.message);
                }
            }
        };

        // Order matters if there are references, but insertMany handles them fine here
        await migrateCollection('customers.json', Customer, 'customers');
        await migrateCollection('inventory.json', Inventory, 'inventory items');
        await migrateCollection('sales.json', Sales, 'sales records');

        console.log('Migration complete!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();
