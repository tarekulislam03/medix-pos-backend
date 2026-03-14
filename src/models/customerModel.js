import mongoose, { Schema } from "mongoose";

const customerSchema = new Schema({
    name: {
        type: String,
        required: true
    },

    phone_no: {
        type: String,
        required: true
    },
    credit_balance: {
        type: Number,
        default: 0
    },
    storeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Store",
        required: true,
        index: true
    }
})

customerSchema.index({ storeId: 1, phone_no: 1 }, { unique: true });

const Customer = mongoose.model("Customer", customerSchema);

export default Customer;