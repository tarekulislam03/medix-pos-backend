import Sales from "../models/salesModel.js";
import mongoose from "mongoose";
import Inventory from "../../product/models/productModel.js";
import Customer from "../../customer/models/customerModel.js";

// get todays sales total
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
                    total_sales: { $sum: "$grand_total" },
                    total_orders: { $sum: 1 }
                }
            }
        ]);

        return res.status(200).json({
            data: result[0] || {
                total_sales: 0,
                total_orders: 0
            }
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
};

// get monthly sales total
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
                    total_sales: { $sum: "$grand_total" },
                    total_profit: { $sum: "$total_profit" }
                }
            }
        ]);

        return res.status(200).json({
            data: result[0] || {
                total_sales: 0,
                total_profit: 0
            }
        });

    } catch (error) {
        res.status(500).json({
            message: "Internal Server Error"
        })
    }
}

// get sales history
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

// get sale details by id
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

// update sale by id
const updateSaleById = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const {
            customer_id,
            customer_name_fallback,
            items,
            payment_method,
            amount_paid = 0,
            previous_due_payment = 0,
            doctor_fee = 0,
            otc_items = []
        } = req.body;

        const previousDuePayment = Number(previous_due_payment);
        if (isNaN(previousDuePayment) || previousDuePayment < 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: "Invalid previous due payment" });
        }

        const existingSale = await Sales.findOne({ _id: id, storeId: req.storeId }).session(session);
        if (!existingSale) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: "Sale not found" });
        }

        // Basic Validations        
        if (!items || items.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }

        if (!payment_method) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: "Payment method is required" });
        }

        const paidAmount = Number(amount_paid);

        if (isNaN(paidAmount) || paidAmount < 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: "Invalid amount paid" });
        }

        let customer = null;
        if (customer_id) {
            customer = await Customer.findOne({ _id: customer_id, storeId: req.storeId }).session(session);
            if (!customer) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({ success: false, message: "Customer not found" });
            }
        }

        
        // Revert Inventory for old items atomically
        const revertOps = [];
        for (const oldItem of existingSale.items) {
            const oldPid = oldItem.product_id ? String(oldItem.product_id) : '';
            if (oldPid && oldPid.length === 24 && !oldPid.startsWith('manual_')) {
                revertOps.push({
                    updateOne: {
                        filter: { _id: oldPid, storeId: req.storeId },
                        update: { $inc: { quantity: oldItem.quantity } }
                    }
                });
            }
        }
        if (revertOps.length > 0) {
            await Inventory.bulkWrite(revertOps, { session });
        }

        // Revert Customer Credit Balance
        if (existingSale.customer) {
            const oldCustomer = await Customer.findOne({ _id: existingSale.customer, storeId: req.storeId }).session(session);
            if (oldCustomer && existingSale.due_amount > 0) {
                oldCustomer.credit_balance -= existingSale.due_amount;
                if (oldCustomer.credit_balance < 0) oldCustomer.credit_balance = 0;
                await oldCustomer.save({ session });
            }
        }

        // creating new sales
        let subtotal = 0;
        let total_discount = 0;
        let total_profit = 0;
        let total_taxable = 0;
        let total_cgst = 0;
        let total_sgst = 0;
        const saleItems = [];
        const deductOps = [];

        // Load current state of requested items
        const productIds = items.map(item => item.product_id).filter(id => id && id.length === 24 && !id.startsWith('manual_'));
        const products = await Inventory.find({ _id: { $in: productIds }, storeId: req.storeId }).session(session).lean();
        const productMap = new Map(products.map(p => [String(p._id), p]));

        for (const item of items) {
            let product = null;
            const pid = item.product_id ? String(item.product_id) : '';
            const itemQty = Number(item.quantity) || 0;

            if (pid && pid.length === 24 && !pid.startsWith('manual_')) {
                product = productMap.get(pid);
            }

            // If product is not found (e.g., manual item or deleted item), use item data as fallback
            if (!product) {
                const fallbackId = (pid && pid.length === 24) ? pid : new mongoose.Types.ObjectId();
                product = {
                    _id: fallbackId,
                    medicine_name: item.medicine_name || 'Unknown Item',
                    mrp: Number(item.mrp || 0),
                    cost_price: 0,
                    quantity: 99999,
                    barcode: '',
                    gst: item.gst_percent || 0,
                    hsn_code: '',
                    _isManual: true
                };
            }

            // Note: Since we bulk incremented earlier in the same transaction, product.quantity here does NOT reflect the reverted stock if it was an old item.
            // But the database bulkWrite atomic lock below WILL account for it safely.
            const discountPercent = Number(item.discount_percent || 0);

            if (discountPercent < 0 || discountPercent > 100) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ success: false, message: "Discount must be between 0 and 100" });
            }

            let itemSubtotal = 0;
            if (item.is_loose_sale) {
                itemSubtotal = Number(item.loose_total_price || 0);
            } else {
                itemSubtotal = product.mrp * itemQty;
            }
            const discountAmount = Number(((itemSubtotal * discountPercent) / 100).toFixed(2));
            const itemTotal = Number((itemSubtotal - discountAmount).toFixed(2));

            // GST calculation
            const gstPercent = Number(product.gst ?? 0);
            let taxableAmount = itemTotal;
            let cgstAmount = 0;
            let sgstAmount = 0;

            if (gstPercent < 0 || gstPercent > 28) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ message: "Invalid GST percentage" });
            }

            if (gstPercent > 0) {
                const totalGst = Number(((itemTotal * gstPercent) / (100 + gstPercent)).toFixed(2));
                taxableAmount = Number((itemTotal - totalGst).toFixed(2));
                cgstAmount = Number((totalGst / 2).toFixed(2));
                sgstAmount = Number((totalGst - cgstAmount).toFixed(2));
            }

            subtotal += itemSubtotal;
            total_discount += discountAmount;
            
            const itemCostPrice = Number(product.cost_price || product.mrp || 0);
            const itemProfit = itemTotal - (itemCostPrice * itemQty);
            total_profit += itemProfit;
            
            total_taxable += taxableAmount;
            total_cgst += cgstAmount;
            total_sgst += sgstAmount;

            saleItems.push({
                product_id: product._id,
                medicine_name: product.medicine_name,
                barcode: product.barcode || '',
                mrp: product.mrp,
                cost_price: itemCostPrice,
                quantity: itemQty,
                discount_percent: discountPercent,
                discount_amount: discountAmount,
                total: itemTotal,
                gst_percent: gstPercent,
                taxable_amount: taxableAmount,
                cgst_amount: cgstAmount,
                sgst_amount: sgstAmount
            });

            // Deduct stock only for real inventory products, ATOMICALLY
            if (!product._isManual) {
                deductOps.push({
                    updateOne: {
                        filter: {
                            _id: product._id,
                            storeId: req.storeId,
                            quantity: { $gte: itemQty } // Strict atomic lock
                        },
                        update: { $inc: { quantity: -itemQty } }
                    }
                });
            }
        }

        // Apply Deductions Atomically
        if (deductOps.length > 0) {
            const bulkResult = await Inventory.bulkWrite(deductOps, { session });
            if (bulkResult.modifiedCount !== deductOps.length) {
                await session.abortTransaction();
                session.endSession();
                return res.status(409).json({ success: false, message: "Insufficient stock or concurrent checkout detected for one or more items." });
            }
        }

        subtotal = Number(subtotal.toFixed(2));
        total_discount = Number(total_discount.toFixed(2));
        total_taxable = Number(total_taxable.toFixed(2));
        total_cgst = Number(total_cgst.toFixed(2));
        total_sgst = Number(total_sgst.toFixed(2));

        const medicineTotalAfterDiscount = Number((subtotal - total_discount).toFixed(2));

        // Doctor fee
        const doctorFee = Number(Number(doctor_fee || 0).toFixed(2));
        if (isNaN(doctorFee) || doctorFee < 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: "Invalid doctor fee" });
        }

        // OTC items
        const otcList = Array.isArray(otc_items) ? otc_items : [];
        let otcTotal = 0;
        const sanitizedOtcItems = [];
        for (const otcItem of otcList) {
            const price = Number(otcItem.price || 0);
            if (!otcItem.name || isNaN(price) || price < 0) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ success: false, message: `Invalid OTC item: ${otcItem.name || 'unknown'}` });
            }
            otcTotal += price;
            sanitizedOtcItems.push({ name: String(otcItem.name).trim(), price: Number(price.toFixed(2)) });
        }
        otcTotal = Number(otcTotal.toFixed(2));

        const grandTotal = Number((medicineTotalAfterDiscount + doctorFee + otcTotal).toFixed(2));
        const remainingForBill = paidAmount - previousDuePayment;
        let dueAmount = Number((grandTotal - remainingForBill).toFixed(2));
        if (dueAmount < 0) dueAmount = 0;

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
        existingSale.total_profit = Number(total_profit.toFixed(2));
        existingSale.total_taxable = total_taxable;
        existingSale.total_cgst = total_cgst;
        existingSale.total_sgst = total_sgst;
        existingSale.doctor_fee = doctorFee;
        existingSale.otc_items = sanitizedOtcItems;
        existingSale.otc_total = otcTotal;
        existingSale.grand_total = grandTotal;
        existingSale.amount_paid = paidAmount;
        existingSale.previous_due_payment = previousDuePayment;
        existingSale.due_amount = dueAmount;
        existingSale.payment_method = payment_method;

        await existingSale.save({ session });

        // Update New Customer Credit
        if (customer) {
           customer.credit_balance -= previousDuePayment;
           if (dueAmount > 0) customer.credit_balance += dueAmount;
           if (customer.credit_balance < 0) customer.credit_balance = 0;
           await customer.save({ session });
        }

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            success: true,
            message: "Bill updated successfully",
            data: existingSale,
            due_amount: dueAmount,
            customer_credit_balance: customer ? customer.credit_balance : null
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('updateSaleById error:', error.message, error.stack);
        res.status(500).json({ success: false, message: "Failed to update sale", error: error.message });
    }
};

// search sale by invoice number
const searchSaleByInvoice = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || !q.trim()) {
            return res.status(400).json({ success: false, message: "Search query is required" });
        }

        const escapedQuery = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const sales = await Sales.find({
            storeId: req.storeId,
            invoice_number: { $regex: escapedQuery, $options: 'i' }
        })
            .populate("customer")
            .sort({ created_at: -1 })
            .limit(10);

        return res.status(200).json({ success: true, data: sales });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to search invoices" });
    }
};

// delete sales by id
const deleteSaleById = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;

        const sale = await Sales.findOne({ _id: id, storeId: req.storeId }).session(session);
        if (!sale) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: "Sale not found" });
        }

        // restore stock for each item sold atomically
        const revertOps = [];
        for (const item of sale.items) {
            const pid = item.product_id ? String(item.product_id) : '';
            if (pid && pid.length === 24 && !pid.startsWith('manual_')) {
                revertOps.push({
                    updateOne: {
                        filter: { _id: pid, storeId: req.storeId },
                        update: { $inc: { quantity: item.quantity } }
                    }
                });
            }
        }
        if (revertOps.length > 0) {
            await Inventory.bulkWrite(revertOps, { session });
        }

        // Revert Customer Credit Balance
        if (sale.customer && sale.due_amount > 0) {
            const customer = await Customer.findOne({ _id: sale.customer, storeId: req.storeId }).session(session);
            if (customer) {
                customer.credit_balance -= sale.due_amount;
                if (customer.credit_balance < 0) customer.credit_balance = 0;
                await customer.save({ session });
            }
        }

        // Delete the sale document
        await Sales.deleteOne({ _id: id, storeId: req.storeId }, { session });

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            success: true,
            message: "Sale deleted successfully"
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('deleteSaleById error:', error);
        res.status(500).json({ success: false, message: "Failed to delete sale" });
    }
};

const getAnalyticsOverview = async (req, res) => {
    try {
        const match = { storeId: req.storeId };
        
        // Fetch only necessary fields to minimize payload
        const sales = await Sales.find(match)
            .select('created_at createdAt date grand_total total profit total_profit')
            .lean();
            
        const dMap = {};
        const mMap = {};
        const pMap = {};
        const dProfitMap = {};
        
        sales.forEach(sale => {
            const d = new Date(sale.created_at || sale.createdAt || sale.date || new Date());
            const dStr = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
            const mStr = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0')].join('-');
            const val = Number(sale.grand_total || sale.total || 0);
            const profit = Number(sale.profit || sale.total_profit || 0);
            
            dMap[dStr] = (dMap[dStr] || 0) + val;
            mMap[mStr] = (mMap[mStr] || 0) + val;
            pMap[mStr] = (pMap[mStr] || 0) + profit;
            dProfitMap[dStr] = (dProfitMap[dStr] || 0) + profit;
        });
        
        const dailyData = Object.entries(dMap).map(([k, v]) => ({ date: k, total: v })).sort((a, b) => b.date.localeCompare(a.date));
        const dailyProfitData = Object.entries(dProfitMap).map(([k, v]) => ({ date: k, profit: v })).sort((a, b) => b.date.localeCompare(a.date));
        
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthlyData = Object.entries(mMap)
            .map(([k, v]) => {
                const [y, m] = k.split('-');
                return { monthId: k, month: `${monthNames[parseInt(m) - 1]} ${y}`, total: v };
            })
            .sort((a, b) => b.monthId.localeCompare(a.monthId));
        const monthlyProfitData = Object.entries(pMap)
            .map(([k, v]) => {
                const [y, m] = k.split('-');
                return { monthId: k, month: `${monthNames[parseInt(m) - 1]} ${y}`, profit: v };
            })
            .sort((a, b) => b.monthId.localeCompare(a.monthId));
            
        return res.status(200).json({
            dailyData,
            monthlyData,
            dailyProfitData,
            monthlyProfitData
        });
    } catch (error) {
        return res.status(500).json({ message: "Failed to generate analytics", error: error.message });
    }
};

export { todaySales, monthlySales, getSalesHistory, getSaleById, updateSaleById, deleteSaleById, searchSaleByInvoice, getAnalyticsOverview };