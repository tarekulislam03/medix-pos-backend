import mongoose from "mongoose";

const StoreSchema = new mongoose.Schema({
  storeName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/^[\w!#$%&'*+/=?^`{|}~.-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Please fill a valid email address']
  },
  password: {
    type: String,
    required: true
  },
  address: {
    type: String
  },
  contactNumber: {
    type: String
  }
}, { timestamps: true });

const Store = mongoose.model("Store", StoreSchema);

export default Store;
