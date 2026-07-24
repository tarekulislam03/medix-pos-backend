import jwt from "jsonwebtoken";
import xlsx from "xlsx";
import MasterMedicine from "../models/masterMedicineModel.js";

// @desc    Admin login
// @route   POST /api/v1/master-medicines/login
// @access  Public
export const adminLogin = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (
            username === process.env.ADMIN_USERNAME &&
            password === process.env.ADMIN_PASSWORD
        ) {
            const token = jwt.sign(
                { isAdmin: true, username },
                process.env.ADMIN_JWT_SECRET,
                { expiresIn: "24h" }
            );
            res.json({ success: true, token });
        } else {
            res.status(401).json({ success: false, message: "Invalid credentials" });
        }
    } catch (error) {
        console.error("adminLogin error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// @desc    Get master medicines (paginated + search)
// @route   GET /api/v1/master-medicines
// @access  Admin
export const getMasterMedicines = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || "";

        let query = {};
        if (search) {
            query.medicine_name = { $regex: search, $options: "i" };
        }

        const count = await MasterMedicine.countDocuments(query);
        const data = await MasterMedicine.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({
            success: true,
            data,
            total: count,
            page,
            pages: Math.ceil(count / limit),
        });
    } catch (error) {
        console.error("getMasterMedicines error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// @desc    Add a single master medicine
// @route   POST /api/v1/master-medicines
// @access  Admin
export const addMasterMedicine = async (req, res) => {
    try {
        const { medicine_name, mrp } = req.body;

        if (!medicine_name || mrp === undefined) {
            return res.status(400).json({ success: false, message: "Please provide medicine_name and mrp" });
        }

        const normalizedName = medicine_name.trim().toUpperCase();

        const existing = await MasterMedicine.findOne({ medicine_name: normalizedName });
        if (existing) {
            return res.status(400).json({ success: false, message: "Medicine already exists" });
        }

        const newMedicine = await MasterMedicine.create({
            medicine_name: normalizedName,
            mrp: Number(mrp),
        });

        res.status(201).json({ success: true, data: newMedicine });
    } catch (error) {
        console.error("addMasterMedicine error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// @desc    Update a master medicine
// @route   PUT /api/v1/master-medicines/:id
// @access  Admin
export const updateMasterMedicine = async (req, res) => {
    try {
        const { medicine_name, mrp } = req.body;
        const medicine = await MasterMedicine.findById(req.params.id);

        if (!medicine) {
            return res.status(404).json({ success: false, message: "Medicine not found" });
        }

        if (medicine_name) {
            medicine.medicine_name = medicine_name.trim().toUpperCase();
        }
        if (mrp !== undefined) {
            medicine.mrp = Number(mrp);
        }

        const updatedMedicine = await medicine.save();
        res.json({ success: true, data: updatedMedicine });
    } catch (error) {
        console.error("updateMasterMedicine error:", error);
        // Catch duplicate key error
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Medicine name already exists" });
        }
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// @desc    Delete a master medicine
// @route   DELETE /api/v1/master-medicines/:id
// @access  Admin
export const deleteMasterMedicine = async (req, res) => {
    try {
        const medicine = await MasterMedicine.findByIdAndDelete(req.params.id);

        if (!medicine) {
            return res.status(404).json({ success: false, message: "Medicine not found" });
        }

        res.json({ success: true, message: "Medicine deleted" });
    } catch (error) {
        console.error("deleteMasterMedicine error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// @desc    Import master medicines from CSV/Excel
// @route   POST /api/v1/master-medicines/import
// @access  Admin
export const importMasterMedicines = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet);

        if (!rows || rows.length === 0) {
            return res.status(400).json({ success: false, message: "File is empty or invalid" });
        }

        let inserted = 0;
        let updated = 0;
        let errors = 0;

        const bulkOps = [];

        for (const row of rows) {
            const name = row.medicine_name || row.product_name || row.name;
            const price = row.mrp || row.price;

            if (name && price !== undefined) {
                const normalizedName = String(name).trim().toUpperCase();
                const numericPrice = Number(price);

                if (normalizedName && !isNaN(numericPrice)) {
                    bulkOps.push({
                        updateOne: {
                            filter: { medicine_name: normalizedName },
                            update: { $set: { medicine_name: normalizedName, mrp: numericPrice } },
                            upsert: true,
                        },
                    });
                } else {
                    errors++;
                }
            } else {
                errors++;
            }
        }

        if (bulkOps.length > 0) {
            const result = await MasterMedicine.bulkWrite(bulkOps);
            inserted = result.upsertedCount || 0;
            updated = result.modifiedCount || 0;
        }

        res.json({
            success: true,
            data: {
                inserted,
                updated,
                errors,
                totalProcessed: rows.length,
            },
        });
    } catch (error) {
        console.error("importMasterMedicines error:", error);
        res.status(500).json({ success: false, message: "Server error during import" });
    }
};

// @desc    Public search for pharmacy users
// @route   GET /api/v1/master-medicines/search
// @access  Private (Store user)
export const searchMasterMedicinesPublic = async (req, res) => {
    try {
        const query = req.query.query || "";
        if (!query || query.length < 2) {
            return res.json({ success: true, data: [] });
        }

        const data = await MasterMedicine.find({
            medicine_name: { $regex: query, $options: "i" },
        })
            .limit(50)
            .sort({ medicine_name: 1 })
            .select("-createdAt -updatedAt -__v");

        res.json({ success: true, data });
    } catch (error) {
        console.error("searchMasterMedicinesPublic error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
