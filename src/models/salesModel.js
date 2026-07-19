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
    customer_name: { type: String },
    customer_phone: { type: String },
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
            cost_price: {
                type: Number,
                default: 0,
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
            gst_percent: {
                type: Number,
                default: 0,
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
            igst_amount: {
                type: Number,
                default: 0,
            },
            hsn_code: {
                type: String,
                default: ""
            },
            expiry_date: {
                type: Date,
                default: null
            }
        }
    ],

    subtotal: Number,
    total_discount: Number,
    total_profit: { type: Number, default: 0 },
    total_taxable: { type: Number, default: 0 },
    total_cgst: { type: Number, default: 0 },
    total_sgst: { type: Number, default: 0 },
    doctor_fee: { type: Number, default: 0 },
    otc_items: [
        {
            name: { type: String, required: true },
            price: { type: Number, required: true, default: 0 }
        }
    ],
    otc_total: { type: Number, default: 0 },
    grand_total: Number,
    amount_paid: Number,
    previous_due_payment: { type: Number, default: 0 },
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