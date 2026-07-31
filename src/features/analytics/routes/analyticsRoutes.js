import express from "express";
import { protect } from "../../../core/middleware/authMiddleware.js";
import {
    getOverview,
    getApiUsage,
    getUserActivity,
    getOcrAiAnalytics,
    getErrors,
    getLiveRequests,
    getBackendHealth
} from "../controllers/analyticsController.js";

import { getBillingRecommendations } from "../controllers/recommendationController.js";
import { sendMonthlyReports } from "../../../core/services/monthlyReportCron.js";
import { isWhatsAppReady } from "../../../core/services/whatsappService.js";

const analyticsRouter = express.Router();

analyticsRouter.get("/ocr-ai", getOcrAiAnalytics);
analyticsRouter.get("/errors", getErrors);
analyticsRouter.get("/live-requests", getLiveRequests);
analyticsRouter.get("/health", getBackendHealth);
analyticsRouter.get("/recommendations", protect, getBillingRecommendations);

// Manual trigger for monthly WhatsApp report (for testing)
analyticsRouter.post("/trigger-monthly-report", protect, async (req, res) => {
    try {
        if (!isWhatsAppReady()) {
            return res.status(503).json({ success: false, message: "WhatsApp client is not ready. Please scan the QR code first." });
        }
        // Fire and forget — don't block the response
        sendMonthlyReports();
        return res.status(200).json({ success: true, message: "Monthly report job triggered. Check server logs." });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default analyticsRouter;

