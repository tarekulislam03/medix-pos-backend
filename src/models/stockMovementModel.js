import mongoose from "mongoose";

const stockMovementSchema = new mongoose.Schema(
    {
        storeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Store",
            required: true,
            index: true,
        },
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Inventory",
            required: true,
            index: true,
        },
        medicine_name: {
            type: String,
            required: true,
        },
        transaction_type: {
            type: String,
            enum: ["SALE", "PURCHASE", "MANUAL_ADJUSTMENT", "RETURN", "INITIAL_STOCK"],
            required: true,
        },
        reference_id: {
            // Can be Sale ID, Purchase ID, etc. Can be null for manual adjustments
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },
        quantity_change: {
            type: Number,
            required: true,
            // positive for inward (purchase, return), negative for outward (sale)
        },
        previous_stock: {
            type: Number,
            required: true,
        },
        current_stock: {
            type: Number,
            required: true,
        },
        remarks: {
            type: String,
            default: "",
        }
    },
    { timestamps: true }
);

// Index for efficient querying by store, product, and date
stockMovementSchema.index({ storeId: 1, productId: 1, createdAt: -1 });
stockMovementSchema.index({ storeId: 1, createdAt: -1 });

const StockMovement = mongoose.model("StockMovement", stockMovementSchema);

export default StockMovement;
