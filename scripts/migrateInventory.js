import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

import Inventory from "../src/models/productModel.js";
import Product from "../src/models/newProductModel.js";
import Batch from "../src/models/batchModel.js";
import StockLedger from "../src/models/stockLedgerModel.js";

const migrate = async () => {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/medix");
        console.log("Connected.");

        console.log("Cleaning up previous migration data (if any)...");
        await Product.deleteMany({});
        await Batch.deleteMany({});
        await StockLedger.deleteMany({});

        console.log("Starting Migration without transactions to prevent timeout...");
        const inventories = await Inventory.find({});
        console.log(`Found ${inventories.length} inventory records to migrate.`);

        let count = 0;
        for (const item of inventories) {
            // 1. Upsert Product (in case multiple batches of same product exist)
            // Using medicine_name and storeId as the unique combination for a Product
            let product = await Product.findOne({
                storeId: item.storeId,
                medicine_name: item.medicine_name,
            });

            if (!product) {
                product = new Product({
                    medicine_name: item.medicine_name,
                    mrp: item.mrp,
                    alert_threshold: item.alert_threshold,
                    barcode: item.barcode,
                    short_barcode: item.short_barcode,
                    tablets_per_strip: item.tablets_per_strip,
                    hsn_code: item.hsn_code,
                    gst: item.gst,
                    storeId: item.storeId,
                });
                await product.save();
            }

            // 2. Create Batch
            const batch = new Batch({
                product_id: product._id,
                batch_number: item.batch_number || `OPENING_BATCH_${item._id.toString()}`,
                expiry_date: item.expiry_date,
                mrp: item.mrp,
                cost_price: item.cost_price || item.mrp,
                available_quantity: item.quantity,
                storeId: item.storeId,
            });
            await batch.save();

            // 3. Create StockLedger Entry
            const stockLedger = new StockLedger({
                batch_id: batch._id,
                transaction_type: "INITIAL_OPENING",
                reference_type: "Migration",
                quantity_in: item.quantity,
                quantity_out: 0,
                balance: item.quantity,
                storeId: item.storeId,
            });
            await stockLedger.save();
            
            count++;
            if (count % 500 === 0) {
                console.log(`Migrated ${count} / ${inventories.length} records...`);
            }
        }

        console.log("Migration completed successfully.");

        process.exit(0);
    } catch (error) {
        console.error("Error running migration:", error);
        process.exit(1);
    }
};

migrate();
