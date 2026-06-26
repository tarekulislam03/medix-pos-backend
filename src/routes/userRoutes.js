import { Router } from "express";

import { loginUser, logoutUser, registerUser, getStores } from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";
import { loginLimiter } from "../services/rateLimiter.js";

const userRouter = Router();

userRouter.post("/register", registerUser);
userRouter.post("/login", loginLimiter, loginUser);
userRouter.post("/logout", protect, logoutUser);
userRouter.get("/stores", getStores);


export default userRouter;