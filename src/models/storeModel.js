import mongoose from "mongoose";

const StoreSchema = new mongoose.Schema({
  storeName: {
    type: String,
    required: true
  },
  storePhone: {
    type: String,
    required: true,
    unique: true
  }
}, { timestamps: true });

const Store = mongoose.model("Store", StoreSchema);

export default Store;
