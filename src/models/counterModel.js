import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
    storeId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        unique: true
    },
    short_barcode_seq: {
        type: Number,
        default: 100000
    }
});

export default mongoose.model("Counter", counterSchema);