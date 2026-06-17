import mongoose, { Schema } from "mongoose";

const inventorySchema = new Schema({
    medicine_name: {
        type: String,
        required: true,
    },

    mrp: {
        type: Number,
        required: true,
    },

    quantity: {
        type: Number,
        required: true,
    },

    cost_price: {
        type: Number
    },


    alert_threshold: {
        type: Number,
        default: 2,

    },

    expiry_date: {
        type: Date

    },

    supplier_name: {
        type: String
    },
    barcode: {
        type: String,
    },

    short_barcode: {
        type: String,
    },

    tablets_per_strip: {
        type: Number,
        default: null
    },
    batch_number: {
        type: String,
        default: ""
    },
    hsn_code: {
        type: String,
        default: ""
    },
    gst: {
        type: Number,
        default: 0
    },
    returned_to_supplier: {
        type: Boolean,
        default: false
    },
    loss_saved_amount: {
        type: Number,
        default: 0
    },
    storeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Store",
        required: true,
        index: true
    }
},

    {
        timestamps: true
    });

inventorySchema.index({ storeId: 1, medicine_name: 1 });
inventorySchema.index({ storeId: 1, barcode: 1 }, { unique: true, sparse: true });
inventorySchema.index({ storeId: 1, short_barcode: 1 }, { unique: true, sparse: true });

const Inventory = mongoose.model("Inventory", inventorySchema);

export default Inventory;