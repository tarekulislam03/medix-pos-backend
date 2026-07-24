import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    category: {
        type: String,
        required: true,
        enum: ['Rent', 'Utilities', 'Salary', 'Inventory', 'Maintenance', 'Marketing', 'Miscellaneous']
    },
    payment_method: {
        type: String,
        required: true,
        enum: ['cash', 'card', 'upi', 'bank']
    },
    date: {
        type: Date,
        default: Date.now
    },
    notes: {
        type: String,
        trim: true,
        default: ''
    }
}, { timestamps: true });

export default mongoose.model('Expense', expenseSchema);
