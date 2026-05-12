import Setting from "../models/settingsModel.js";

/**
 * GET /api/v1/settings
 * Returns the store settings for the authenticated user's store.
 * If no settings document exists yet, returns an empty object so the
 * frontend can fall back to its defaults.
 */
export const getSettings = async (req, res) => {
    try {
        const settings = await Setting.findOne({ storeId: req.storeId }).lean();

        if (!settings) {
            return res.status(200).json({ settings: null });
        }

        // Strip Mongo internals before sending
        const { _id, storeId, __v, createdAt, updatedAt, ...data } = settings;
        return res.status(200).json({ settings: data });
    } catch (err) {
        console.error("getSettings error:", err);
        return res.status(500).json({ message: err.message });
    }
};

/**
 * PUT /api/v1/settings
 * Creates or updates the store settings document (upsert).
 */
export const saveSettings = async (req, res) => {
    try {
        const { storeName, address, phone, gstNo, licenceNo, upiId } = req.body;

        const update = {
            storeName: storeName ?? "",
            address: address ?? "",
            phone: phone ?? "",
            gstNo: gstNo ?? "",
            licenceNo: licenceNo ?? "",
            upiId: upiId ?? "",
        };

        const settings = await Setting.findOneAndUpdate(
            { storeId: req.storeId },
            { $set: update },
            { upsert: true, new: true, runValidators: true }
        ).lean();

        const { _id, storeId, __v, createdAt, updatedAt, ...data } = settings;
        return res.status(200).json({ message: "Settings saved", settings: data });
    } catch (err) {
        console.error("saveSettings error:", err);
        return res.status(500).json({ message: err.message });
    }
};
