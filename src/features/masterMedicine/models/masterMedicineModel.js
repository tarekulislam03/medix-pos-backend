import mongoose from "mongoose";

const masterMedicineSchema = new mongoose.Schema(
    {
        medicine_name: {
            type: String,
            required: [true, "Please add a medicine name"],
            unique: true,
            uppercase: true,
            trim: true,
        },
        mrp: {
            type: Number,
            required: [true, "Please add MRP"],
        },
    },
    {
        timestamps: true,
    }
);

masterMedicineSchema.index({ medicine_name: 'text' });

const MasterMedicine = mongoose.model("MasterMedicine", masterMedicineSchema);

export default MasterMedicine;
