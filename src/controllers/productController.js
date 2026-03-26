import bwipjs from "bwip-js";
import Inventory from "../models/productModel.js";
import sharp from "sharp";
import { callVisionModel } from "../services/llmService.js";
import { safeParseJSON } from "../services/jsonParser.js";
import {
    searchCache,
    upsertCacheEntry,
    removeCacheEntry,
    loadProducts,
} from "../services/productCacheService.js";

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
            cost_price
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
            }
        });

        if (product) {

            product.quantity += cleanNumber(quantity);
            product.mrp = cleanNumber(mrp);
            product.supplier_name = supplier_name || null;
            product.expiry_date = expiry_date || null;
            product.alert_threshold = alert_threshold || null;
            product.tablets_per_strip = tablets_per_strip ? cleanNumber(tablets_per_strip) : null;
            product.cost_price = cost_price ? cleanNumber(cost_price) : null;

            await product.save();

            // Sync cache immediately
            upsertCacheEntry(req.storeId, product);

            return res.status(200).json({
                message: "Product updated",
                data: product
            });

        } else {

            const barcodeString =
                `${normalizedName.replace(/\s/g,'')}-${Date.now()}-${Math.floor(Math.random()*1000)}`;

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
                alert_threshold: alert_threshold || null,
                tablets_per_strip: tablets_per_strip ? cleanNumber(tablets_per_strip) : null,
                cost_price: cost_price ? cleanNumber(cost_price) : null
            });

            // Sync cache immediately
            upsertCacheEntry(req.storeId, product);

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

        // Sync cache immediately
        upsertCacheEntry(req.storeId, update);

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

        // Remove from cache immediately
        removeCacheEntry(req.storeId, req.params.id);

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

        // Search from in-memory cache (top 10 results)
        const results = searchCache(req.storeId.toString(), keyword, 10);

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

        //Preprocess Image (rotate + resize + force format)
        const processedBuffer = await sharp(req.file.buffer)
            .rotate()               // auto-fix orientation
            .resize({ width: 1200 }) // optimize for OCR
            .png()                   // Force output to PNG format
            .toBuffer();

        //Convert to base64
        const base64Image = processedBuffer.toString("base64");

        //Call AI
        const aiRaw = await callVisionModel(base64Image);

        const parsed = safeParseJSON(aiRaw);

        if (!parsed || !parsed.items || !Array.isArray(parsed.items)) {
            console.error("AI Response Content:", aiRaw);
            throw new Error("Invalid AI response format: missing items array");
        }

        return res.json({
            success: true,
            imported_products: parsed.items.length,
            items: parsed.items
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

        const cleanNumber = (val) =>
            Number(String(val || 0).replace(/[^\d.]/g, "")) || 0;

        console.log("Items received:", items);

        for (const item of items) {

            const medicineNameRaw = item.medicine_name || item.product_name;
            if (!medicineNameRaw) continue;

            const medicineName = medicineNameRaw.trim();
            const normalizedName = medicineName.toUpperCase();

            const barcodeString =
                `${normalizedName.replace(/\s/g, '')}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            const shortBarcodeString = await getNextShortBarcode(req.storeId);

            const result = await Inventory.findOneAndUpdate(
                {
                    storeId: req.storeId,
                    medicine_name: {
                        $regex: new RegExp(`^${escapeRegExp(normalizedName)}$`, "i")
                    }
                },
                {
                    $inc: { quantity: cleanNumber(item.quantity) },
                    $set: {
                        mrp: cleanNumber(item.mrp),
                        expiry_date: item.expiry_date || null,
                        cost_price: item.cost_price ? cleanNumber(item.cost_price) : null,
                        supplier_name: item.supplier_name || null
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
        }

        // Reload cache after bulk import to capture all new/updated products
        await loadProducts();

        return res.json({
            success: true,
            updated_products: updatedCount,
            new_products: createdCount
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
export { createProduct, getProducts, getProductById, updateProduct, deleteProduct, searchProduct, lowStock, soonToExpiry, autoImportProducts, autoImportConfirm, getLooseMedicinePrice };