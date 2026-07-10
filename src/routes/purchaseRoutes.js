import { Router } from "express";
import multer from "multer";
import { uploadBill, getAutoImportBills, getPurchases, deletePurchase, finalizePurchase, createManualPurchase, savePurchaseJson } from "../controllers/purchaseController.js";

const purchaseRouter = Router();

// multer — memory storage, 10 MB limit
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only image files (JPEG, PNG, WEBP, HEIC) and PDF are allowed"));
        }
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
