import 'dotenv/config';
import mongoose from 'mongoose';
import Counter from './src/models/counterModel.js';

const checkCounters = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const counters = await Counter.find();
        console.log(JSON.stringify(counters, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

checkCounters();
