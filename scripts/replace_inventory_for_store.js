import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import Inventory from '../src/models/productModel.js';

const STORE_ID = '69b520a547a15feffc605d8c';

const replaceInventory = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI not found in environment');
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const filePath = path.join(process.cwd(), 'data', 'inventory.json');
        if (!fs.existsSync(filePath)) {
            console.error('inventory.json not found in data folder');
            process.exit(1);
        }

        const rawData = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(rawData);

        console.log(`Found ${data.length} items in inventory.json`);

        // 1. Remove current inventory for the store
        console.log(`Deleting existing inventory for store ${STORE_ID}...`);
        const deleteResult = await Inventory.deleteMany({ storeId: STORE_ID });
        console.log(`Deleted ${deleteResult.deletedCount} items.`);

        // 2. Prepare data for insertion
        const modifiedData = data.map(item => {
            const newItem = { ...item };
            
            // Remove _id and __v to let MongoDB generate new ones and avoid conflicts
            delete newItem._id;
            delete newItem.__v;
            
            // Ensure storeId is set
            newItem.storeId = STORE_ID;
            
            return newItem;
        });

        // 3. Insert new data
        console.log(`Inserting ${modifiedData.length} new items...`);
        
        // Use chunks to avoid hitting document size limits or timeout with large arrays
        const chunkSize = 500;
        let insertedCount = 0;
        
        for (let i = 0; i < modifiedData.length; i += chunkSize) {
            const chunk = modifiedData.slice(i, i + chunkSize);
            const result = await Inventory.insertMany(chunk, { ordered: true });
            insertedCount += result.length;
            console.log(`Inserted ${insertedCount}/${modifiedData.length} items...`);
        }

        console.log(`Successfully replaced inventory. Total ${insertedCount} items inserted.`);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

replaceInventory();
