import Inventory from "../models/productModel.js";
import { generateBarcodeBuffer } from "../services/generateLabel.js";
import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';


// Single product barcode image gen
export const getSingleBarcode = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Inventory.findOne({ _id: id, storeId: req.storeId });
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // 58mm width ≈ 164 points
        const doc = new PDFDocument({
            size: [164, 250],  // width, height in points
            margin: 10
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `inline; filename=${product.barcode}.pdf`
        );

        doc.pipe(res);

        // Generate barcode image
        const barcodeBuffer = await bwipjs.toBuffer({
            bcid: 'code128',
            text: product.short_barcode || product.barcode,
            scale: 2,
            height: 15,
            includetext: true,
            textxalign: 'center',
        });

        // Product Name
        doc.fontSize(10)
            .text(product.medicine_name, {
                align: 'center'
            });

        doc.moveDown(0.5);

        // Barcode
        doc.image(barcodeBuffer, {
            fit: [140, 80],
            align: 'center'
        });

        doc.moveDown(0.5);

        // MRP
        doc.fontSize(10)
            .text(`MRP: ₹${product.mrp}`, {
                align: 'center'
            });

        doc.end();

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Bulk barcode label pdf gen
export const generateLabels = async (req, res) => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                message: "Items required"
            });
        }

        // 58mm thermal width
        const doc = new PDFDocument({
            size: [164, 2000],
            margin: 8
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            'inline; filename=thermal-labels.pdf'
        );

        doc.pipe(res);

        for (const entry of items) {

            const product = await Inventory.findOne({ _id: entry.productId, storeId: req.storeId });
            if (!product) continue;

            const copies = entry.copies || 1;

            for (let i = 0; i < copies; i++) {

                // Product Name
                doc.fontSize(10)
                    .text(product.medicine_name, {
                        align: 'center'
                    });

                doc.moveDown(0.3);

                // Barcode
                const barcodeBuffer = await bwipjs.toBuffer({
                    bcid: 'code128',
                    text: product.short_barcode || product.barcode,
                    scale: 2,
                    height: 15,
                    includetext: true,
                    textxalign: 'center',
                });

                doc.image(barcodeBuffer, {
                    fit: [140, 80],
                    align: 'center'
                });

                doc.moveDown(0.3);

                doc.fontSize(10)
                    .text(`MRP: ₹${product.mrp}`, {
                        align: 'center'
                    });

                doc.moveDown(0.8);

                // Separator
                doc.moveTo(8, doc.y)
                    .lineTo(156, doc.y)
                    .stroke();

                doc.moveDown(0.8);
            }
        }

        doc.end();

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};