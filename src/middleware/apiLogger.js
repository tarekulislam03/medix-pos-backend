import ApiLog from "../models/ApiLog.js";
import Store from "../models/storeModel.js";

const apiLogger = (req, res, next) => {
    // We don't want to log the analytics requests themselves, to avoid an infinite feedback loop of logs
    if (req.originalUrl.startsWith("/api/v1/analytics")) {
        return next();
    }

    const start = Date.now();

    // Capture response finish
    res.on("finish", async () => {
        const responseTime = Date.now() - start;
        const statusCode = res.statusCode;
        const success = statusCode >= 200 && statusCode < 400;

        try {
            let storeName = null;
            if (req.storeId) {
                const store = await Store.findById(req.storeId).select("name").lean();
                if (store) {
                    storeName = store.name;
                }
            }

            // A lot of errors might be passed via locals or we just assume based on status code
            let errorMessage = null;
            if (!success && res.locals.errorMessage) {
                errorMessage = res.locals.errorMessage;
            }

            const logEntry = new ApiLog({
                timestamp: new Date(),
                method: req.method,
                endpoint: req.originalUrl || req.url,
                statusCode,
                responseTime,
                userId: req.user || null,
                storeId: req.storeId || null,
                storeName,
                success,
                error: errorMessage,
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.get("user-agent") || ""
            });

            await logEntry.save();
        } catch (error) {
            console.error("API Logging Error:", error.message);
        }
    });

    next();
};

export default apiLogger;
