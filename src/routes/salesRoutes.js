import { Router } from "express";
import { getSalesHistory, monthlySales, todaySales, getSaleById } from "../controllers/salesController.js";

const salesRouter = Router();

salesRouter.get("/today", todaySales);
salesRouter.get("/monthly", monthlySales);
salesRouter.get("/history", getSalesHistory);
salesRouter.get("/history/:id", getSaleById);

export default salesRouter;