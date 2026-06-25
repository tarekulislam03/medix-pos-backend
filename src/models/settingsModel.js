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
    },
    printerSize: {
        type: String,
        default: "58mm"
    },
    showGstDetails: {
        type: Boolean,
        default: false
    },
    showDiscountPercentage: {
        type: Boolean,
        default: true
    },
    showBarcode: {
        type: Boolean,
        default: true
    },
    showQrCode: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

export default mongoose.model("Setting", settingSchema);