import { Router } from "express";
import multer from "multer";
import path from "path";
import { uploadBill, getAutoImportBills, getPurchases, deletePurchase, finalizePurchase, createManualPurchase, savePurchaseJson } from "../controllers/purchaseController.js";

const purchaseRouter = Router();

// multer — memory storage, 10 MB limit
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
    console.log("Name:", file.originalname);
    console.log("Mime:", file.mimetype);

    const allowed = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "image/heif",
        "image/heic-sequence",
        "image/heif-sequence",
        "application/pdf",
        "application/octet-stream",
    ];
    const allowedExtensions = [
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".heic",
        ".heif",
        ".pdf",
    ];

    const ext = path.extname(file.originalname).toLowerCase();

    if (
        allowed.includes(file.mimetype) &&
        allowedExtensions.includes(ext)
    ) {
        return cb(null, true);
    }

    return cb(new Error(`Unsupported file type: ${file.mimetype}`));
},
});

purchaseRouter.post("/manual", createManualPurchase);
purchaseRouter.post("/upload-bill", upload.single("bill"), uploadBill);
purchaseRouter.get("/admin/auto-import", getAutoImportBills);
purchaseRouter.get("/", getPurchases);
purchaseRouter.patch("/:id/finalize", finalizePurchase);
purchaseRouter.patch("/:id/save-json", savePurchaseJson);
purchaseRouter.delete("/:id", deletePurchase);

export default purchaseRouter;
