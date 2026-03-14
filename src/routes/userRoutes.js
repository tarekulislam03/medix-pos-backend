import { Router } from "express";

import { loginUser, logoutUser, registerUser } from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";

const userRouter = Router();

userRouter.post("/register", registerUser);
userRouter.post("/login", loginUser);
userRouter.post("/logout", protect, logoutUser);


export default userRouter;