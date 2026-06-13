import jwt from "jsonwebtoken";

export const adminProtect = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
            token = req.headers.authorization.split(" ")[1];
        } else if (req.cookies?.adminToken) {
            token = req.cookies.adminToken;
        }

        if (!token) {
            return res.status(401).json({ message: "Not authorized, no admin token" });
        }

        const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
        if (!decoded.isAdmin) {
            return res.status(403).json({ message: "Not authorized, not an admin" });
        }

        req.isAdmin = true;
        next();
    } catch (error) {
        console.error("Admin Auth Error:", error);
        res.status(401).json({ message: "Not authorized, admin token failed" });
    }
};
