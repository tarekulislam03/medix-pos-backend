import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from 'helmet';
// import mongoSanitize from 'express-mongo-sanitize';
import { protect } from "./middleware/authMiddleware.js";
// import xss from 'xss-clean';
import xssMiddleware from "./middleware/xssMiddleware.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
// app.use(mongoSanitize());
// app.use(xss());
app.use(xssMiddleware);


import userRouter from "./routes/userRoutes.js"
import productRouter from "./routes/productRoutes.js"
import billingRouter from "./routes/billingRoutes.js";
import salesRouter from "./routes/salesRoutes.js";
import customerRouter from "./routes/customerRoutes.js";
import labelRouter from "./routes/labelRoutes.js";
import settingsRouter from "./routes/settingsRoutes.js";

app.use("/api/v1/user", userRouter)

// Protected routes
app.use("/api/v1/product", protect, productRouter)
app.use("/api/v1/billing", protect, billingRouter)
app.use("/api/v1/sales", protect, salesRouter)
app.use("/api/v1/customer", protect, customerRouter)
app.use('/api/v1/barcode', protect, labelRouter);
app.use('/api/v1/settings', protect, settingsRouter);


app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

export default app;