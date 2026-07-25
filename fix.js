import mongoose from 'mongoose';
import StoreSubscription from './src/features/billing/models/storeSubscriptionModel.js';

mongoose.connect('mongodb://localhost:27017/medix').then(async () => {
    try {
        const subs = await StoreSubscription.find({ planType: 'emi' });
        let updated = 0;
        
        for(let sub of subs) {
            let changed = false;
            let monthOffset = 1;
            
            sub.schedules.forEach(s => {
                if(s.status === 'pending' && !s.isCustom) {
                    const now = new Date();
                    const due = new Date(s.dueDate);
                    
                    // If it's an old buggy schedule where the first pending is due today
                    // We just overwrite all pending EMIs to be +1, +2, +3 months from today
                    const newDue = new Date();
                    newDue.setMonth(newDue.getMonth() + monthOffset);
                    s.dueDate = newDue;
                    
                    monthOffset++;
                    changed = true;
                }
            });
            
            if(changed) {
                await sub.save();
                updated++;
            }
        }
        console.log(`Updated ${updated} EMI subscriptions`);
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
});
