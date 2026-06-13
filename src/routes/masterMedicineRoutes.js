import { Router } from "express";
import multer from "multer";
import { adminProtect } from "../middleware/adminAuthMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";
import {
    adminLogin,
    getMasterMedicines,
    addMasterMedicine,
    updateMasterMedicine,
    deleteMasterMedicine,
    importMasterMedicines,
    searchMasterMedicinesPublic,
} from "../controllers/masterMedicineController.js";

const masterMedicineRouter = Router();

// Configure multer for memory storage (for file parsing)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Admin login (public)
masterMedicineRouter.post("/login", adminLogin);

// Public search for store users
masterMedicineRouter.get("/search", protect, searchMasterMedicinesPublic);

// Admin-protected routes
masterMedicineRouter.get("/", adminProtect, getMasterMedicines);
masterMedicineRouter.post("/", adminProtect, addMasterMedicine);
masterMedicineRouter.put("/:id", adminProtect, updateMasterMedicine);
masterMedicineRouter.delete("/:id", adminProtect, deleteMasterMedicine);
masterMedicineRouter.post("/import", adminProtect, upload.single("file"), importMasterMedicines);

export default masterMedicineRouter;
