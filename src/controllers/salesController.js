import Sales from "../models/salesModel.js";
import mongoose from "mongoose";
import Inventory from "../models/productModel.js";
import Customer from "../models/customerModel.js";

const todaySales = async (req, res) => {
    try {

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const result = await Sales.aggregate([
            {
                $match: {
                    storeId: new mongoose.Types.ObjectId(String(req.storeId)),
                    created_at: {
                        $gte: startOfDay,
                        $lte: endOfDay
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    total_sales: { $sum: "$grand_total" }
                }
            }
        ]);

        return res.status(200).json({
            data: result[0] || {
                total_sales: 0
            }
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
};

const monthlySales = async (req, res) => {
    try {

        const now = new Date();

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0,
            23, 59, 59, 999
        );
        const result = await Sales.aggregate([
            {
                $match: {
                    storeId: new mongoose.Types.ObjectId(String(req.storeId)),
                    created_at: {
                        $gte: startOfMonth,
                        $lte: endOfMonth
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    total_sales: { $sum: "$grand_total" }
                }
            }
        ]);

        return res.status(200).json({
            data: result[0] || {
                total_sales: 0,
            }
        });

    } catch (error) {
        res.status(500).json({
            message: "Internal Server Error"
        })
    }
}

const getSalesHistory = async (req, res) => {
    try {
        const { page = 1, limit = 20, startDate, endDate } = req.query;

        const match = { storeId: req.storeId };

        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);

            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            match.created_at = {
                $gte: start,
                $lte: end
            };
        }

        const pageNumber = Number(page) || 1;
        const limitNumber = Number(limit) || 20;

        const sales = await Sales.find(match)
            .populate("customer") // Optionally populate customer if available
            .sort({ created_at: -1 })
            .skip((pageNumber - 1) * limitNumber)
            .limit(limitNumber);

        const totalSales = await Sales.countDocuments(match);

        res.status(200).json({
            success: true,
            total: totalSales,
            page: pageNumber,
            pages: Math.ceil(totalSales / limitNumber),
            data: sales
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch sales history"
        });
    }
};

const getSaleById = async (req, res) => {
    try {
        const { id } = req.params;
        const sale = await Sales.findOne({ _id: id, storeId: req.storeId }).populate("customer");

        if (!sale) {
            return res.status(404).json({ success: false, message: "Sale not found" });
        }

        res.status(200).json({ success: true, data: sale });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to fetch sale details" });
    }
};

const updateSaleById = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            customer_id,
            customer_name_fallback,
            items,
            payment_method,
            amount_paid = 0,
            previous_due_payment = 0
        } = req.body;

        const previousDuePayment = Number(previous_due_payment);
        if (isNaN(previousDuePayment) || previousDuePayment < 0) {
            return res.status(400).json({ success: false, message: "Invalid previous due payment" });
        }

        const existingSale = await Sales.findOne({ _id: id, storeId: req.storeId });
        if (!existingSale) {
            return res.status(404).json({ success: false, message: "Sale not found" });
        }

        // Basic Validations        
        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }

        if (!payment_method) {
            return res.status(400).json({ success: false, message: "Payment method is required" });
        }

        const paidAmount = Number(amount_paid);

        if (isNaN(paidAmount) || paidAmount < 0) {
            return res.status(400).json({ success: false, message: "Invalid amount paid" });
        }

        let customer = null;
        if (customer_id) {
            customer = await Customer.findOne({ _id: customer_id, storeId: req.storeId });
            if (!customer) {
                return res.status(404).json({ success: false, message: "Customer not found" });
            }
        }

        // --- REVERT OLD SALE ---
        // 1. Revert Inventory for old items
        for (const oldItem of existingSale.items) {
            const product = await Inventory.findOne({ _id: oldItem.product_id, storeId: req.storeId });
            if (product) {
                product.quantity += oldItem.quantity;
                await product.save();
            }
        }

        // 2. Revert Customer Credit Balance
        if (existingSale.customer) {
            const oldCustomer = await Customer.findOne({ _id: existingSale.customer, storeId: req.storeId });
            if (oldCustomer && existingSale.due_amount > 0) {
                oldCustomer.credit_balance -= existingSale.due_amount;
                if (oldCustomer.credit_balance < 0) oldCustomer.credit_balance = 0;
                await oldCustomer.save();
            }
        }

        // --- BUILD NEW SALE ---
        let subtotal = 0;
        let total_discount = 0;
        const saleItems = [];

        for (const item of items) {
            const product = await Inventory.findOne({ _id: item.product_id, storeId: req.storeId });

            if (!product) {
                // Return stock since we modified it above
                for (const oldItem of existingSale.items) {
                    const prod = await Inventory.findOne({ _id: oldItem.product_id, storeId: req.storeId });
                    if (prod) { prod.quantity -= oldItem.quantity; await prod.save(); }
                }
                return res.status(404).json({ success: false, message: "Product not found" });
            }

            if (product.quantity < item.quantity) {
                 for (const oldItem of existingSale.items) {
                    const prod = await Inventory.findOne({ _id: oldItem.product_id, storeId: req.storeId });
                    if (prod) { prod.quantity -= oldItem.quantity; await prod.save(); }
                }
                return res.status(400).json({ success: false, message: `Insufficient stock for ${product.medicine_name}` });
            }

            const discountPercent = Number(item.discount_percent || 0);

            if (discountPercent < 0 || discountPercent > 100) {
                 for (const oldItem of existingSale.items) {
                    const prod = await Inventory.findOne({ _id: oldItem.product_id, storeId: req.storeId });
                    if (prod) { prod.quantity -= oldItem.quantity; await prod.save(); }
                }
                return res.status(400).json({ success: false, message: "Discount must be between 0 and 100" });
            }

            const itemSubtotal = product.mrp * item.quantity;
            const discountAmount = Number(((itemSubtotal * discountPercent) / 100).toFixed(2));
            const itemTotal = Number((itemSubtotal - discountAmount).toFixed(2));

            subtotal += itemSubtotal;
            total_discount += discountAmount;

            saleItems.push({
                product_id: product._id,
                medicine_name: product.medicine_name,
                barcode: product.barcode,
                mrp: product.mrp,
                quantity: item.quantity,
                discount_percent: discountPercent,
                discount_amount: discountAmount,
                total: itemTotal
            });

            // Deduct stock
            product.quantity -= item.quantity;
            await product.save();
        }

        subtotal = Number(subtotal.toFixed(2));
        total_discount = Number(total_discount.toFixed(2));
        const grandTotal = Number((subtotal - total_discount).toFixed(2));

        const remainingForBill = paidAmount - previousDuePayment;
        let dueAmount = Number((grandTotal - remainingForBill).toFixed(2));
        if (dueAmount < 0) {
            dueAmount = 0;
        }

        // Update Sale Document
        existingSale.customer = customer ? customer._id : null;
        if (customer) {
            existingSale.customer_name = customer.name;
            existingSale.customer_phone = customer.phone_no;
        } else {
            existingSale.customer_name = customer_name_fallback || null;
            existingSale.customer_phone = null;
        }
        existingSale.items = saleItems;
        existingSale.subtotal = subtotal;
        existingSale.total_discount = total_discount;
        existingSale.grand_total = grandTotal;
        existingSale.amount_paid = paidAmount;
        existingSale.previous_due_payment = previousDuePayment;
        existingSale.due_amount = dueAmount;
        existingSale.payment_method = payment_method;

        await existingSale.save();

        // Update New Customer Credit
        if (customer) {
           customer.credit_balance -= previousDuePayment;
           if (dueAmount > 0) customer.credit_balance += dueAmount;
           if (customer.credit_balance < 0) customer.credit_balance = 0;
           await customer.save();
        }

        return res.status(200).json({
            success: true,
            message: "Bill updated successfully",
            data: existingSale,
            due_amount: dueAmount,
            customer_credit_balance: customer ? customer.credit_balance : null
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to update sale" });
    }
};

export { todaySales, monthlySales, getSalesHistory, getSaleById, updateSaleById };