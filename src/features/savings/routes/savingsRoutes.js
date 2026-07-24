import express from "express";
import { getExpirySavings } from "../controllers/savingsController.js";

const savingsRouter = express.Router();

savingsRouter.get("/expiry", getExpirySavings);

export default savingsRouter;
