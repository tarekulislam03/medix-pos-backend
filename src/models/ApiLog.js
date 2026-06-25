import mongoose from "mongoose";

const apiLogSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    method: {
        type: String,
        required: true,
        index: true
    },
    endpoint: {
        type: String,
        required: true,
        index: true
    },
    statusCode: {
        type: Number,
        required: true,
        index: true
    },
    responseTime: {
        type: Number, // In milliseconds
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    storeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Store",
        default: null,
        index: true
    },
    storeName: {
        type: String,
        default: null
    },
    success: {
        type: Boolean,
        required: true,
        index: true
    },
    error: {
        type: String,
        default: null
    },
    ip: {
        type: String,
        default: null
    },
    userAgent: {
        type: String,
        default: null
    }
});

const ApiLog = mongoose.model("ApiLog", apiLogSchema);

export default ApiLog;
