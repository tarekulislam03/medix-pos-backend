import Counter from "../models/counterModel.js";
import Inventory from "../models/productModel.js";

export const getNextShortBarcode = async (storeId) => {

    const lastProduct = await Inventory
        .findOne({ storeId })
        .sort({ short_barcode: -1 })
        .select("short_barcode");

    const base = lastProduct ? Number(lastProduct.short_barcode) : 100000;

    const counter = await Counter.findOneAndUpdate(
        { storeId },
        {
            $max: { short_barcode_seq: base },
            $inc: { short_barcode_seq: 1 }
        },
        {
            new: true,
            upsert: true
        }
    );

    return String(counter.short_barcode_seq);
};