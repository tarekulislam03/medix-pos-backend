/**
 * Monthly Analytics WhatsApp Report — Cron Scheduler
 * 
 * Runs on the LAST DAY of every month at 10:00 PM IST (22:00).
 * For each store that has a phone number in its settings, it:
 *   1. Aggregates the current month's sales, order count, etc.
 *   2. Aggregates savings data (expiry loss saved via Medix alerts).
 *   3. Composes a formatted analytics summary.
 *   4. Sends it via WhatsApp.
 * 
 * Cron expression: "0 22 28-31 * *" with a runtime check for last day.
 * Timezone: Asia/Kolkata
 */
import cron from 'node-cron';
import mongoose from 'mongoose';
import Setting from '../../features/settings/models/settingsModel.js';
import Store from '../../features/store/models/storeModel.js';
import Sales from '../../features/sales/models/salesModel.js';
import Inventory from '../../features/product/models/productModel.js';
import { sendWhatsAppMessage } from './whatsappService.js';

/**
 * Check if a Date object represents the last day of its month.
 */
function isLastDayOfMonth(date) {
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.getDate() === 1;
}

/**
 * Aggregate monthly sales analytics for a specific store.
 */
async function getMonthlyAnalytics(storeId) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const result = await Sales.aggregate([
        {
            $match: {
                storeId: new mongoose.Types.ObjectId(String(storeId)),
                created_at: { $gte: startOfMonth, $lte: endOfMonth }
            }
        },
        {
            $group: {
                _id: null,
                totalSales: { $sum: '$grand_total' },
                totalOrders: { $sum: 1 },
                totalDiscount: { $sum: '$total_discount' },
                avgOrderValue: { $avg: '$grand_total' }
            }
        }
    ]);

    return result[0] || {
        totalSales: 0,
        totalOrders: 0,
        totalDiscount: 0,
        avgOrderValue: 0
    };
}

/**
 * Aggregate savings data (expiry loss saved) for a specific store.
 * Mirrors the logic in savingsController.js
 */
async function getSavingsData(storeId) {
    const storeObjId = new mongoose.Types.ObjectId(String(storeId));

    // Sold near-expiry items (expiry_date on sale items directly)
    const soldNearExpiryDirect = await Sales.aggregate([
        { $match: { storeId: storeObjId } },
        { $unwind: '$items' },
        { $match: { 'items.expiry_date': { $exists: true, $ne: null } } },
        {
            $addFields: {
                days_to_expiry: {
                    $divide: [
                        { $subtract: ['$items.expiry_date', '$created_at'] },
                        86400000
                    ]
                }
            }
        },
        { $match: { days_to_expiry: { $lte: 90 } } },
        {
            $group: {
                _id: null,
                total_saved: {
                    $sum: {
                        $multiply: [
                            { $ifNull: ['$items.cost_price', '$items.mrp'] },
                            '$items.quantity'
                        ]
                    }
                },
                items_count: { $sum: '$items.quantity' }
            }
        }
    ]);

    // Fallback: sold near-expiry via inventory lookup
    const soldNearExpiryLookup = await Sales.aggregate([
        { $match: { storeId: storeObjId } },
        { $unwind: '$items' },
        {
            $lookup: {
                from: 'inventories',
                localField: 'items.product_id',
                foreignField: '_id',
                as: 'product'
            }
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: false } },
        { $match: { 'product.expiry_date': { $exists: true, $ne: null } } },
        {
            $addFields: {
                days_to_expiry: {
                    $divide: [
                        { $subtract: ['$product.expiry_date', '$created_at'] },
                        86400000
                    ]
                }
            }
        },
        { $match: { days_to_expiry: { $lte: 90 } } },
        {
            $group: {
                _id: null,
                total_saved: {
                    $sum: {
                        $multiply: [
                            { $ifNull: ['$items.cost_price', '$items.mrp'] },
                            '$items.quantity'
                        ]
                    }
                },
                items_count: { $sum: '$items.quantity' }
            }
        }
    ]);

    // Supplier returns
    const supplierReturns = await Inventory.aggregate([
        {
            $match: {
                storeId: storeObjId,
                returned_to_supplier: true,
                loss_saved_amount: { $gt: 0 }
            }
        },
        {
            $group: {
                _id: null,
                total_saved: { $sum: '$loss_saved_amount' },
                items_count: { $sum: 1 }
            }
        }
    ]);

    // Use direct pipeline if it has data, else fallback to lookup
    const soldData = (soldNearExpiryDirect.length > 0 ? soldNearExpiryDirect : soldNearExpiryLookup)[0] || { total_saved: 0, items_count: 0 };
    const returnData = supplierReturns[0] || { total_saved: 0, items_count: 0 };

    // Current at-risk items
    const today = new Date();
    const next90Days = new Date();
    next90Days.setDate(today.getDate() + 90);

    const atRiskItems = await Inventory.countDocuments({
        storeId: storeObjId,
        returned_to_supplier: { $ne: true },
        quantity: { $gt: 0 },
        expiry_date: { $exists: true, $ne: null, $lte: next90Days }
    });

    return {
        soldNearExpirySaved: Math.round(soldData.total_saved * 100) / 100,
        soldNearExpiryItems: soldData.items_count,
        supplierReturnSaved: Math.round(returnData.total_saved * 100) / 100,
        supplierReturnItems: returnData.items_count,
        totalSaved: Math.round((soldData.total_saved + returnData.total_saved) * 100) / 100,
        totalItemsSaved: soldData.items_count + returnData.items_count,
        atRiskCount: atRiskItems
    };
}

/**
 * Format currency in Indian locale.
 */
function formatINR(value) {
    return '₹' + Number(value || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Compose the analytics report message.
 */
function composeMessage(storeName, analytics, savings) {
    const now = new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const monthYear = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    const estimatedProfit = Number(analytics.totalSales) * 0.30;

    const msg = `📊 *Monthly Analytics Report*
━━━━━━━━━━━━━━━━━━━━━━
🏪 *${storeName || 'Your Store'}*
📅 *${monthYear}*
━━━━━━━━━━━━━━━━━━━━━━

💰 *Sales Overview*
• Total Sales: *${formatINR(analytics.totalSales)}*
• Total Orders: *${analytics.totalOrders}*
• Avg. Order Value: *${formatINR(analytics.avgOrderValue)}*
• Total Discount Given: *${formatINR(analytics.totalDiscount)}*

📈 *Estimated Profit (30% margin)*
• *${formatINR(estimatedProfit)}*
⚠️ _Please do not assume this as real profit. This is an estimate only, calculated at 30% margin on monthly sales._

🛡️ *Estimated Loss Saved from Medix*
• Near-Expiry Sold: *${formatINR(savings.soldNearExpirySaved)}* (${savings.soldNearExpiryItems} items)
• Supplier Returns: *${formatINR(savings.supplierReturnSaved)}* (${savings.supplierReturnItems} items)
• *Total Saved: ${formatINR(savings.totalSaved)}* (${savings.totalItemsSaved} items)
• Items Currently At-Risk: *${savings.atRiskCount}*

━━━━━━━━━━━━━━━━━━━━━━
🤖 _Auto-generated by Medix POS_
_This report is sent on the last day of every month._`;

    return msg;
}

/**
 * Main job: iterate all stores, aggregate analytics, send WhatsApp messages.
 */
async function sendMonthlyReports() {
    console.log('[Cron] Starting monthly WhatsApp analytics reports...');

    try {
        // Get all settings that have a phone number
        const allSettings = await Setting.find({
            phone: { $exists: true, $ne: '' }
        }).lean();

        if (allSettings.length === 0) {
            console.log('[Cron] No stores have a phone number configured. Skipping.');
            return;
        }

        let sent = 0;
        let failed = 0;

        for (const setting of allSettings) {
            try {
                const store = await Store.findById(setting.storeId).lean();

                // Skip blocked stores
                if (store?.isBlocked) {
                    console.log(`[Cron] Store ${setting.storeId} is blocked. Skipping.`);
                    continue;
                }

                const analytics = await getMonthlyAnalytics(setting.storeId);
                const savings = await getSavingsData(setting.storeId);
                const storeName = setting.storeName || store?.storeName || 'Store';
                const message = composeMessage(storeName, analytics, savings);

                const success = await sendWhatsAppMessage(setting.phone, message);
                if (success) {
                    sent++;
                } else {
                    failed++;
                }

                // Rate limit: wait 3 seconds between messages to avoid WhatsApp throttling
                await new Promise(r => setTimeout(r, 3000));

            } catch (storeErr) {
                failed++;
                console.error(`[Cron] Error processing store ${setting.storeId}:`, storeErr.message);
            }
        }

        console.log(`[Cron] Monthly reports complete. Sent: ${sent}, Failed: ${failed}`);

    } catch (err) {
        console.error('[Cron] Fatal error in monthly report job:', err.message);
    }
}

/**
 * Schedule the monthly analytics report cron job.
 * Runs at 10:00 PM IST on days 28–31 of every month,
 * with a runtime check to ensure it's actually the last day.
 */
export function scheduleMonthlyWhatsAppReport() {
    // "0 22 28-31 * *" = At 22:00 on days 28 through 31 of every month
    cron.schedule('0 22 28-31 * *', () => {
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        if (!isLastDayOfMonth(now)) {
            console.log(`[Cron] ${now.toDateString()} is NOT the last day of the month. Skipping.`);
            return;
        }

        console.log(`[Cron] ${now.toDateString()} IS the last day. Firing monthly report...`);
        sendMonthlyReports();
    }, {
        timezone: 'Asia/Kolkata'
    });

    console.log('[Cron] Monthly WhatsApp analytics report scheduled (last day of month @ 10:00 PM IST).');
}

/**
 * Export for manual/testing trigger via API if needed.
 */
export { sendMonthlyReports };
