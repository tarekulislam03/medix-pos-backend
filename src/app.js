import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { protect } from "./middleware/authMiddleware.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());

import userRouter from "./routes/userRoutes.js"
import productRouter from "./routes/productRoutes.js"
import billingRouter from "./routes/billingRoutes.js";
import salesRouter from "./routes/salesRoutes.js";
import customerRouter from "./routes/customerRoutes.js";
import labelRouter from "./routes/labelRoutes.js";

app.use("/api/v1/user", userRouter)

// Protected routes
app.use("/api/v1/product", protect, productRouter)
app.use("/api/v1/billing", protect, billingRouter)
app.use("/api/v1/sales", protect, salesRouter)
app.use("/api/v1/customer", protect, customerRouter)
app.use('/api/v1/barcode', protect, labelRouter);


app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

export default app;