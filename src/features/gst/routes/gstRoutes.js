import { Router } from "express";
import { getMonthlySummary } from "../controllers/gstController.js";
import {protect} from "../../../core/middleware/authMiddleware.js";

const gstRouter = Router();

// Apply auth middleware to ensure req.storeId is available
gstRouter.use(protect);

gstRouter.get("/summary", getMonthlySummary);

export default gstRouter;
