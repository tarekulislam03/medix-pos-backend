import Counter from "../models/counterModel.js";
import Inventory from "../models/productModel.js";

export const getNextShortBarcode = async (storeId) => {

    const lastProduct = await Inventory
        .findOne({ storeId })
        .sort({ short_barcode: -1 })
        .select("short_barcode");

    const base = lastProduct ? Number(lastProduct.short_barcode) : 100000;

    let counter = await Counter.findOne({ storeId });
    if (!counter) {
        counter = await Counter.create({ storeId, short_barcode_seq: base + 1 });
    } else {
        if (counter.short_barcode_seq < base) {
            counter.short_barcode_seq = base;
        }
        counter.short_barcode_seq += 1;
        await counter.save();
    }

    return String(counter.short_barcode_seq);
};