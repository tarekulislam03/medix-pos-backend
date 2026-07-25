import express from "express";
import { setupSubscription, getPendingApprovals, approvePayment, getAllSubscriptions, getAllStores, markAllPaid, deleteSubscription, addCustomAlert, removeCustomAlert } from "../controllers/adminBillingController.js";
import { protect } from "../../../core/middleware/authMiddleware.js";

const router = express.Router();

router.get("/stores", getAllStores);
router.post("/setup", setupSubscription);
router.post("/custom-alert", addCustomAlert);
router.delete("/custom-alert/:storeId", removeCustomAlert);
router.get("/pending", getPendingApprovals);
router.put("/confirm", approvePayment);
router.get("/", getAllSubscriptions);
router.put("/mark-all-paid/:storeId", markAllPaid);
router.delete("/subscription/:storeId", deleteSubscription);

export default router;
