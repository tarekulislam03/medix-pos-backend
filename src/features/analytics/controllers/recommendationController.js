import Sales from "../../sales/models/salesModel.js";
import Inventory from "../../product/models/productModel.js";

import mongoose from "mongoose";

export const getBillingRecommendations = async (req, res) => {
    try {
        const storeId = new mongoose.Types.ObjectId(req.storeId);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        // 1. Highest Selling (last 30 days)
        const salesAgg = await Sales.aggregate([
            { $match: { storeId: storeId, created_at: { $gte: thirtyDaysAgo } } },
            { $unwind: "$items" },
            { $group: {
                _id: "$items.product_id",
                name: { $first: "$items.medicine_name" },
                totalQuantitySold: { $sum: "$items.quantity" },
                totalRevenue: { $sum: "$items.total" }
            }},
            { $sort: { totalQuantitySold: -1 } },
            { $limit: 10 }
        ]);

        const topSellerIds = salesAgg.map(s => s._id);
        const topSellerInventory = await Inventory.find({ _id: { $in: topSellerIds }, storeId });
        
        const highestSelling = [];
        const orderMore = [];

        salesAgg.forEach(sale => {
            const inv = topSellerInventory.find(i => i._id.toString() === sale._id.toString());
            highestSelling.push({
                name: sale.name,
                sold: sale.totalQuantitySold,
                revenue: sale.totalRevenue,
                currentStock: inv ? inv.quantity : 0
            });

            // Order More: Running low on top sellers
            if (inv && (inv.quantity <= inv.alert_threshold || inv.quantity < (sale.totalQuantitySold / 2))) {
                orderMore.push({
                    name: sale.name,
                    sold: sale.totalQuantitySold,
                    currentStock: inv.quantity,
                    alertThreshold: inv.alert_threshold
                });
            }
        });

        // 2. Dead Stock (quantity > 0, no sales in 3 months)
        const recentSales = await Sales.aggregate([
            { $match: { storeId: storeId, created_at: { $gte: threeMonthsAgo } } },
            { $unwind: "$items" },
            { $group: { _id: "$items.product_id" } }
        ]);
        const recentlySoldProductIds = recentSales.map(s => s._id);

        const deadStock = await Inventory.find({
            storeId: storeId,
            quantity: { $gt: 0 },
            _id: { $nin: recentlySoldProductIds }
        }).sort({ quantity: -1 }).limit(10).select('medicine_name quantity expiry_date');

        // 3. Order Less (Overstocked based on 30 day velocity)
        const all30DaySales = await Sales.aggregate([
            { $match: { storeId: storeId, created_at: { $gte: thirtyDaysAgo } } },
            { $unwind: "$items" },
            { $group: { _id: "$items.product_id", sold: { $sum: "$items.quantity" } } }
        ]);
        const soldIn30Days = {};
        all30DaySales.forEach(s => soldIn30Days[s._id.toString()] = s.sold);

        const highStockItems = await Inventory.find({ storeId: storeId, quantity: { $gt: 20 } }).select('_id medicine_name quantity');
        const orderLess = [];
        highStockItems.forEach(item => {
            const sold = soldIn30Days[item._id.toString()] || 0;
            const monthlyVelocity = sold === 0 ? 1 : sold; 
            const monthsOfStock = item.quantity / monthlyVelocity;
            if (monthsOfStock > 4) { // More than 4 months of stock
                orderLess.push({
                    name: item.medicine_name,
                    currentStock: item.quantity,
                    soldLast30Days: sold
                });
            }
        });
        
        orderLess.sort((a, b) => b.currentStock - a.currentStock);

        res.status(200).json({
            success: true,
            recommendations: {
                highestSelling,
                orderMore,
                orderLess: orderLess.slice(0, 10),
                deadStock: deadStock.map(d => ({ name: d.medicine_name, quantity: d.quantity, expiry: d.expiry_date }))
            }
        });

    } catch (error) {
        console.error("Error generating recommendations:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};
