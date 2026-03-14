import Sales from "../models/salesModel.js";
import mongoose from "mongoose";

const todaySales = async (req, res) => {
    try {

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const result = await Sales.aggregate([
            {
                $match: {
                    storeId: new mongoose.Types.ObjectId(String(req.storeId)),
                    created_at: {
                        $gte: startOfDay,
                        $lte: endOfDay
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    total_sales: { $sum: "$grand_total" }
                }
            }
        ]);

        return res.status(200).json({
            data: result[0] || {
                total_sales: 0
            }
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
};

const monthlySales = async (req, res) => {
    try {

        const now = new Date();

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0,
            23, 59, 59, 999
        );
        const result = await Sales.aggregate([
            {
                $match: {
                    storeId: new mongoose.Types.ObjectId(String(req.storeId)),
                    created_at: {
                        $gte: startOfMonth,
                        $lte: endOfMonth
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    total_sales: { $sum: "$grand_total" }
                }
            }
        ]);

        return res.status(200).json({
            data: result[0] || {
                total_sales: 0,
            }
        });

    } catch (error) {
        res.status(500).json({
            message: "Internal Server Error"
        })
    }
}

const getSalesHistory = async (req, res) => {
    try {
        const { page = 1, limit = 20, startDate, endDate } = req.query;

        const match = { storeId: req.storeId };

        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);

            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            match.created_at = {
                $gte: start,
                $lte: end
            };
        }

        const pageNumber = Number(page) || 1;
        const limitNumber = Number(limit) || 20;

        const sales = await Sales.find(match)
            .populate("customer") // Optionally populate customer if available
            .sort({ created_at: -1 })
            .skip((pageNumber - 1) * limitNumber)
            .limit(limitNumber);

        const totalSales = await Sales.countDocuments(match);

        res.status(200).json({
            success: true,
            total: totalSales,
            page: pageNumber,
            pages: Math.ceil(totalSales / limitNumber),
            data: sales
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch sales history"
        });
    }
};

const getSaleById = async (req, res) => {
    try {
        const { id } = req.params;
        const sale = await Sales.findOne({ _id: id, storeId: req.storeId }).populate("customer");

        if (!sale) {
            return res.status(404).json({ success: false, message: "Sale not found" });
        }

        res.status(200).json({ success: true, data: sale });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to fetch sale details" });
    }
};

export { todaySales, monthlySales, getSalesHistory, getSaleById };