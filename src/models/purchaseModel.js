import mongoose from "mongoose";

const purchaseSchema = new mongoose.Schema(
    {
        storeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Store",
            required: true,
            index: true,
        },

        // Bill image stored on Cloudinary
        bill_image_url: {
            type: String,
            default: null,
        },
        cloudinary_public_id: {
            type: String,
            default: null,
        },

        // Metadata — filled from LLM extraction or manual upload
        supplier_name: {
            type: String,
            default: "",
        },
        supplier_gstin: {
            type: String,
            default: "",
        },
        notes: {
            type: String,
            default: "",
        },
        taxable_amount: {
            type: Number,
            default: 0,
        },
        cgst_amount: {
            type: Number,
            default: 0,
        },
        sgst_amount: {
            type: Number,
            default: 0,
        },
        total_amount: {
            type: Number,
            default: 0,
        },
        items_count: {
            type: Number,
            default: 0,
        },
        bill_no: {
            type: String,
            default: "",
        },
        bill_date: {
            type: String,
            default: "",
        },

        // Links to the exact Inventory records created/updated during auto-import
        imported_items: [{
            inventoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory" },
            quantity: { type: Number, default: 0 },
            mrp: { type: Number, default: 0 }
        }],

        // Source: 'manual' = uploaded from Purchase page, 'auto_import' = from Inventory auto-import
        source: {
            type: String,
            enum: ["manual", "auto_import"],
            default: "manual",
        },

        status: {
            type: String,
            enum: ["pending", "received", "cancelled"],
            default: "pending",
        },
    },
    { timestamps: true }
);

const Purchase = mongoose.model("Purchase", purchaseSchema);

export default Purchase;
