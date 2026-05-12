import mongoose from "mongoose";

const settingSchema = new mongoose.Schema({
    storeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Store",
        required: true,
        unique: true,
        index: true
    },
    storeName: {
        type: String,
        default: ""
    },
    address: {
        type: String,
        default: ""
    },
    phone: {
        type: String,
        default: ""
    },
    gstNo: {
        type: String,
        default: ""
    },
    licenceNo: {
        type: String,
        default: ""
    },
    upiId: {
        type: String,
        default: ""
    }
}, { timestamps: true });

export default mongoose.model("Setting", settingSchema);