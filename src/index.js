import app from "./app.js";
import connectDB from "./config/database.js";
import dotenv from "dotenv";
import { initWhatsApp } from "./core/services/whatsappService.js";
import { scheduleMonthlyWhatsAppReport } from "./core/services/monthlyReportCron.js";

dotenv.config({ path: "./.env" });

const port = process.env.PORT || 5000

const startServer = async () => {
    try {
        await connectDB();

        const server = app.listen(port, () => {
            console.log(`Server running on port ${port}!`);

            // Initialize WhatsApp client & schedule monthly reports
            initWhatsApp();
            scheduleMonthlyWhatsAppReport();
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
