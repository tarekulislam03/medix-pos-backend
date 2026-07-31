import mongoose from 'mongoose';
import Store from '../../store/models/storeModel.js';
import Sales from '../../sales/models/salesModel.js';
import Inventory from '../../product/models/productModel.js';
import Setting from '../../settings/models/settingsModel.js';

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

async function getSavingsData(storeId) {
    const storeObjId = new mongoose.Types.ObjectId(String(storeId));

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

    const soldData = (soldNearExpiryDirect.length > 0 ? soldNearExpiryDirect : soldNearExpiryLookup)[0] || { total_saved: 0, items_count: 0 };
    const returnData = supplierReturns[0] || { total_saved: 0, items_count: 0 };

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

function formatINR(value) {
    return '₹' + Number(value || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

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
🤖 _Auto-generated by Medix POS_`;

    return msg;
}

export const generateReportForStore = async (req, res) => {
    try {
        const { storeId } = req.params;
        const store = await Store.findById(storeId).lean();
        if (!store) {
            return res.status(404).json({ success: false, message: 'Store not found' });
        }

        const setting = await Setting.findOne({ storeId }).lean();
        const storeName = setting?.storeName || store.storeName || 'Store';
        const phone = setting?.phone || store.contactNumber || '';

        const analytics = await getMonthlyAnalytics(storeId);
        const savings = await getSavingsData(storeId);
        const message = composeMessage(storeName, analytics, savings);

        res.json({
            success: true,
            data: {
                message,
                phone
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
