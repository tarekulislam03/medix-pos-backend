import axios from "axios";
import FormData from "form-data";
import Purchase from "../models/purchaseModel.js";
import Inventory from "../models/productModel.js";

// ── Shared Cloudinary uploader ─────────────────────────────────────────────
// Exported so productController can reuse it without duplication.
export const uploadToCloudinary = async (fileBuffer, originalName, mimeType) => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey    = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error("Cloudinary credentials are not configured in .env");
    }

    const url  = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const form = new FormData();

    form.append("file", fileBuffer, {
        filename:    originalName || "purchase_bill.jpg",
        contentType: mimeType     || "image/jpeg",
    });
    form.append("upload_preset", process.env.CLOUDINARY_UPLOAD_PRESET || "medix_bills");
    form.append("folder", "medix/purchase_bills");

    const response = await axios.post(url, form, {
        headers: {
            ...form.getHeaders(),
            Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`,
        },
        maxBodyLength: Infinity,
    });

    return {
        secure_url: response.data.secure_url,
        public_id:  response.data.public_id,
    };
};

// ── POST /api/v1/purchase/upload-bill ─────────────────────────────────────
// Manual upload from the Purchase page.
const uploadBill = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No bill image provided" });
        }

        const { secure_url, public_id } = await uploadToCloudinary(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
        );

        const purchase = await Purchase.create({
            storeId:              req.storeId,
            bill_image_url:       secure_url,
            cloudinary_public_id: public_id,
            supplier_name:        req.body.supplier_name  || "",
            notes:                req.body.notes          || "",
            total_amount:         Number(req.body.total_amount) || 0,
            source:               "manual",
            status:               "received",
        });

        return res.status(201).json({
            success: true,
            message: "Bill uploaded successfully",
            data:    purchase,
        });
    } catch (error) {
        console.error("Upload Bill Error:", error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ── PATCH /api/v1/purchase/:id/finalize ───────────────────────────────────
// Called after the user confirms the auto-import review.
// Marks the Purchase record as received and fills in aggregated metadata.
const finalizePurchase = async (req, res) => {
    try {
        const { id } = req.params;
        const { supplier_name, total_amount, items_count, imported_items } = req.body;

        const purchase = await Purchase.findOneAndUpdate(
            { _id: id, storeId: req.storeId },
            {
                $set: {
                    status:         "received",
                    supplier_name:  supplier_name  || "",
                    total_amount:   Number(total_amount)  || 0,
                    items_count:    Number(items_count)   || 0,
                    imported_items: imported_items || [],
                },
            },
            { returnDocument: "after" }
        );

        if (!purchase) {
            return res.status(404).json({ success: false, message: "Purchase record not found" });
        }

        return res.status(200).json({ success: true, data: purchase });
    } catch (error) {
        console.error("Finalize Purchase Error:", error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ── GET /api/v1/purchase/ ─────────────────────────────────────────────────
const getPurchases = async (req, res) => {
    try {
        const purchases = await Purchase.find({ storeId: req.storeId }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: purchases });
    } catch (error) {
        console.error("Get Purchases Error:", error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ── DELETE /api/v1/purchase/:id ───────────────────────────────────────────
const deletePurchase = async (req, res) => {
    try {
        const purchase = await Purchase.findOneAndDelete({ _id: req.params.id, storeId: req.storeId });
        if (!purchase) {
            return res.status(404).json({ success: false, message: "Purchase not found" });
        }
        return res.status(200).json({ success: true, message: "Purchase deleted" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getNextShortBarcode = async (storeId) => {
    // Generate 8-digit random number
    return Math.floor(10000000 + Math.random() * 90000000).toString();
};

const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const createManualPurchase = async (req, res) => {
    try {
        const { 
            supplier_name,
            supplier_gstin,
            bill_no, 
            bill_date, 
            items, 
            taxable_amount, 
            cgst_amount,
            sgst_amount,
            total_amount,
            notes,
            storeId
        } = req.body;

        const storeIdToUse = storeId || req.storeId;

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: "Purchase must contain at least one item." });
        }

        const imported_items = [];
        
        for (let item of items) {
            const normalizedName = (item.medicine_name || "").trim().toUpperCase();
            if (!normalizedName) continue;
            
            const cleanNumber = (val) => Number(String(val || 0).replace(/[^\d.]/g, "")) || 0;
            const batchNum = item.batch_number || "";
            
            // Format expiry_date to last day of the month if it's YYYY-MM or MM/YY
            let exp = item.expiry_date;
            if (exp && typeof exp === 'string') {
                if (/^\d{4}-\d{2}$/.test(exp)) {
                    // YYYY-MM
                    const [year, month] = exp.split('-');
                    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
                    item.expiry_date = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
                } else if (/^\d{2}\/\d{2}$/.test(exp)) {
                    // MM/YY
                    const [month, yy] = exp.split('/');
                    const year = `20${yy}`;
                    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
                    item.expiry_date = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
                }
            }
            
            let product = await Inventory.findOne({
                storeId: storeIdToUse,
                medicine_name: {
                    $regex: new RegExp(`^${escapeRegExp(normalizedName)}$`, "i")
                },
                batch_number: batchNum
            });

            let rateAmount = cleanNumber(item.rate);
            let discountPercent = cleanNumber(item.discount);
            let costPriceAfterDiscount = rateAmount - (rateAmount * (discountPercent / 100));

            if (product) {
                // Update existing batch (forces overwrite of MRP/Expiry)
                product.quantity += cleanNumber(item.quantity);
                product.mrp = cleanNumber(item.mrp);
                product.supplier_name = supplier_name || product.supplier_name;
                if (item.expiry_date) product.expiry_date = item.expiry_date;
                if (item.rate !== undefined) product.cost_price = costPriceAfterDiscount;
                if (item.hsn_code) product.hsn_code = item.hsn_code;
                if (item.gst !== undefined) product.gst = cleanNumber(item.gst);
                
                await product.save();
                
                imported_items.push({
                    inventoryId: product._id,
                    quantity: cleanNumber(item.quantity),
                    mrp: cleanNumber(item.mrp)
                });
            } else {
                // Create new inventory
                const short_barcode = await getNextShortBarcode(storeIdToUse);
                const newProduct = await Inventory.create({
                    medicine_name: normalizedName,
                    mrp: cleanNumber(item.mrp),
                    quantity: cleanNumber(item.quantity),
                    cost_price: item.rate !== undefined ? costPriceAfterDiscount : null,
                    supplier_name: supplier_name || "",
                    expiry_date: item.expiry_date || null,
                    batch_number: batchNum,
                    hsn_code: item.hsn_code || "",
                    gst: item.gst ? cleanNumber(item.gst) : 0,
                    short_barcode: short_barcode,
                    storeId: storeIdToUse
                });
                
                imported_items.push({
                    inventoryId: newProduct._id,
                    quantity: cleanNumber(item.quantity),
                    mrp: cleanNumber(item.mrp)
                });
            }
        }

        const purchase = await Purchase.create({
            storeId: storeIdToUse,
            supplier_name: supplier_name || "",
            supplier_gstin: supplier_gstin || "",
            bill_no: bill_no || "",
            bill_date: bill_date || "",
            notes: notes || "",
            taxable_amount: Number(taxable_amount) || 0,
            cgst_amount: Number(cgst_amount) || 0,
            sgst_amount: Number(sgst_amount) || 0,
            total_amount: Number(total_amount) || 0,
            items_count: items.length,
            imported_items: imported_items,
            source: "manual",
            status: "received"
        });

        return res.status(201).json({
            success: true,
            message: "Manual purchase saved and inventory updated successfully.",
            data: purchase,
        });

    } catch (error) {
        console.error("Create Manual Purchase Error:", error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export { uploadBill, getPurchases, deletePurchase, finalizePurchase, createManualPurchase };
