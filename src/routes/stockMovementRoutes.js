import express from "express";
import { getStockMovements } from "../controllers/stockMovementController.js";

const router = express.Router();

router.get("/", getStockMovements);

export default router;
