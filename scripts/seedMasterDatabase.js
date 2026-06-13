import mongoose from "mongoose";
import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import MasterMedicine from "../src/models/masterMedicineModel.js";
import Inventory from "../src/models/productModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const seedMasterDatabase = async () => {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected.");

        console.log("Fetching existing inventory...");
        // Get all items sorted by updated at (to get the most recent MRP)
        const allItems = await Inventory.find({}).sort({ updatedAt: -1 }).lean();
        console.log(`Found ${allItems.length} total inventory items across all stores.`);

        const uniqueMedicines = new Map();

        for (const item of allItems) {
            if (!item.medicine_name) continue;
            
            const normalizedName = item.medicine_name.trim().toUpperCase();
            if (!normalizedName) continue;

            // We only keep the first occurrence because we sorted by updatedAt desc
            if (!uniqueMedicines.has(normalizedName)) {
                uniqueMedicines.set(normalizedName, {
                    medicine_name: normalizedName,
                    mrp: Number(item.mrp) || 0,
                });
            }
        }

        console.log(`Found ${uniqueMedicines.size} unique medicines. Seeding master database...`);

        const bulkOps = [];
        for (const [name, data] of uniqueMedicines.entries()) {
            bulkOps.push({
                updateOne: {
                    filter: { medicine_name: name },
                    update: { $set: data },
                    upsert: true,
                },
            });
        }

        if (bulkOps.length > 0) {
            const result = await MasterMedicine.bulkWrite(bulkOps);
            console.log(`Seed complete. Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}`);
        } else {
            console.log("No medicines to seed.");
        }

        process.exit(0);
    } catch (error) {
        console.error("Error seeding master database:", error);
        process.exit(1);
    }
};

seedMasterDatabase();
