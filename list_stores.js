import 'dotenv/config';
import mongoose from 'mongoose';
import Store from './src/models/storeModel.js';

const listStores = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const stores = await Store.find();
        stores.forEach(s => {
            console.log(`ID: ${s._id} | Name: ${s.storeName} | Phone: ${s.storePhone}`);
        });
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

listStores();
