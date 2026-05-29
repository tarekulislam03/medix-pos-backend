import axios from "axios";
import FormData from "form-data";
import Purchase from "../models/purchaseModel.js";

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
        const { supplier_name, total_amount, items_count } = req.body;

        const purchase = await Purchase.findOneAndUpdate(
            { _id: id, storeId: req.storeId },
            {
                $set: {
                    status:        "received",
                    supplier_name: supplier_name  || "",
                    total_amount:  Number(total_amount)  || 0,
                    items_count:   Number(items_count)   || 0,
                },
            },
            { new: true }
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

export { uploadBill, getPurchases, deletePurchase, finalizePurchase };
