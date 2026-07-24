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

const analyticsRouter = express.Router();

analyticsRouter.get("/ocr-ai", getOcrAiAnalytics);
analyticsRouter.get("/errors", getErrors);
analyticsRouter.get("/live-requests", getLiveRequests);
analyticsRouter.get("/health", getBackendHealth);

export default analyticsRouter;
