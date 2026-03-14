import 'dotenv/config';
import mongoose from 'mongoose';
import Inventory from '../src/models/productModel.js';

const migrateBarcodes = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected!');

        console.log('Starting migration for short_barcode...');

        // Find highest existing short_barcode
        const lastProduct = await Inventory.findOne({ short_barcode: { $exists: true } })
            .sort({ short_barcode: -1 })
            .collation({ locale: "en_US", numericOrdering: true });

        let currentShortBarcode = 100001;
        if (lastProduct && lastProduct.short_barcode && !isNaN(lastProduct.short_barcode)) {
            currentShortBarcode = parseInt(lastProduct.short_barcode, 10) + 1;
        }

        const productsWithoutShortBarcode = await Inventory.find({
            $or: [
                { short_barcode: { $exists: false } },
                { short_barcode: null },
                { short_barcode: "" }
            ]
        });

        console.log(`Found ${productsWithoutShortBarcode.length} products to migrate.`);

        let updatedCount = 0;
        for (const product of productsWithoutShortBarcode) {
            product.short_barcode = currentShortBarcode.toString();
            await product.save();
            currentShortBarcode++;
            updatedCount++;

            if (updatedCount % 100 === 0) {
                console.log(`Updated ${updatedCount} products...`);
            }
        }

        console.log(`Migration completed successfully! Total updated: ${updatedCount}`);
        process.exit(0);

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrateBarcodes();
