import Expense from '../models/expenseModel.js';

// @desc    Get all expenses
// @route   GET /api/expenses
// @access  Private (Admin/Manager)
export const getExpenses = async (req, res) => {
    try {
        const expenses = await Expense.find().sort({ date: -1, createdAt: -1 });
        res.status(200).json(expenses);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch expenses', error: error.message });
    }
};

// @desc    Add a new expense
// @route   POST /api/expenses
// @access  Private
export const addExpense = async (req, res) => {
    try {
        const { title, amount, category, payment_method, date, notes } = req.body;
        
        if (!title || !amount || !category || !payment_method) {
            return res.status(400).json({ message: 'Title, amount, category, and payment method are required.' });
        }

        const newExpense = new Expense({
            title,
            amount,
            category,
            payment_method,
            date: date || Date.now(),
            notes
        });

        const savedExpense = await newExpense.save();
        res.status(201).json(savedExpense);
    } catch (error) {
        res.status(500).json({ message: 'Failed to add expense', error: error.message });
    }
};

// @desc    Update an expense
// @route   PUT /api/expenses/:id
// @access  Private
export const updateExpense = async (req, res) => {
    try {
        const { title, amount, category, payment_method, date, notes } = req.body;
        
        const expense = await Expense.findById(req.params.id);
        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        expense.title = title || expense.title;
        expense.amount = amount !== undefined ? amount : expense.amount;
        expense.category = category || expense.category;
        expense.payment_method = payment_method || expense.payment_method;
        if (date) expense.date = date;
        if (notes !== undefined) expense.notes = notes;

        const updatedExpense = await expense.save();
        res.status(200).json(updatedExpense);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update expense', error: error.message });
    }
};

// @desc    Delete an expense
// @route   DELETE /api/expenses/:id
// @access  Private
export const deleteExpense = async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);
        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }
        await expense.deleteOne();
        res.status(200).json({ message: 'Expense removed' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete expense', error: error.message });
    }
};
