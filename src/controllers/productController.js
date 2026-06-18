import bwipjs from "bwip-js";
import Inventory from "../models/productModel.js";
import { callVisionModel } from "../services/llmService.js";
import { safeParseJSON } from "../services/jsonParser.js";
import { optimizeInvoiceImage } from "../services/imageOptimizer.js";

import { uploadToCloudinary } from "./purchaseController.js";
import Purchase from "../models/purchaseModel.js";

const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const getNextShortBarcode = async (storeId) => {
    const lastProduct = await Inventory.findOne({ storeId, short_barcode: { $exists: true } })
        .sort({ short_barcode: -1 })
        .collation({ locale: "en_US", numericOrdering: true });

    if (lastProduct && lastProduct.short_barcode && !isNaN(lastProduct.short_barcode)) {
        return (parseInt(lastProduct.short_barcode, 10) + 1).toString();
    }
    return "100001";
};

// Create product
const createProduct = async (req, res) => {
    try {
        const {
            medicine_name,
            mrp,
            quantity,
            supplier_name,
            expiry_date,
            alert_threshold,
            tablets_per_strip,
            cost_price,
            batch_number,
            hsn_code,
            gst
        } = req.body;

        if (!medicine_name || !mrp || !quantity) {
            return res.status(400).json({
                message: "medicine_name, mrp and quantity are required"
            });
        }

        const cleanNumber = (val) =>
            Number(String(val || 0).replace(/[^\d.]/g, "")) || 0;

        const normalizedName = medicine_name.trim().toUpperCase();

        let product = await Inventory.findOne({
            storeId: req.storeId,
            medicine_name: {
                $regex: new RegExp(`^${escapeRegExp(normalizedName)}$`, "i")
            },
            batch_number: batch_number || ""
        });

        if (product) {

            product.quantity += cleanNumber(quantity);
            product.mrp = cleanNumber(mrp);
            product.supplier_name = supplier_name || null;
            product.expiry_date = expiry_date || null;
            product.alert_threshold = alert_threshold || 2;
            product.tablets_per_strip = tablets_per_strip ? cleanNumber(tablets_per_strip) : null;
            product.cost_price = cost_price ? cleanNumber(cost_price) : null;
            product.batch_number = batch_number || "";
            product.hsn_code = hsn_code || "";
            product.gst = gst ? cleanNumber(gst) : 0;

            await product.save();



            return res.status(200).json({
                message: "Product updated",
                data: product
            });

        } else {

            const barcodeString =
                `${normalizedName.replace(/\s/g, '')}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            const shortBarcodeString = await getNextShortBarcode(req.storeId);

            product = await Inventory.create({
                storeId: req.storeId,
                medicine_name: normalizedName,
                barcode: barcodeString,
                short_barcode: shortBarcodeString,
                mrp: cleanNumber(mrp),
                quantity: cleanNumber(quantity),
                supplier_name: supplier_name || null,
                expiry_date: expiry_date || null,
                alert_threshold: alert_threshold || 2,
                tablets_per_strip: tablets_per_strip ? cleanNumber(tablets_per_strip) : null,
                cost_price: cost_price ? cleanNumber(cost_price) : null,
                batch_number: batch_number || "",
                hsn_code: hsn_code || "",
                gst: gst ? cleanNumber(gst) : 0
            });



            return res.status(201).json({
                message: "Product created",
                data: product
            });
        }

    } catch (error) {

        if (error.code === 11000) {
            return res.status(409).json({
                message: "Duplicate barcode prevented"
            });
        }

        console.error("Create Product Error:", error);

        return res.status(500).json({
            message: error.message
        });
    }
};


// Get all Products
const getProducts = async (req, res) => {
    try {

        const product = await Inventory.find({ storeId: req.storeId });

        if (!product) {
            return res.status(400).json({
                message: "No  products found"
            })
        }

        res.status(200).json({
            message: "Products fetched successfully!",
            count: `Total Products - ${product.length}`,
            data: product
        })


    } catch (error) {
        res.status(500).json({
            message: "Internal Server Error"
        })
    }
}

// get a product by id
const getProductById = async (req, res) => {
    try {

        const product = await Inventory.findOne({ _id: req.params.id, storeId: req.storeId });

        if (!product) {
            return res.status(400).json({
                message: "No  products found"
            })
        }

        res.status(200).json({
            message: "Product fetched successfully!",
            data: product
        })

    } catch (error) {
        res.status(500).json({
            message: "Internal Server Error"
        })
    }
}

// Update product by id
const updateProduct = async (req, res) => {
    try {

        const update = await Inventory.findOneAndUpdate(
            { _id: req.params.id, storeId: req.storeId },
            req.body,
            { new: true }
        );

        if (!update) {
            return res.status(400).json({
                message: "No products found"
            })
        }

        res.status(200).json({
            message: "Product updated successfully!",
            data: update
        })


    } catch (error) {
        res.status(500).json({
            message: "Internal Server Error"
        })
    }
}

// Delete Product
const deleteProduct = async (req, res) => {
    try {

        const deleteitems = await Inventory.findOneAndDelete({ _id: req.params.id, storeId: req.storeId });

        if (!deleteitems) {
            return res.status(400).json({
                message: "No products found"
            })
        }

        res.status(200).json({
            message: "Product delted successfully!",
        })


    } catch (error) {
        res.status(500).json({
            message: "Internal Server Error",
            data: error
        })
    }
}

// Search Products (in-memory cache — zero DB queries)

const searchProduct = async (req, res) => {
    try {
        const keyword = req.query.keyword || req.query.q || "";

        // Handle empty or missing query
        if (!keyword || keyword.trim() === "") {
            return res.status(200).json({
                count: "0 products found",
                data: [],
            });
        }

        // Search from MongoDB directly
        const queryRegex = new RegExp(escapeRegExp(keyword), 'i');
        const results = await Inventory.find({
            storeId: req.storeId,
            $or: [
                { medicine_name: queryRegex },
                { short_barcode: queryRegex },
                { batch_number: queryRegex },
                { barcode: queryRegex }
            ]
        }).limit(10).lean();

        return res.status(200).json({
            count: `${results.length} products found for this keyword`,
            data: results,
        });

    } catch (error) {
        console.error("Search error:", error);
        res.status(500).json({
            message: "Internal Server Error",
            data: error.message,
        });
    }
}

const lowStock = async (req, res) => {
    try {

        // find low stock products ( quantity <= alert_threshold )
        const low = await Inventory.find({
            storeId: req.storeId,
            returned_to_supplier: { $ne: true },
            $expr: { $lte: ["$quantity", "$alert_threshold"] }
        })

        if (low) {
            return res.status(200).json({
                count: `Total Low Stock Products - ${low.length}`,
                data: low
            })
        }
    } catch (error) {
        res.status(500).json({
            message: "Internal Server Error"
        })
    }
}

// Soon to expiry products
const soonToExpiry = async (req, res) => {
    try {

        const today = new Date();
        const next90Days = new Date();
        next90Days.setDate(today.getDate() + 90);


        const expiry = await Inventory.find({
            storeId: req.storeId,
            returned_to_supplier: { $ne: true },
            expiry_date: { $lte: next90Days }
        })

        if (expiry) {
            res.status(200).json({
                count: `Total Soon to Expiry Products - ${expiry.length}`,
                data: expiry
            })
        }

    } catch (error) {

    }
}


// Get loose medicine price per tablet
const getLooseMedicinePrice = async (req, res) => {
    try {
        const { id } = req.params;
        const { quantity } = req.query; // optional: number of tablets requested

        const product = await Inventory.findOne({ _id: id, storeId: req.storeId });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        if (!product.tablets_per_strip || product.tablets_per_strip <= 0) {
            return res.status(400).json({
                success: false,
                message: "This product is not configured for loose sale. Please set tablets_per_strip."
            });
        }

        const pricePerTablet = Number((product.mrp / product.tablets_per_strip).toFixed(2));

        const requestedQty = quantity ? Number(quantity) : null;
        const totalPrice = requestedQty
            ? Number((pricePerTablet * requestedQty).toFixed(2))
            : null;

        return res.status(200).json({
            success: true,
            medicine_name: product.medicine_name,
            mrp_per_strip: product.mrp,
            tablets_per_strip: product.tablets_per_strip,
            price_per_tablet: pricePerTablet,
            ...(requestedQty && {
                requested_tablets: requestedQty,
                total_price: totalPrice
            })
        });

    } catch (error) {
        console.error("Loose Medicine Price Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// auto product import from bill image using AI
const autoImportProducts = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No image uploaded"
            });
        }

        // Keep the original buffer for Cloudinary (before sharp resizes it)
        const originalBuffer = req.file.buffer;
        const originalName = req.file.originalname;
        const originalMime = req.file.mimetype;

        // Preprocess and Optimize Image
        let optimizedImage;
        try {
            optimizedImage = await optimizeInvoiceImage(originalBuffer, originalMime);
        } catch (optimizeError) {
            return res.status(400).json({
                success: false,
                message: optimizeError.message
            });
        }

        // Call AI
        const aiRaw = await callVisionModel(optimizedImage.base64, optimizedImage.mimeType);

        const parsed = safeParseJSON(aiRaw);

        if (!parsed || !parsed.items || !Array.isArray(parsed.items)) {
            console.error("AI Response Content:", aiRaw);
            throw new Error("Invalid AI response format: missing items array");
        }

        const items = parsed.items;

        const metadata = {
            supplier_name: parsed.supplier_name || "",
            supplier_gstin: parsed.supplier_gstin || "",
            invoice_no: parsed.invoice_no || "",
            invoice_date: parsed.invoice_date || "",
            taxable_amount: Number(parsed.taxable_amount) || 0,
            cgst_amount: Number(parsed.cgst_amount) || 0,
            sgst_amount: Number(parsed.sgst_amount) || 0,
        };

        // ── Fire-and-forget: upload original bill to Cloudinary + create Purchase record ──
        // We do NOT await this — a Cloudinary failure must never block the user's import.
        let pendingPurchaseId = null;
        try {
            const { secure_url, public_id } = await uploadToCloudinary(
                originalBuffer,
                originalName,
                originalMime
            );

            const purchase = await Purchase.create({
                storeId: req.storeId,
                bill_image_url: secure_url,
                cloudinary_public_id: public_id,
                supplier_name: metadata.supplier_name,
                supplier_gstin: metadata.supplier_gstin,
                bill_no: metadata.invoice_no,
                bill_date: metadata.invoice_date,
                taxable_amount: metadata.taxable_amount,
                cgst_amount: metadata.cgst_amount,
                sgst_amount: metadata.sgst_amount,
                items_count: items.length,
                source: "auto_import",
                status: "pending",   // becomes 'received' after confirm
            });


            pendingPurchaseId = purchase._id.toString();
        } catch (cloudErr) {
            // Non-fatal — log and continue. Purchase record creation is best-effort.
            console.warn("[AutoImport] Cloudinary/Purchase record creation failed (non-fatal):", cloudErr.message);
        }

        return res.json({
            success: true,
            imported_products: items.length,
            metadata,
            items,
            purchase_id: pendingPurchaseId,   // null if Cloudinary failed — frontend handles gracefully
        });

    } catch (error) {
        console.error("FULL ERROR:", error);
        console.error("ERROR RESPONSE:", error.response?.data);

        return res.status(500).json({
            success: false,
            message: "Auto import failed",
            error: error.response?.data || error.message
        });
    }
}


const autoImportConfirm = async (req, res) => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items)) {
            return res.status(400).json({
                success: false,
                message: "Invalid items format"
            });
        }

        let updatedCount = 0;
        let createdCount = 0;
        let importedItemsList = [];

        const cleanNumber = (val) =>
            Number(String(val || 0).replace(/[^\d.]/g, "")) || 0;

        console.log("Items received:", items);

        let currentShortBarcode = parseInt(await getNextShortBarcode(req.storeId), 10);

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            const medicineNameRaw = item.medicine_name || item.product_name;
            if (!medicineNameRaw) continue;

            const medicineName = medicineNameRaw.trim();
            const normalizedName = medicineName.toUpperCase();

            const barcodeString =
                `${normalizedName.replace(/\s/g, '')}-${Date.now()}-${Math.floor(Math.random() * 100000)}-${i}`;

            const shortBarcodeString = currentShortBarcode.toString();
            currentShortBarcode++;

            const result = await Inventory.findOneAndUpdate(
                {
                    storeId: req.storeId,
                    medicine_name: {
                        $regex: new RegExp(`^${escapeRegExp(normalizedName)}$`, "i")
                    },
                    batch_number: item.batch_number || ""
                },
                {
                    $inc: { quantity: cleanNumber(item.quantity) },
                    $set: {
                        mrp: cleanNumber(item.mrp),
                        expiry_date: item.expiry_date || null,
                        cost_price: item.cost_price ? cleanNumber(item.cost_price) : null,
                        supplier_name: item.supplier_name || null,
                        batch_number: item.batch_number || "",
                        hsn_code: item.hsn_code || "",
                        gst: item.gst ? cleanNumber(item.gst) : 0
                    },
                    $setOnInsert: {
                        storeId: req.storeId,
                        medicine_name: normalizedName,
                        barcode: barcodeString,
                        short_barcode: shortBarcodeString,
                        alert_threshold: item.alert_threshold || null
                    }
                },
                {
                    new: true,
                    upsert: true,
                    includeResultMetadata: true
                }
            );

            if (result?.lastErrorObject?.upserted) {
                createdCount++;
            } else {
                updatedCount++;
            }

            // Collect the processed item to link to the Purchase record
            if (result.value && result.value._id) {
                importedItemsList.push({
                    inventoryId: result.value._id,
                    quantity: cleanNumber(item.quantity),
                    mrp: cleanNumber(item.mrp)
                });
            }
        }


        return res.json({
            success: true,
            updated_products: updatedCount,
            new_products: createdCount,
            imported_items: importedItemsList
        });

    } catch (error) {
        console.error("Confirm Import Error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Duplicate barcode prevented"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Confirm import failed",
            error: error.message
        });
    }
};
// @desc    Bulk add products from master database
// @route   POST /api/v1/product/bulk-from-master
// @access  Private
const bulkAddFromMaster = async (req, res) => {
    try {
        const { items } = req.body;
        
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: "No items provided" });
        }

        const storeId = req.storeId;
        const added = [];
        const skipped = [];

        let currentShortBarcode = parseInt(await getNextShortBarcode(storeId), 10);

        for (const item of items) {
            const normalizedName = String(item.medicine_name || "").trim().toUpperCase();
            
            if (!normalizedName) {
                skipped.push({ medicine_name: "UNKNOWN", reason: "Empty name" });
                continue;
            }

            // Check if it already exists for this store
            const existing = await Inventory.findOne({ 
                storeId, 
                medicine_name: normalizedName 
            }).collation({ locale: "en", strength: 2 });

            if (existing) {
                const stockToAdd = item.stock ? Number(item.stock) : 0;
                let updated = false;

                if (!isNaN(stockToAdd) && stockToAdd > 0) {
                    existing.quantity = (existing.quantity || 0) + stockToAdd;
                    updated = true;
                }

                if (item.mrp !== undefined && item.mrp !== "" && !isNaN(Number(item.mrp)) && Number(item.mrp) !== existing.mrp) {
                    existing.mrp = Number(item.mrp);
                    updated = true;
                }

                let validExpiry = null;
                if (item.expiry_date) {
                    const d = new Date(item.expiry_date);
                    if (!isNaN(d.getTime())) {
                        validExpiry = d;
                    }
                }

                if (validExpiry) {
                    existing.expiry_date = validExpiry;
                    updated = true;
                }

                if (updated) {
                    await existing.save();
                    added.push(existing);
                } else {
                    skipped.push({ medicine_name: normalizedName, reason: "Already exists and no changes made" });
                }
                continue;
            }

            const barcodeString = `${normalizedName.replace(/\s/g, '')}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const shortBarcodeString = currentShortBarcode.toString();
            currentShortBarcode++;

            const batchNumber = 'B' + Math.random().toString(36).substring(2, 8).toUpperCase();

            let validExpiry = null;
            if (item.expiry_date) {
                const d = new Date(item.expiry_date);
                if (!isNaN(d.getTime())) {
                    validExpiry = d;
                }
            }

            const newProduct = await Inventory.create({
                storeId,
                medicine_name: normalizedName,
                mrp: Number(item.mrp || 0),
                quantity: item.stock ? Number(item.stock) : 0,
                gst: 5,
                barcode: barcodeString,
                short_barcode: shortBarcodeString,
                batch_number: batchNumber,
                ...(validExpiry ? { expiry_date: validExpiry } : {})
            });


            added.push(newProduct);
        }

        res.status(201).json({
            success: true,
            added,
            skipped,
            message: `Added ${added.length} products, skipped ${skipped.length}`
        });
    } catch (error) {
        console.error("bulkAddFromMaster error:", error);
        res.status(500).json({ success: false, message: "Server error during bulk add" });
    }
};

export { createProduct, getProducts, getProductById, updateProduct, deleteProduct, searchProduct, lowStock, soonToExpiry, autoImportProducts, autoImportConfirm, getLooseMedicinePrice, bulkAddFromMaster };
