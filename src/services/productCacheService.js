import Inventory from "../models/productModel.js";

// ─── Global in-memory product cache ────────────────────────────────────────
// Keyed by storeId → array of lightweight product objects
// Each entry: { _id, name, nameLower, price, stock, barcode, short_barcode,
//               tablets_per_strip, cost_price, expiry_date, supplier_name }
const productCache = new Map();

let _refreshInterval = null;

/**
 * Fetch all products from the database with a lightweight query
 * and populate the in-memory cache, keyed per store.
 */
const loadProducts = async () => {
    try {
        const products = await Inventory.find({})
            .select("medicine_name mrp quantity barcode short_barcode tablets_per_strip cost_price expiry_date supplier_name storeId")
            .lean();

        // Group by storeId and normalize names to lowercase for faster search
        const grouped = new Map();

        for (const p of products) {
            const storeKey = p.storeId.toString();

            if (!grouped.has(storeKey)) {
                grouped.set(storeKey, []);
            }

            grouped.get(storeKey).push({
                _id: p._id,
                name: p.medicine_name,
                nameLower: p.medicine_name.toLowerCase(),
                price: p.mrp,
                stock: p.quantity,
                barcode: p.barcode || "",
                short_barcode: p.short_barcode || "",
                tablets_per_strip: p.tablets_per_strip || null,
                cost_price: p.cost_price || null,
                expiry_date: p.expiry_date || null,
                supplier_name: p.supplier_name || null,
            });
        }

        // Replace the entire cache atomically
        productCache.clear();
        for (const [key, val] of grouped) {
            productCache.set(key, val);
        }

        console.log(
            `[ProductCache] Loaded ${products.length} products across ${grouped.size} store(s)`
        );
    } catch (error) {
        console.error("[ProductCache] Failed to load products:", error.message);
    }
};

/**
 * Initialize the cache: load once + set up periodic refresh (every 5 min).
 * Call this once from server startup after DB is connected.
 */
const initProductCache = async () => {
    await loadProducts();

    // Refresh every 5 minutes (300 000 ms)
    _refreshInterval = setInterval(loadProducts, 5 * 60 * 1000);
    console.log("[ProductCache] Scheduled refresh every 5 minutes");
};

/**
 * Stop the periodic refresh (useful for graceful shutdown).
 */
const stopProductCacheRefresh = () => {
    if (_refreshInterval) {
        clearInterval(_refreshInterval);
        _refreshInterval = null;
    }
};

// ─── Cache-based search ────────────────────────────────────────────────────

/**
 * Search the cache for a given store.
 * @param {string} storeId
 * @param {string} query – search keyword
 * @param {number} [limit=10] – max results
 * @returns {Array} matching products (top `limit`)
 */
const searchCache = (storeId, query, limit = 10) => {
    const storeProducts = productCache.get(storeId);

    // Cache not ready or store has no products
    if (!storeProducts) return [];

    if (!query || query.trim() === "") return [];

    const q = query.trim().toLowerCase();

    const results = [];

    for (const product of storeProducts) {
        // Match by name (substring), barcode, or short_barcode
        if (
            product.nameLower.includes(q) ||
            product.barcode === query.trim() ||
            product.short_barcode === query.trim()
        ) {
            results.push({
                _id: product._id,
                medicine_name: product.name,
                mrp: product.price,
                quantity: product.stock,
                barcode: product.barcode,
                short_barcode: product.short_barcode,
                tablets_per_strip: product.tablets_per_strip,
                cost_price: product.cost_price,
                expiry_date: product.expiry_date,
                supplier_name: product.supplier_name,
            });

            if (results.length >= limit) break;
        }
    }

    return results;
};

// ─── Cache sync helpers (keep cache in sync on mutations) ──────────────────

/**
 * Add or update a product in the cache immediately.
 * @param {string} storeId
 * @param {object} product – the Mongoose document or plain object
 */
const upsertCacheEntry = (storeId, product) => {
    const key = storeId.toString();
    const entry = {
        _id: product._id,
        name: product.medicine_name,
        nameLower: product.medicine_name.toLowerCase(),
        price: product.mrp,
        stock: product.quantity,
        barcode: product.barcode || "",
        short_barcode: product.short_barcode || "",
        tablets_per_strip: product.tablets_per_strip || null,
        cost_price: product.cost_price || null,
        expiry_date: product.expiry_date || null,
        supplier_name: product.supplier_name || null,
    };

    if (!productCache.has(key)) {
        productCache.set(key, [entry]);
        return;
    }

    const list = productCache.get(key);
    const idx = list.findIndex(
        (p) => p._id.toString() === product._id.toString()
    );

    if (idx !== -1) {
        list[idx] = entry; // update in-place
    } else {
        list.push(entry); // new product
    }
};

/**
 * Remove a product from the cache immediately.
 * @param {string} storeId
 * @param {string} productId
 */
const removeCacheEntry = (storeId, productId) => {
    const key = storeId.toString();
    const list = productCache.get(key);
    if (!list) return;

    const idx = list.findIndex((p) => p._id.toString() === productId.toString());
    if (idx !== -1) {
        list.splice(idx, 1);
    }
};

export {
    productCache,
    loadProducts,
    initProductCache,
    stopProductCacheRefresh,
    searchCache,
    upsertCacheEntry,
    removeCacheEntry,
};
