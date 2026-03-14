import 'dotenv/config';
import mongoose from 'mongoose';
import Inventory from './src/models/productModel.js';
import Customer from './src/models/customerModel.js';
import Sales from './src/models/salesModel.js';

const inspectData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        console.log('--- Sample Sale with MISSING storeId ---');
        const sampleSale = await Sales.findOne({ storeId: { $exists: false } }).populate('customer items.product_id');
        if (sampleSale) {
            // console.log(JSON.stringify(sampleSale, null, 2));
            console.log(`Sale ID: ${sampleSale._id}`);
            console.log(`Customer ID: ${sampleSale.customer?._id} | Customer storeId: ${sampleSale.customer?.storeId}`);
            if (sampleSale.items && sampleSale.items.length > 0) {
                const item = sampleSale.items[0];
                console.log(`Product ID: ${item.product_id?._id} | Product storeId: ${item.product_id?.storeId}`);
            }
        } else {
            console.log('No sale found without storeId');
        }

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

inspectData();
