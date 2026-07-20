import express from "express";
import { getBillingStatus, submitUtr, getStoreSubscriptionDetails } from "../controllers/storeBillingController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/status", getBillingStatus);
router.post("/pay", submitUtr);
router.get("/details", getStoreSubscriptionDetails);

export default router;
