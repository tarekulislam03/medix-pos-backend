import { Router } from "express";

import { loginUser, logoutUser, registerUser, getStores } from "../controllers/userController.js";
import { protect } from "../../../core/middleware/authMiddleware.js";
import { loginLimiter } from "../../../core/services/rateLimiter.js";

const userRouter = Router();

userRouter.post("/register", registerUser);
userRouter.post("/login", loginLimiter, loginUser);
userRouter.post("/logout", protect, logoutUser);
userRouter.get("/stores", getStores);


export default userRouter;