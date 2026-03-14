import 'dotenv/config';
import mongoose from 'mongoose';
import Customer from './src/models/customerModel.js';
import Inventory from './src/models/productModel.js';
import Sales from './src/models/salesModel.js';

const STORE_ID = '69b520a547a15feffc605d8c';

const verify = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        const customerCount = await Customer.countDocuments({ storeId: STORE_ID });
        const inventoryCount = await Inventory.countDocuments({ storeId: STORE_ID });
        const salesCount = await Sales.countDocuments({ storeId: STORE_ID });

        console.log(`Verification for Store ID: ${STORE_ID}`);
        console.log(`Customers: ${customerCount}`);
        console.log(`Inventory Items: ${inventoryCount}`);
        console.log(`Sales Records: ${salesCount}`);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

verify();
