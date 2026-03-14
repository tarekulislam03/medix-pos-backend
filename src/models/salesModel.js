import mongoose from "mongoose";

const SalesSchema = new mongoose.Schema({
    invoice_number: {
        type: String,
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        required: false
    },
    items: [
        {
            product_id: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Inventory",
                required: true,
            },
            medicine_name: {
                type: String,
                required: true,
            },
            barcode: {
                type: String,
            },
            mrp: {
                type: Number,
                required: true,
            },
            quantity: {
                type: Number,
                required: true,
            },
            discount_percent: {
                type: Number,
                default: 0,
            },
            discount_amount: {
                type: Number,
                default: 0,
            },
            total: {
                type: Number,
                required: true,
            },
        }
    ],

    subtotal: Number,
    total_discount: Number,
    grand_total: Number,
    amount_paid: Number,
    due_amount: Number,

    payment_method: {
        type: String,
        enum: ["cash", "upi", "card"]
    },

    created_at: {
        type: Date,
        default: Date.now
    },
    storeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Store",
        required: true,
        index: true
    }
});

SalesSchema.index({ storeId: 1, invoice_number: 1 }, { unique: true });

const Sales = mongoose.model("Sales", SalesSchema);

export default Sales;