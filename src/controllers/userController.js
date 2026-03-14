import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Store from "../models/storeModel.js";
import User from "../models/userModel.js";

// register user
const registerUser = async (req, res) => {
  try {
    const { storeName, phone, password } = req.body;

    const existingUser = await User.findOne({ phone });

    if (existingUser) {
      return res.status(400).json({ message: "Phone already registered" });
    }

    const store = await Store.create({
      storeName,
      storePhone: phone
    });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      phone,
      password: hashedPassword,
      storeId: store._id
    });

    const token = jwt.sign(
      {
        userId: user._id,
        storeId: store._id
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: true
    });

    res.status(201).json({
      message: "Store registered",
      user,
      token
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

//login user
const loginUser = async (req, res) => {
  try {
    const { phone, password } = req.body;

    const user = await User.findOne({ phone }).populate("storeId");

    if (!user) {
      return res.status(401).json({ message: "Phone Number Not Found!" });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ message: "Password Wrong!" });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        storeId: user.storeId._id
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: true
    });

    res.json({
      message: "Login successful",
      user,
      token
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// logout 
const logoutUser = async (req, res) => {
    try {
        res.cookie("token", "", {
            httpOnly: true,
            expires: new Date(0)
        });

        res.status(200).json({
            message: "Logged out successfully"
        });

    } catch (error) {
        res.status(500).json({
            message: "Logout failed"
        });
    }
};

export { registerUser, loginUser, logoutUser };