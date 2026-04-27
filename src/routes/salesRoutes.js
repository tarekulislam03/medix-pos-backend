import { Router } from "express";
import { getSalesHistory, monthlySales, todaySales, getSaleById, updateSaleById, deleteSaleById } from "../controllers/salesController.js";

const salesRouter = Router();

salesRouter.get("/today", todaySales);
salesRouter.get("/monthly", monthlySales);
salesRouter.get("/history", getSalesHistory);
salesRouter.get("/history/:id", getSaleById);
salesRouter.put("/history/:id", updateSaleById);
salesRouter.delete("/history/:id", deleteSaleById);

export default salesRouter;