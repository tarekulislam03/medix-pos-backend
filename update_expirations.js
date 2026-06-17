import mongoose from 'mongoose';

const uri = "mongodb+srv://tarekul03muslim_db_user:03vIfN0HYIk8e5tb@medix-database.wmncwmr.mongodb.net/test";

async function run() {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB");
    
    const Inventory = mongoose.connection.collection('inventories');
    
    // Find items created in the last 15 minutes
    const tenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentlyAdded = await Inventory.find({ createdAt: { $gte: tenMinutesAgo } }).toArray();
    
    console.log(`Found ${recentlyAdded.length} recently added items to update.`);
    
    let updatedCount = 0;
    for (const item of recentlyAdded) {
        if (item.expiry_date) {
            const exp = new Date(item.expiry_date);
            // Set to the last day of the month
            const lastDay = new Date(exp.getFullYear(), exp.getMonth() + 1, 0, 23, 59, 59);
            
            await Inventory.updateOne(
                { _id: item._id },
                { $set: { expiry_date: lastDay } }
            );
            updatedCount++;
        }
    }
    
    console.log(`Successfully updated ${updatedCount} items to end of month expiry.`);
    process.exit(0);
}

run().catch(console.dir);
