import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import xssMiddleware from './middleware/xssMiddleware.js';
import { protect } from "./middleware/authMiddleware.js";

const app = express();

// 2. Security headers
app.use(helmet());

// 3. CORS 
app.use(cors());

// 4. Parse body
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());

// 5. Sanitize
app.use(xssMiddleware);

import userRouter from "./routes/userRoutes.js";
import productRouter from "./routes/productRoutes.js";
import billingRouter from "./routes/billingRoutes.js";
import salesRouter from "./routes/salesRoutes.js";
import customerRouter from "./routes/customerRoutes.js";
import labelRouter from "./routes/labelRoutes.js";
import settingsRouter from "./routes/settingsRoutes.js";
import purchaseRouter from "./routes/purchaseRoutes.js";
import gstRouter from "./routes/gstRoutes.js";
import expenseRouter from "./routes/expenseRoutes.js";
import masterMedicineRouter from "./routes/masterMedicineRoutes.js";

// 6. Routes
app.use("/api/v1/user", userRouter);
app.use("/api/v1/product", protect, productRouter);
app.use("/api/v1/billing", protect, billingRouter);
app.use("/api/v1/sales", protect, salesRouter);
app.use("/api/v1/customer", protect, customerRouter);
app.use('/api/v1/barcode', protect, labelRouter);
app.use('/api/v1/settings', protect, settingsRouter);
app.use('/api/v1/purchase', protect, purchaseRouter);
app.use('/api/v1/gst', protect, gstRouter);
app.use('/api/v1/expenses', protect, expenseRouter);
app.use("/api/v1/master-medicines", masterMedicineRouter);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

export default app;