import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function fixNegativeStock() {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('inventories');

    // Find all items with negative stock
    const negativeItems = await collection.find({ quantity: { $lt: 0 } }).toArray();
    console.log(`Found ${negativeItems.length} items with negative stock:`);
    
    for (const item of negativeItems) {
        console.log(`  - ${item.medicine_name}: qty=${item.quantity}`);
    }

    if (negativeItems.length > 0) {
        // Fix them all to 0
        const result = await collection.updateMany(
            { quantity: { $lt: 0 } },
            { $set: { quantity: 0 } }
        );
        console.log(`\nFixed ${result.modifiedCount} items — set quantity to 0`);
    } else {
        console.log('No negative stock items found!');
    }

    await mongoose.disconnect();
    console.log('Done.');
}

fixNegativeStock().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
