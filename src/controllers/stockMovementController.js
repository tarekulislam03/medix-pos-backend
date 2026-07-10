import StockMovement from "../models/stockMovementModel.js";

export const getStockMovements = async (req, res) => {
    try {
        const storeId = req.storeId;
        const { productId, startDate, endDate, page = 1, limit = 50 } = req.query;

        let query = { storeId };

        if (productId) {
            query.productId = productId;
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                query.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                query.createdAt.$lte = new Date(endDate);
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const movements = await StockMovement.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate("productId", "medicine_name")
            .lean();

        const total = await StockMovement.countDocuments(query);

        res.status(200).json({
            success: true,
            data: movements,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        console.error("Error fetching stock movements:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
