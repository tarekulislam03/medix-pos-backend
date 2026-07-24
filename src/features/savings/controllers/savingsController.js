import mongoose from "mongoose";
import Sales from "../../sales/models/salesModel.js";
import Inventory from "../../product/models/productModel.js";

/**
 * GET /api/v1/savings/expiry
 *
 * Calculates estimated expiry loss saved — money the pharmacy would have lost
 * if near-expiry medicines were not sold or returned in time.
 *
 * "Near-expiry" = product whose expiry_date was within 90 days of the sale date
 * (i.e., products that would have triggered the soon-to-expiry alert).
 *
 * Returns monthly breakdown + overall totals.
 */
export const getExpirySavings = async (req, res) => {
    try {
        const storeId = new mongoose.Types.ObjectId(req.storeId);

        // ──────────────────────────────────────────────
        // 1. Sold near-expiry items (from Sales + Inventory lookup)
        // ──────────────────────────────────────────────
        const soldNearExpiryPipeline = [
            { $match: { storeId } },
            { $unwind: "$items" },
            {
                $lookup: {
                    from: "inventories",
                    localField: "items.product_id",
                    foreignField: "_id",
                    as: "product"
                }
            },
            { $unwind: { path: "$product", preserveNullAndEmptyArrays: false } },
            // Only products that have an expiry date
            {
                $match: {
                    "product.expiry_date": { $exists: true, $ne: null }
                }
            },
            // Calculate days between sale and product expiry
            {
                $addFields: {
                    days_to_expiry: {
                        $divide: [
                            { $subtract: ["$product.expiry_date", "$created_at"] },
                            86400000 // ms in a day
                        ]
                    }
                }
            },
            // Keep only items sold within 90 days before expiry (the alert window)
            // days_to_expiry >= 0 means sold BEFORE expiry
            // days_to_expiry <= 90 means was within the 90-day alert window
            // Also include days_to_expiry < 0 (sold after expiry — still a save if it got sold)
            {
                $match: {
                    days_to_expiry: { $lte: 90 }
                }
            },
            // Group by year-month
            {
                $group: {
                    _id: {
                        year: { $year: "$created_at" },
                        month: { $month: "$created_at" }
                    },
                    total_saved: {
                        $sum: {
                            $multiply: [
                                { $ifNull: ["$items.cost_price", "$items.mrp"] },
                                "$items.quantity"
                            ]
                        }
                    },
                    items_count: { $sum: "$items.quantity" },
                    medicines: { $addToSet: "$items.medicine_name" }
                }
            },
            { $sort: { "_id.year": -1, "_id.month": -1 } }
        ];

        // Also try using expiry_date stored directly on sale items (future-proofed)
        const soldNearExpiryDirectPipeline = [
            { $match: { storeId } },
            { $unwind: "$items" },
            // Only items that have expiry_date stored directly
            {
                $match: {
                    "items.expiry_date": { $exists: true, $ne: null }
                }
            },
            {
                $addFields: {
                    days_to_expiry: {
                        $divide: [
                            { $subtract: ["$items.expiry_date", "$created_at"] },
                            86400000
                        ]
                    }
                }
            },
            {
                $match: {
                    days_to_expiry: { $lte: 90 }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$created_at" },
                        month: { $month: "$created_at" }
                    },
                    total_saved: {
                        $sum: {
                            $multiply: [
                                { $ifNull: ["$items.cost_price", "$items.mrp"] },
                                "$items.quantity"
                            ]
                        }
                    },
                    items_count: { $sum: "$items.quantity" },
                    medicines: { $addToSet: "$items.medicine_name" }
                }
            },
            { $sort: { "_id.year": -1, "_id.month": -1 } }
        ];

        // ──────────────────────────────────────────────
        // 2. Supplier returns — items returned before expiry loss
        // ──────────────────────────────────────────────
        const supplierReturnsPipeline = [
            {
                $match: {
                    storeId,
                    returned_to_supplier: true,
                    loss_saved_amount: { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$updatedAt" },
                        month: { $month: "$updatedAt" }
                    },
                    total_saved: { $sum: "$loss_saved_amount" },
                    items_count: { $sum: 1 },
                    medicines: { $addToSet: "$medicine_name" }
                }
            },
            { $sort: { "_id.year": -1, "_id.month": -1 } }
        ];

        // Run all pipelines in parallel
        const [soldNearExpiry, soldDirect, supplierReturns] = await Promise.all([
            Sales.aggregate(soldNearExpiryPipeline),
            Sales.aggregate(soldNearExpiryDirectPipeline),
            Inventory.aggregate(supplierReturnsPipeline)
        ]);

        // ──────────────────────────────────────────────
        // 3. Merge results by month
        // ──────────────────────────────────────────────
        const monthMap = new Map();

        const addToMonth = (data, source) => {
            for (const entry of data) {
                const key = `${entry._id.year}-${String(entry._id.month).padStart(2, '0')}`;
                if (!monthMap.has(key)) {
                    monthMap.set(key, {
                        year: entry._id.year,
                        month: entry._id.month,
                        sold_near_expiry_saved: 0,
                        supplier_return_saved: 0,
                        total_saved: 0,
                        items_count: 0,
                        unique_medicines: new Set()
                    });
                }
                const m = monthMap.get(key);
                if (source === 'supplier_return') {
                    m.supplier_return_saved += entry.total_saved;
                } else {
                    m.sold_near_expiry_saved += entry.total_saved;
                }
                m.total_saved += entry.total_saved;
                m.items_count += entry.items_count;
                for (const med of (entry.medicines || [])) {
                    m.unique_medicines.add(med);
                }
            }
        };

        // Prefer direct pipeline if it has data, otherwise use lookup pipeline
        if (soldDirect.length > 0) {
            addToMonth(soldDirect, 'sold_near_expiry');
        } else {
            addToMonth(soldNearExpiry, 'sold_near_expiry');
        }
        addToMonth(supplierReturns, 'supplier_return');

        // Convert to array and sort desc
        const monthly = Array.from(monthMap.entries())
            .map(([key, val]) => ({
                key,
                year: val.year,
                month: val.month,
                sold_near_expiry_saved: Math.round(val.sold_near_expiry_saved * 100) / 100,
                supplier_return_saved: Math.round(val.supplier_return_saved * 100) / 100,
                total_saved: Math.round(val.total_saved * 100) / 100,
                items_count: val.items_count,
                unique_medicines_count: val.unique_medicines.size,
            }))
            .sort((a, b) => b.key.localeCompare(a.key));

        // Grand totals
        const grand_total_saved = monthly.reduce((s, m) => s + m.total_saved, 0);
        const grand_items_count = monthly.reduce((s, m) => s + m.items_count, 0);
        const grand_sold_saved = monthly.reduce((s, m) => s + m.sold_near_expiry_saved, 0);
        const grand_return_saved = monthly.reduce((s, m) => s + m.supplier_return_saved, 0);

        // ──────────────────────────────────────────────
        // 4. Current at-risk items (near expiry right now, not yet sold/returned)
        // ──────────────────────────────────────────────
        const today = new Date();
        const next90Days = new Date();
        next90Days.setDate(today.getDate() + 90);

        const atRiskItems = await Inventory.find({
            storeId: req.storeId,
            returned_to_supplier: { $ne: true },
            quantity: { $gt: 0 },
            expiry_date: { $exists: true, $ne: null, $lte: next90Days }
        }).select('medicine_name mrp cost_price quantity expiry_date batch_number').lean();

        const at_risk_value = atRiskItems.reduce((sum, item) => {
            return sum + ((item.cost_price || item.mrp || 0) * item.quantity);
        }, 0);

        res.status(200).json({
            grand_total_saved: Math.round(grand_total_saved * 100) / 100,
            grand_items_count,
            grand_sold_near_expiry_saved: Math.round(grand_sold_saved * 100) / 100,
            grand_supplier_return_saved: Math.round(grand_return_saved * 100) / 100,
            monthly,
            at_risk: {
                count: atRiskItems.length,
                value: Math.round(at_risk_value * 100) / 100,
                items: atRiskItems.slice(0, 20) // Top 20 at-risk items
            }
        });

    } catch (error) {
        console.error("getExpirySavings error:", error);
        res.status(500).json({ message: "Failed to fetch expiry savings", error: error.message });
    }
};
