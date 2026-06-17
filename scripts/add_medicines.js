import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

import Store from "../src/models/storeModel.js";
import Inventory from "../src/models/productModel.js";

const MONGO_URI = "mongodb+srv://tarekul03muslim_db_user:03vIfN0HYIk8e5tb@medix-database.wmncwmr.mongodb.net/";

const medicines = [
  { name: "Dvive total tablets", mrp: 291.70, stock: 1, expiry: "04/27" },
  { name: "Diamicron XR MEX", mrp: 351.04, stock: 1, expiry: "11/28" },
  { name: "Dolonex DT 20 mg", mrp: 268.79, stock: 1, expiry: "12/28" },
  { name: "Dailycal OK", mrp: 196.86, stock: 1, expiry: "05/27" },
  { name: "Dailycal HD Tablet", mrp: 84.37, stock: 1, expiry: "11/27" },
  { name: "Deviry 10 mg", mrp: 66.70, stock: 3, expiry: "08/28" },
  { name: "Dronis 30", mrp: 575, stock: 1, expiry: "02/28" },
  { name: "Dronis P", mrp: 480, stock: 1, expiry: "10/27" },
  { name: "Dexorange", mrp: 187.15, stock: 2, expiry: "04/27" },
  { name: "Dronis 20", mrp: 505, stock: 1, expiry: "04/28" },
  { name: "D Ventin 100 mg", mrp: 197.34, stock: 2, expiry: "11/28" },
  { name: "Deriphyllin (R) 300 mg", mrp: 64.43, stock: 1, expiry: "10/28" },
  { name: "Deriphyllin (R) 300 mg", mrp: 64.43, stock: 1, expiry: "01/29" },
  { name: "Deriphyllin (R) 150 mg", mrp: 41.85, stock: 1, expiry: "11/28" },
  { name: "Deriphyllin tablet", mrp: 25.63, stock: 2, expiry: "08/29" },
  { name: "Dalacin C 300 mg", mrp: 297.60, stock: 1, expiry: "01/30" },
  { name: "Disprin (regular) 325", mrp: 7.03, stock: 1, expiry: "12/28" },
  { name: "Defza 12 mg tablet", mrp: 304.69, stock: 1, expiry: "12/27" },
  { name: "Dubinor tablet", mrp: 268.73, stock: 1, expiry: "12/27" },
  { name: "Doxinate XT", mrp: 324.84, stock: 1, expiry: "09/28" },
  { name: "Doxinate", mrp: 285.84, stock: 1, expiry: "09/28" },
  { name: "Doxinate OD", mrp: 462.70, stock: 1, expiry: "09/28" },
  { name: "Doxinate Plus", mrp: 317.16, stock: 1, expiry: "08/28" },
  { name: "Doxinate Forte", mrp: 210.80, stock: 1, expiry: "07/28" },
  { name: "Doxinate G", mrp: 125.91, stock: 1, expiry: "08/29" },
  { name: "Defza 24 mg tablet", mrp: 319.68, stock: 1, expiry: "10/28" },
  { name: "Defza 30 mg tablet", mrp: 382.50, stock: 1, expiry: "01/29" },
  { name: "Defza 6 mg tablet", mrp: 164.06, stock: 1, expiry: "02/29" }
];

function parseExpiry(expiryStr) {
  const parts = expiryStr.split('/');
  if(parts.length !== 2) return null;
  const month = parseInt(parts[0], 10);
  const year = 2000 + parseInt(parts[1], 10);
  return new Date(year, month, 0); // last day of month
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");
  
  const stores = await Store.find();
  if (stores.length === 0) {
    console.log("No store found!");
    process.exit(1);
  }
  const storeId = stores[0]._id;
  console.log("Using Store ID:", storeId);

  let successCount = 0;
  for (const med of medicines) {
    const expiryDate = parseExpiry(med.expiry);
    
    // Check if it exists with same mrp/expiry/name to avoid duplicates?
    // Or just create it
    const newMed = new Inventory({
      medicine_name: med.name,
      mrp: med.mrp,
      quantity: med.stock,
      expiry_date: expiryDate,
      storeId: storeId
    });
    
    // we need to set a barcode. Usually the backend generates short_barcode or barcode.
    // wait, what is the default logic in backend for creating products?
    // Let's just create them. If barcode is required, we can generate a random one.
    
    await newMed.save();
    successCount++;
    console.log("Added", med.name);
  }

  console.log("Successfully added", successCount, "medicines.");
  process.exit(0);
}

run().catch(console.error);
