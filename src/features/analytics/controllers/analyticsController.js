import os from "os";
import mongoose from "mongoose";
import ApiLog from "../../../core/models/ApiLog.js";
import Store from "../../store/models/storeModel.js";
import User from "../../user/models/userModel.js";

// Helper to get start of today
const getStartOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};

// Overview Cards
export const getOverview = async (req, res) => {
    try {
        const startOfToday = getStartOfToday();
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);

        const totalStores = await Store.countDocuments();
        const totalUsers = await User.countDocuments();

        // Using ApiLogs to find active users
        const onlineUsers = await ApiLog.distinct("userId", { timestamp: { $gte: fiveMinsAgo } });
        
        // Logins today - checking login endpoint
        const todaysLogins = await ApiLog.countDocuments({ 
            endpoint: { $regex: /\/login/i }, 
            timestamp: { $gte: startOfToday },
            success: true
        });

        const totalRequests = await ApiLog.countDocuments();
        const requestsToday = await ApiLog.countDocuments({ timestamp: { $gte: startOfToday } });
        
        const successfulRequests = await ApiLog.countDocuments({ success: true });
        const failedRequests = await ApiLog.countDocuments({ success: false });

        const avgResponseResult = await ApiLog.aggregate([
            { $group: { _id: null, avgTime: { $avg: "$responseTime" } } }
        ]);
        const avgResponseTime = avgResponseResult[0]?.avgTime || 0;

        const serverUptime = process.uptime(); // in seconds

        res.json({
            success: true,
            data: {
                totalStores,
                totalUsers,
                onlineUsers: onlineUsers.length,
                todaysLogins,
                totalRequests,
                requestsToday,
                successfulRequests,
                failedRequests,
                avgResponseTime: Math.round(avgResponseTime),
                serverUptime
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// API Usage
export const getApiUsage = async (req, res) => {
    try {
        const topEndpoints = await ApiLog.aggregate([
            { $sort: { timestamp: -1 } },
            {
                $group: {
                    _id: "$endpoint",
                    hits: { $sum: 1 },
                    avgResponseTime: { $avg: "$responseTime" },
                    lastAccessed: { $first: "$timestamp" },
                    lastAccessedStore: { $first: "$storeName" },
                    errorCount: {
                        $sum: { $cond: [{ $eq: ["$success", false] }, 1, 0] }
                    }
                }
            },
            {
                $project: {
                    endpoint: "$_id",
                    hits: 1,
                    avgResponseTime: { $round: ["$avgResponseTime", 0] },
                    lastAccessed: 1,
                    lastAccessedStore: 1,
                    errorCount: 1,
                    successRate: {
                        $round: [
                            { $multiply: [{ $divide: [{ $subtract: ["$hits", "$errorCount"] }, "$hits"] }, 100] },
                            1
                        ]
                    }
                }
            },
            { $sort: { hits: -1 } },
            { $limit: 20 }
        ]);

        // Charts data
        const requestsByMethod = await ApiLog.aggregate([
            { $group: { _id: "$method", count: { $sum: 1 } } }
        ]);

        const startOfToday = getStartOfToday();
        const requestsByHour = await ApiLog.aggregate([
            { $match: { timestamp: { $gte: startOfToday } } },
            {
                $group: {
                    _id: { $hour: "$timestamp" },
                    hits: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const requestsByDay = await ApiLog.aggregate([
            { $match: { timestamp: { $gte: sevenDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                    hits: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        res.json({
            success: true,
            data: {
                topEndpoints,
                requestsByMethod: requestsByMethod.map(r => ({ method: r._id, count: r.count })),
                requestsByHour: requestsByHour.map(r => ({ hour: r._id, hits: r.hits })),
                requestsByDay: requestsByDay.map(r => ({ day: r._id, hits: r.hits })),
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// User Activity
export const getUserActivity = async (req, res) => {
    try {
        const startOfToday = getStartOfToday();
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);

        const activity = await ApiLog.aggregate([
            { $match: { storeId: { $ne: null } } },
            {
                $group: {
                    _id: "$storeId",
                    storeName: { $first: "$storeName" },
                    lastApiRequest: { $max: "$timestamp" },
                    totalRequests: { $sum: 1 },
                    requestsToday: {
                        $sum: { $cond: [{ $gte: ["$timestamp", startOfToday] }, 1, 0] }
                    },
                    billsImported: {
                        $sum: { $cond: [{ $regexMatch: { input: "$endpoint", regex: /upload-bill/i } }, 1, 0] }
                    },
                    invoicesGenerated: {
                        $sum: { $cond: [{ $regexMatch: { input: "$endpoint", regex: /sales.*\/create/i } }, 1, 0] } // Assuming sales create is invoice
                    }
                }
            },
            {
                $lookup: {
                    from: "apilogs",
                    let: { sId: "$_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$storeId", "$$sId"] }, endpoint: { $regex: /\/login/i } } },
                        { $sort: { timestamp: -1 } },
                        { $limit: 1 }
                    ],
                    as: "lastLoginLog"
                }
            },
            {
                $project: {
                    storeId: "$_id",
                    storeName: 1,
                    lastApiRequest: 1,
                    totalRequests: 1,
                    requestsToday: 1,
                    billsImported: 1,
                    invoicesGenerated: 1,
                    lastLogin: { $arrayElemAt: ["$lastLoginLog.timestamp", 0] },
                    isOnline: { $gte: ["$lastApiRequest", fiveMinsAgo] }
                }
            },
            { $sort: { totalRequests: -1 } }
        ]);

        res.json({ success: true, data: activity });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// OCR & AI Analytics
export const getOcrAiAnalytics = async (req, res) => {
    try {
        const startOfToday = getStartOfToday();
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

        // We use upload-bill as the proxy for OCR/AI requests since it connects to the 3rd party
        const ocrAiRegex = /upload-bill/i;

        const billsToday = await ApiLog.countDocuments({ endpoint: { $regex: ocrAiRegex }, timestamp: { $gte: startOfToday } });
        const billsMonth = await ApiLog.countDocuments({ endpoint: { $regex: ocrAiRegex }, timestamp: { $gte: startOfMonth } });
        
        const totalRequests = await ApiLog.countDocuments({ endpoint: { $regex: ocrAiRegex } });
        const failures = await ApiLog.countDocuments({ endpoint: { $regex: ocrAiRegex }, success: false });
        
        const avgResult = await ApiLog.aggregate([
            { $match: { endpoint: { $regex: ocrAiRegex } } },
            { $group: { _id: null, avgTime: { $avg: "$responseTime" } } }
        ]);
        const avgTime = avgResult[0]?.avgTime || 0;

        const successRate = totalRequests > 0 ? ((totalRequests - failures) / totalRequests) * 100 : 0;

        res.json({
            success: true,
            data: {
                ocr: {
                    billsUploadedToday: billsToday,
                    billsUploadedThisMonth: billsMonth,
                    averageOcrTime: Math.round(avgTime),
                    ocrFailures: failures,
                    ocrSuccessRate: Math.round(successRate * 10) / 10
                },
                ai: {
                    totalAiRequests: totalRequests, // using the same endpoint as proxy
                    parsingFailures: failures,
                    parsingSuccessRate: Math.round(successRate * 10) / 10,
                    averageParsingTime: Math.round(avgTime)
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Errors Dashboard
export const getErrors = async (req, res) => {
    try {
        const startOfToday = getStartOfToday();

        const totalErrors = await ApiLog.countDocuments({ success: false });
        const errorsToday = await ApiLog.countDocuments({ success: false, timestamp: { $gte: startOfToday } });

        const latestErrors = await ApiLog.find({ success: false })
            .sort({ timestamp: -1 })
            .limit(50)
            .select("timestamp endpoint storeName statusCode error ip");

        res.json({
            success: true,
            data: {
                totalErrors,
                errorsToday,
                latestErrors
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Live Requests
export const getLiveRequests = async (req, res) => {
    try {
        const requests = await ApiLog.find()
            .sort({ timestamp: -1 })
            .limit(50)
            .select("timestamp storeName method endpoint statusCode responseTime success");

        res.json({ success: true, data: requests });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Backend Health
export const getBackendHealth = async (req, res) => {
    try {
        const memoryUsage = process.memoryUsage();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        
        // Very basic CPU load (not highly accurate for node process alone, but gives system load)
        const loadAvg = os.loadavg();

        res.json({
            success: true,
            data: {
                mongoDbConnected: mongoose.connection.readyState === 1,
                nodeUptime: process.uptime(),
                systemUptime: os.uptime(),
                memoryUsage: {
                    rss: memoryUsage.rss,
                    heapTotal: memoryUsage.heapTotal,
                    heapUsed: memoryUsage.heapUsed,
                    systemTotal: totalMem,
                    systemFree: freeMem,
                    usedPercentage: Math.round(((totalMem - freeMem) / totalMem) * 100)
                },
                cpuUsage: {
                    loadAvg1m: loadAvg[0],
                    loadAvg5m: loadAvg[1],
                    loadAvg15m: loadAvg[2],
                    cores: os.cpus().length
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
