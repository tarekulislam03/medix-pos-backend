import mongoose  from "mongoose";

const settingSchema = new mongoose.Schema({
    storeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Store",
        required: true,
        index: true
    },
    
});

export default mongoose.model("Setting", settingSchema);