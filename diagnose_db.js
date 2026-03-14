import 'dotenv/config';
import mongoose from 'mongoose';
import Inventory from './src/models/productModel.js';
import Customer from './src/models/customerModel.js';
import Sales from './src/models/salesModel.js';
import CreditTransaction from './src/models/creditModel.js';

const diagnose = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected!');

        const targetStoreId = "69b520a547a15feffc605d8c";

        const models = [
            { name: 'Inventory', model: Inventory },
            { name: 'Customer', model: Customer },
            { name: 'Sales', model: Sales },
            { name: 'CreditTransaction', model: CreditTransaction }
        ];

        for (const { name, model } of models) {
            const total = await model.countDocuments();
            const missingStoreId = await model.countDocuments({ 
                $or: [
                    { storeId: { $exists: false } },
                    { storeId: null }
                ]
            });
            const forTargetStore = await model.countDocuments({ storeId: targetStoreId });
            
            console.log(`${name}: Total ${total}, Missing storeId: ${missingStoreId}, Target Store ${targetStoreId}: ${forTargetStore}`);
        }

        process.exit(0);
    } catch (error) {
        console.error('Diagnosis failed:', error);
        process.exit(1);
    }
};

diagnose();
