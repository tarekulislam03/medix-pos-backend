import { Router } from "express";
import multer from "multer";
import { createProduct, deleteProduct, getProductById, getProducts, searchProduct, updateProduct, soonToExpiry, lowStock, autoImportProducts, autoImportConfirm, getLooseMedicinePrice } from "../controllers/productController.js"

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
  limits: { fileSize: 5 * 1024 * 1024 }
});


productRouter.post(
  "/auto-import",
  upload.single("bill"),
  autoImportProducts
);

productRouter.post(
  "/auto-import/confirm",
  autoImportConfirm
);

export default productRouter;