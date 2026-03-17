import { Router } from "express";
import multer from "multer";
import { createProduct, deleteProduct, getProductById, getProducts, searchProduct, updateProduct, soonToExpiry, lowStock, autoImportProducts, autoImportConfirm, getLooseMedicinePrice } from "../controllers/productController.js"

import { normalizeImage } from "../middleware/imageNormalizationMiddleware.js";

const productRouter = Router();

productRouter.post("/create", createProduct);
productRouter.get("/get", getProducts);
productRouter.get("/get/:id", getProductById);
productRouter.put("/update/:id", updateProduct);
productRouter.delete("/delete/:id", deleteProduct);
productRouter.get("/lowstock", lowStock);
productRouter.get("/soontoexpiry", soonToExpiry);
productRouter.get("/search", searchProduct);
productRouter.get("/loose-price/:id", getLooseMedicinePrice);

// auto import route
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // Increased limit for HEIC files
});


productRouter.post(
  "/auto-import",
  upload.single("bill"),
  normalizeImage,
  autoImportProducts
);

productRouter.post(
  "/normalize-image",
  upload.single("bill"),
  normalizeImage,
  (req, res) => {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }
    res.set("Content-Type", "image/jpeg");
    res.send(req.file.buffer);
  }
);

productRouter.post(
  "/auto-import/confirm",
  autoImportConfirm
);

export default productRouter;