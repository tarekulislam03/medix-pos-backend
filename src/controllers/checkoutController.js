import Inventory from "../models/productModel.js";
import Sales from "../models/salesModel.js";
import Customer from "../models/customerModel.js";

const checkout = async (req, res) => {
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
            return res.status(400).json({ message: "Cart is empty" });
        }

        if (!payment_method) {
            return res.status(400).json({
                message: "Payment method is required"
            });
        }

        const paidAmount = Number(amount_paid);
        const previousDuePayment = Number(previous_due_payment);

        if (isNaN(paidAmount) || paidAmount < 0) {
            return res.status(400).json({
                message: "Invalid amount paid"
            });
        }

        if (isNaN(previousDuePayment) || previousDuePayment < 0) {
            return res.status(400).json({
                message: "Invalid previous due payment"
            });
        }


        // Customer Validation
        let customer = null;
        let previousCredit = 0;

        if (customer_id) {
            customer = await Customer.findOne({ _id: customer_id, storeId: req.storeId });

            if (!customer) {
                return res.status(404).json({
                    message: "Customer not found"
                });
            }

            previousCredit = Number(customer.credit_balance ?? 0);
        }

        // Cannot pay more previous due than exists
        if (previousDuePayment > previousCredit) {
            return res.status(400).json({
                message: "Previous due payment exceeds credit balance"
            });
        }

        // Cannot allocate more previous due than total paid
        if (previousDuePayment > paidAmount) {
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
        const saleItems = [];

        for (const item of items) {
            const product = await Inventory.findOne({ _id: item.product_id, storeId: req.storeId });

            // Basic Validation for each item
            if (!product) {
                return res.status(404).json({
                    message: "Product not found"
                });
            }

            // Stock aviailability check
            if (product.quantity < item.quantity) {
                return res.status(400).json({
                    message: `Insufficient stock for ${product.medicine_name}`
                });
            }

            const discountPercent = Number(item.discount_percent ?? 0);

            if (discountPercent < 0 || discountPercent > 100) {
                return res.status(400).json({
                    message: "Discount must be between 0 and 100"
                });
            }

            const itemSubtotal = product.mrp * item.quantity;

            const discountAmount = Number(
                ((itemSubtotal * discountPercent) / 100).toFixed(2)
            );

            const itemTotal = Number(
                (itemSubtotal - discountAmount).toFixed(2)
            );

            // GST Calculations
            const gstPercent = Number(product.gst ?? 0);
            let taxableAmount = itemTotal; // when GST is 0
            let cgstAmount = 0;
            let sgstAmount = 0;

            // Validation
            if (gstPercent < 0 || gstPercent > 28) {
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
            
            const itemCostPrice = Number(product.cost_price || product.mrp || 0);
            const itemProfit = itemTotal - (itemCostPrice * item.quantity);
            total_profit += itemProfit;
            
            total_taxable = total_taxable + taxableAmount;
            total_cgst = total_cgst + cgstAmount;
            total_sgst = total_sgst + sgstAmount;
            const igstAmount = 0;

            saleItems.push({
                product_id: product._id,
                medicine_name: product.medicine_name,
                barcode: product.barcode,
                mrp: product.mrp,
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
                hsn_code: product.hsn_code || ""
            });

            // Deduct stock
            product.quantity -= item.quantity;
            await product.save();
        }

        subtotal = Number(subtotal.toFixed(2));
        total_discount = Number(total_discount.toFixed(2));
        total_taxable = Number(total_taxable.toFixed(2));
        total_cgst = Number(total_cgst.toFixed(2));
        total_sgst = Number(total_sgst.toFixed(2));

        const medicineTotalAfterDiscount = Number((subtotal - total_discount).toFixed(2));

        // Doctor fee — not discounted
        const doctorFee = Number(Number(doctor_fee ?? 0).toFixed(2));
        if (isNaN(doctorFee) || doctorFee < 0) {
            return res.status(400).json({ message: "Invalid doctor fee" });
        }

        // OTC items — not discounted
        const otcList = Array.isArray(otc_items) ? otc_items : [];
        let otcTotal = 0;
        const sanitizedOtcItems = [];
        for (const otcItem of otcList) {
            const price = Number(otcItem.price ?? 0);
            if (!otcItem.name || isNaN(price) || price < 0) {
                return res.status(400).json({ message: `Invalid OTC item: ${otcItem.name || 'unknown'}` });
            }
            otcTotal += price;
            sanitizedOtcItems.push({ name: String(otcItem.name).trim(), price: Number(price.toFixed(2)) });
        }
        otcTotal = Number(otcTotal.toFixed(2));

        const grandTotal = Number((medicineTotalAfterDiscount + doctorFee + otcTotal).toFixed(2));

        const remainingForBill = grandTotal - paidAmount;

        let dueAmount = Number(
            (remainingForBill + previousDuePayment).toFixed(2)
        );

        // Prevent negative due
        if (dueAmount < 0) {
            dueAmount = 0;
        }

        const invoiceNumber = `INV-${Date.now()}`;

        // Create Sale
        const sale = await Sales.create({
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


        // Update Customer Credit
        if (customer) {
            // Remove paid previous due
            customer.credit_balance -= previousDuePayment;
            // Add new due
            if (dueAmount > 0) {
                customer.credit_balance += dueAmount;
            }
            // Prevent negative balance edge case
            if (customer.credit_balance < 0) {
                customer.credit_balance = 0;
            }

            await customer.save();
        }

        return res.status(200).json({
            message:
                dueAmount > 0
                    ? "Billing successful. Due recorded."
                    : "Billing successful",
            invoice: sale,
            due_amount: dueAmount,
            customer_credit_balance: customer
                ? customer.credit_balance
                : null
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};

export { checkout };