import mongoose from "mongoose";
import Inventory from "../models/productModel.js";
import Sales from "../models/salesModel.js";
import Customer from "../models/customerModel.js";
import StockMovement from "../models/stockMovementModel.js";

const checkout = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            customer_id,
            items,
            payment_method,
            amount_paid = 0,
            previous_due_payment = 0,
            doctor_fee = 0,
            otc_items = []
        } = req.body;


        // Basic Validations        
        if (!items || items.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Cart is empty" });
        }

        if (!payment_method) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                message: "Payment method is required"
            });
        }

        const paidAmount = Number(amount_paid);
        const previousDuePayment = Number(previous_due_payment);

        if (isNaN(paidAmount) || paidAmount < 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                message: "Invalid amount paid"
            });
        }

        if (isNaN(previousDuePayment) || previousDuePayment < 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                message: "Invalid previous due payment"
            });
        }

        // Customer Validation
        let customer = null;
        let previousCredit = 0;

        if (customer_id) {
            customer = await Customer.findOne({ _id: customer_id, storeId: req.storeId }).session(session);

            if (!customer) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({
                    message: "Customer not found"
                });
            }

            previousCredit = Number(customer.credit_balance ?? 0);
        }

        // Cannot pay more previous due than exists
        if (previousDuePayment > previousCredit) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                message: "Previous due payment exceeds credit balance"
            });
        }

        // Cannot allocate more previous due than total paid
        if (previousDuePayment > paidAmount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                message: "Previous due payment cannot exceed total paid amount"
            });
        }


        // Process Items
        let subtotal = 0;
        let total_discount = 0;
        let total_profit = 0;
        let total_taxable = 0;
        let total_cgst = 0;
        let total_sgst = 0;
        const stockOperations = [];
        const saleItems = [];

        // Frontend sends product_id which maps to Inventory _id
        const productIds = items.map(item => item.product_id);

        const inventoryItems = await Inventory.find({
            _id: { $in: productIds },
            storeId: req.storeId
        }).session(session).lean();

        const inventoryMap = new Map(
            inventoryItems.map(i => [String(i._id), i])
        );

        for (const item of items) {

            let inventoryItem = inventoryMap.get(String(item.product_id));

            // If inventory item is not found, fallback for manual entry
            if (!inventoryItem) {
                inventoryItem = {
                    _id: item.product_id || `manual_${Date.now()}`,
                    mrp: Number(item.mrp || 0),
                    cost_price: 0,
                    quantity: 99999, // infinite for manual
                    medicine_name: item.medicine_name || 'Unknown Item',
                    barcode: '',
                    gst: item.gst_percent || 0,
                    hsn_code: '',
                };
            }

            // Stock availability check (in memory before strict DB check)
            if (inventoryItem.quantity < item.quantity) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    message: `Insufficient stock for ${inventoryItem.medicine_name}`
                });
            }

            const discountPercent = Number(item.discount_percent ?? 0);

            if (discountPercent < 0 || discountPercent > 100) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    message: "Discount must be between 0 and 100"
                });
            }

            let itemSubtotal = 0;
            if (item.is_loose_sale) {
                itemSubtotal = Number(item.loose_total_price || 0);
            } else {
                itemSubtotal = inventoryItem.mrp * item.quantity;
            }

            const discountAmount = Number(
                ((itemSubtotal * discountPercent) / 100).toFixed(2)
            );

            const itemTotal = Number(
                (itemSubtotal - discountAmount).toFixed(2)
            );

            // GST Calculations
            const gstPercent = Number(inventoryItem.gst ?? 0);
            let taxableAmount = itemTotal; // when GST is 0
            let cgstAmount = 0;
            let sgstAmount = 0;

            // Validation
            if (gstPercent < 0 || gstPercent > 28) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    message: "Invalid GST percentage"
                });
            }

            // Calculation
            if (gstPercent > 0) {
                const totalGst = Number(((itemTotal * gstPercent) / (100 + gstPercent)).toFixed(2));
                taxableAmount = Number((itemTotal - totalGst).toFixed(2));
                cgstAmount = Number((totalGst / 2).toFixed(2));
                sgstAmount = Number((totalGst - cgstAmount).toFixed(2));
            }

            subtotal = subtotal + itemSubtotal;
            total_discount = total_discount + discountAmount;

            const itemCostPrice = Number(inventoryItem.cost_price || inventoryItem.mrp || 0);
            const itemProfit = itemTotal - (itemCostPrice * item.quantity);
            total_profit += itemProfit;

            total_taxable = total_taxable + taxableAmount;
            total_cgst = total_cgst + cgstAmount;
            total_sgst = total_sgst + sgstAmount;
            const igstAmount = 0;

            saleItems.push({
                product_id: inventoryItem._id, 
                medicine_name: inventoryItem.medicine_name,
                barcode: inventoryItem.barcode,
                mrp: inventoryItem.mrp,
                cost_price: itemCostPrice,
                quantity: item.quantity,
                discount_percent: discountPercent,
                discount_amount: discountAmount,
                total: itemTotal,
                gst_percent: gstPercent,
                taxable_amount: taxableAmount,
                cgst_amount: cgstAmount,
                sgst_amount: sgstAmount,
                igst_amount: igstAmount,
                hsn_code: inventoryItem.hsn_code || "",
                expiry_date: inventoryItem.expiry_date || null
            });

            // Deduct stock only for real inventory items, ATOMICALLY
            if (!String(inventoryItem._id).startsWith('manual_')) {
                stockOperations.push({
                    updateOne: {
                        filter: {
                            _id: inventoryItem._id,
                            storeId: req.storeId,
                            quantity: { $gte: item.quantity } // Strict atomic lock
                        },
                        update: {
                            $inc: {
                                quantity: -item.quantity
                            }
                        }
                    }
                });

                stockOperations.push({
                    insertOne: {
                        document: {
                            storeId: req.storeId,
                            productId: inventoryItem._id,
                            medicine_name: inventoryItem.medicine_name,
                            transaction_type: "SALE",
                            reference_id: null, // We will update this after saving the sale
                            quantity_change: -item.quantity,
                            previous_stock: inventoryItem.quantity,
                            current_stock: inventoryItem.quantity - item.quantity,
                            remarks: "Sold via checkout"
                        }
                    }
                });
            }
        }

        // Apply Stock Operations
        if (stockOperations.length > 0) {
            // Split into updates and inserts to handle bulkWrite correctly for different collections
            const inventoryOps = stockOperations.filter(op => op.updateOne);
            const movementOps = stockOperations.filter(op => op.insertOne).map(op => op.insertOne.document);

            const bulkResult = await Inventory.bulkWrite(inventoryOps, { session });
            if (bulkResult.modifiedCount !== inventoryOps.length) {
                // If the modified count doesn't match the items we tried to deduct, a concurrent transaction stole the stock!
                await session.abortTransaction();
                session.endSession();
                return res.status(409).json({ 
                    message: "Insufficient stock or concurrent checkout detected for one or more items. Please review your cart and try again." 
                });
            }
        }
        
        // Note: As per architecture plan, we no longer delete zero-stock batches.
        // The StockLedger and Batch available_quantity = 0 handles this securely.

        subtotal = Number(subtotal.toFixed(2));
        total_discount = Number(total_discount.toFixed(2));
        total_taxable = Number(total_taxable.toFixed(2));
        total_cgst = Number(total_cgst.toFixed(2));
        total_sgst = Number(total_sgst.toFixed(2));

        const medicineTotalAfterDiscount = Number((subtotal - total_discount).toFixed(2));

        // Doctor fee — not discounted
        const doctorFee = Number(Number(doctor_fee ?? 0).toFixed(2));
        if (isNaN(doctorFee) || doctorFee < 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Invalid doctor fee" });
        }

        // OTC items — not discounted
        const otcList = Array.isArray(otc_items) ? otc_items : [];
        let otcTotal = 0;
        const sanitizedOtcItems = [];
        for (const otcItem of otcList) {
            const price = Number(otcItem.price ?? 0);
            if (!otcItem.name || isNaN(price) || price < 0) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ message: `Invalid OTC item: ${otcItem.name || 'unknown'}` });
            }
            otcTotal += price;
            sanitizedOtcItems.push({ name: String(otcItem.name).trim(), price: Number(price.toFixed(2)) });
        }
        otcTotal = Number(otcTotal.toFixed(2));

        const grandTotal = Number((medicineTotalAfterDiscount + doctorFee + otcTotal).toFixed(2));
        const remainingForBill = grandTotal - paidAmount;
        let dueAmount = Number((remainingForBill + previousDuePayment).toFixed(2));

        // Prevent negative due
        if (dueAmount < 0) {
            dueAmount = 0;
        }

        const invoiceNumber = `INV-${Date.now()}`;

        // Create Sale
        const sale = new Sales({
            invoice_number: invoiceNumber,
            customer: customer ? customer._id : null,
            customer_name: customer ? customer.name : (req.body.customer_name_fallback || null),
            customer_phone: customer ? customer.phone_no : null,
            items: saleItems,
            subtotal,
            total_discount,
            total_profit: Number(total_profit.toFixed(2)),
            total_taxable,
            total_cgst,
            total_sgst,
            doctor_fee: doctorFee,
            otc_items: sanitizedOtcItems,
            otc_total: otcTotal,
            grand_total: grandTotal,
            amount_paid: paidAmount,
            previous_due_payment: previousDuePayment,
            due_amount: dueAmount,
            payment_method,
            storeId: req.storeId
        });
        
        await sale.save({ session });

        // Update reference_id for movement logs and save them
        if (stockOperations.length > 0) {
            const movementOps = stockOperations.filter(op => op.insertOne).map(op => {
                const doc = op.insertOne.document;
                doc.reference_id = sale._id;
                return doc;
            });
            if (movementOps.length > 0) {
                await StockMovement.insertMany(movementOps, { session });
            }
        }

        // Update Customer Credit
        if (customer) {
            customer.credit_balance -= previousDuePayment;
            if (dueAmount > 0) {
                customer.credit_balance += dueAmount;
            }
            if (customer.credit_balance < 0) {
                customer.credit_balance = 0;
            }

            await customer.save({ session });
        }

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            message: dueAmount > 0 ? "Billing successful. Due recorded." : "Billing successful",
            invoice: sale,
            due_amount: dueAmount,
            customer_credit_balance: customer ? customer.credit_balance : null
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({
            message: error.message
        });
    }
};

export { checkout };