import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema({
  dueDate: { type: Date, required: true },
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ["pending", "uploaded", "paid"],
    default: "pending",
  },
  utrNumber: { type: String, default: "" },
  paidDate: { type: Date, default: null },
  isCustom: { type: Boolean, default: false },
  upiId: { type: String, default: "" },
  warningDays: { type: Number, default: 5 },
  blockDays: { type: Number, default: 10 }
});

const StoreSubscriptionSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store",
    required: true,
    unique: true, // One active subscription plan per store
    index: true
  },
  planType: {
    type: String,
    enum: ["emi", "full_payment"],
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  downpayment: {
    type: Number,
    default: 0
  },
  timelineMonths: {
    type: Number,
    default: 1
  },
  upiId: {
    type: String,
    default: ""
  },
  warningDays: {
    type: Number,
    default: 5
  },
  blockDays: {
    type: Number,
    default: 10
  },
  schedules: [scheduleSchema],
}, { timestamps: true });

const StoreSubscription = mongoose.model("StoreSubscription", StoreSubscriptionSchema);

export default StoreSubscription;
