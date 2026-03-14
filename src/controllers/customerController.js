import Customer from "../models/customerModel.js";
import Sales from "../models/salesModel.js";
import mongoose from "mongoose";

// create customer
const createCustomer = async (req, res) => {
    try {
        const { name, phone_no } = req.body;

        // Validation
        if (!name || !phone_no) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        // Optional: prevent duplicate phone numbers
        const existing = await Customer.findOne({ phone_no, storeId: req.storeId });
        if (existing) {
            return res.status(400).json({
                message: "Customer with this phone number already exists in this store"
            });
        }

        const customer = await Customer.create({
            name,
            phone_no,
            storeId: req.storeId
        });

        return res.status(201).json({
            message: "Customer created successfully",
            data: customer
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};


// get all customer
const getAllCustomers = async (req, res) => {
    try {
        const customers = await Customer.find({ storeId: req.storeId }).sort({ createdAt: -1 });

        return res.status(200).json({
            data: customers
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};


// get customer by id
const getCustomerById = async (req, res) => {
    try {
        const { id } = req.params;

        const customer = await Customer.findOne({ _id: id, storeId: req.storeId });

        if (!customer) {
            return res.status(404).json({
                message: "Customer not found"
            });
        }

        return res.status(200).json({
            data: customer
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};


// update customer
const updateCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone_no } = req.body;

        const customer = await Customer.findOne({ _id: id, storeId: req.storeId });

        if (!customer) {
            return res.status(404).json({
                message: "Customer not found"
            });
        }

        if (name) customer.name = name;
        if (phone_no) customer.phone_no = phone_no;

        await customer.save();

        return res.status(200).json({
            message: "Customer updated successfully",
            data: customer
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};


// delete customer
const deleteCustomer = async (req, res) => {
    try {
        const { id } = req.params;

        const customer = await Customer.findOneAndDelete({ _id: id, storeId: req.storeId });

        if (!customer) {
            return res.status(404).json({
                message: "Customer not found"
            });
        }

        return res.status(200).json({
            message: "Customer deleted successfully"
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};


// search customer by name
const searchCustomer = async (req, res) => {
    try {
        const q = req.query.q || "";

        if (!q) {
            return res.status(400).json({
                message: "Search query is required"
            });
        }

        const customers = await Customer.find({
            storeId: req.storeId,
            $or: [
                { name: { $regex: q, $options: "i" } },
                { phone_no: { $regex: q, $options: "i" } }
            ]
        }).limit(5);

        return res.status(200).json({
            data: customers
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};

const getCustomerLastPurchase = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ message: "Customer id required" });
        }

        const lastSale = await Sales.findOne({ customer: id, storeId: req.storeId })
            .sort({ created_at: -1 })
            .populate("items.product_id")
            .lean();

        if (!lastSale) {
            return res.status(200).json({ data: null });
        }

        return res.status(200).json({
            data: lastSale,
        });

    } catch (error) {
        console.error("Last purchase error:", error);
        return res.status(500).json({ message: error.message });
    }
};


const getCustomerCredit = async (req, res) => {
    try {
        const { id } = req.params;

        const customer = await Customer.findOne({ _id: id, storeId: req.storeId }).select("credit_balance name");

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found",
            });
        }

        return res.status(200).json({
            success: true,
            customer_id: customer._id,
            customer_name: customer.name,
            customer_credit_balance: customer.credit_balance || 0,
        });

    } catch (error) {
        console.error("Error fetching customer credit:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while fetching customer credit",
        });
    }
};

const payCustomerDue = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount_paid } = req.body;

        const paidAmount = Number(amount_paid);

        if (isNaN(paidAmount) || paidAmount <= 0) {
            return res.status(400).json({
                message: "Invalid payment amount"
            });
        }

        const customer = await Customer.findOne({ _id: id, storeId: req.storeId });

        if (!customer) {
            return res.status(404).json({
                message: "Customer not found"
            });
        }

        // Deduct from credit balance
        customer.credit_balance = Math.max(0, (customer.credit_balance || 0) - paidAmount);
        await customer.save();

        return res.status(200).json({
            message: "Payment recorded successfully",
            new_balance: customer.credit_balance
        });

    } catch (error) {
        console.error("Pay customer due error:", error);
        return res.status(500).json({
            message: error.message
        });
    }
};

export {
    createCustomer,
    getAllCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
    searchCustomer,
    getCustomerLastPurchase,
    getCustomerCredit,
    payCustomerDue
};