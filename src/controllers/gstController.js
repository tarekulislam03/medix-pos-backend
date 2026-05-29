import Purchase from "../models/purchaseModel.js";
import Sales from "../models/salesModel.js";

export const getMonthlySummary = async (req, res) => {
    try {
        const { year, month } = req.query;
        if (!year || !month) {
            return res.status(400).json({ success: false, message: "Year and month are required" });
        }

        const y = parseInt(year);
        const m = parseInt(month); // 1 to 12

        const startDate = new Date(y, m - 1, 1);
        const endDate = new Date(y, m, 0, 23, 59, 59, 999);

        // Fetch Purchases (Input Tax Credit)
        const purchases = await Purchase.find({
            storeId: req.storeId,
            createdAt: { $gte: startDate, $lte: endDate },
            status: "received"
        }).sort({ createdAt: 1 });

        let input_taxable = 0;
        let input_cgst = 0;
        let input_sgst = 0;

        purchases.forEach(p => {
            input_taxable += Number(p.taxable_amount || 0);
            input_cgst += Number(p.cgst_amount || 0);
            input_sgst += Number(p.sgst_amount || 0);
        });

        // Fetch Sales (Output Tax Liability)
        const sales = await Sales.find({
            storeId: req.storeId,
            created_at: { $gte: startDate, $lte: endDate }
        }).sort({ created_at: 1 });

        let output_taxable = 0;
        let output_cgst = 0;
        let output_sgst = 0;

        sales.forEach(s => {
            output_taxable += Number(s.total_taxable || 0);
            output_cgst += Number(s.total_cgst || 0);
            output_sgst += Number(s.total_sgst || 0);
        });

        const total_input_tax = input_cgst + input_sgst;
        const total_output_tax = output_cgst + output_sgst;
        const net_gst = total_output_tax - total_input_tax;

        return res.status(200).json({
            success: true,
            summary: {
                input_taxable: Number(input_taxable.toFixed(2)),
                input_cgst: Number(input_cgst.toFixed(2)),
                input_sgst: Number(input_sgst.toFixed(2)),
                total_input_tax: Number(total_input_tax.toFixed(2)),

                output_taxable: Number(output_taxable.toFixed(2)),
                output_cgst: Number(output_cgst.toFixed(2)),
                output_sgst: Number(output_sgst.toFixed(2)),
                total_output_tax: Number(total_output_tax.toFixed(2)),

                net_gst: Number(net_gst.toFixed(2))
            },
            purchases,
            sales
        });

    } catch (error) {
        console.error("GST Summary Error:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch GST summary" });
    }
};
