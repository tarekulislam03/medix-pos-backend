import { Router } from "express";
import {  generateLabels, getSingleBarcode } from "../controllers/labelController.js";

const labelRouter = Router();

labelRouter.get('/single/:id', getSingleBarcode);
labelRouter.post('/labels/generate', generateLabels);

export default labelRouter;