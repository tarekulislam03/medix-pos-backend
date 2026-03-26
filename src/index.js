import app from "./app.js";
import connectDB from "./config/database.js";
import { initProductCache } from "./services/productCacheService.js";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" });

const port = process.env.PORT || 5000

const startServer = async () => {
    try {
        await connectDB();

        // Initialize in-memory product cache (load from DB + schedule 5-min refresh)
        await initProductCache();

        const server = app.listen(port, () => {
            console.log(`Server running on port ${port}!`);
        });

        // Handle Server Errors
        server.on("error", (error) => {
            console.error("Server error:", error);
            process.exit(1);
        });
    } catch (error) {
        console.error("MongoDB connection failed:", error);
        process.exit(1);
    }
}

startServer();
