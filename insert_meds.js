import mongoose from 'mongoose';

const uri = "mongodb+srv://tarekul03muslim_db_user:03vIfN0HYIk8e5tb@medix-database.wmncwmr.mongodb.net/test";

const items = [
    { medicine_name: "Codesoft epo capsule", mrp: 396.86, quantity: 1, expiry_date: "2027-11-01" },
    { medicine_name: "Clavam 625", mrp: 195.47, quantity: 4, expiry_date: "2027-06-01" },
    { medicine_name: "Clavam 625", mrp: 195.47, quantity: 1, expiry_date: "2027-05-01" },
    { medicine_name: "Clavam 375", mrp: 225, quantity: 1, expiry_date: "2027-03-01" },
    { medicine_name: "Clavam 375", mrp: 225, quantity: 1, expiry_date: "2027-05-01" },
    { medicine_name: "Cilix 10 mg", mrp: 82.36, quantity: 2, expiry_date: "2027-07-01" },
    { medicine_name: "Cilix 20 mg", mrp: 140.38, quantity: 1, expiry_date: "2027-10-01" },
    { medicine_name: "Cilix 5 mg", mrp: 61.77, quantity: 3, expiry_date: "2027-10-01" },
    { medicine_name: "Chymoral Forte", mrp: 514.12, quantity: 2, expiry_date: "2028-12-01" },
    { medicine_name: "Cilapam plus tablet", mrp: 265.23, quantity: 3, expiry_date: "2027-08-01" },
    { medicine_name: "Cilapam 10 mg tablet", mrp: 144.22, quantity: 2, expiry_date: "2027-07-01" },
    { medicine_name: "Cilapam 5 mg tablet", mrp: 80.44, quantity: 2, expiry_date: "2027-05-01" },
    { medicine_name: "Cetapin XR 1000 mg", mrp: 64.73, quantity: 2, expiry_date: "2027-08-01" },
    { medicine_name: "Cetapin XR 500 mg", mrp: 48.65, quantity: 4, expiry_date: "2027-10-01" },
    { medicine_name: "Celin delicious orange", mrp: 24.73, quantity: 2, expiry_date: "2027-12-01" },
    { medicine_name: "Celin (new) 500 mg", mrp: 41.21, quantity: 1, expiry_date: "2027-11-01" },
    { medicine_name: "Cipcal 500 mg", mrp: 98.11, quantity: 1, expiry_date: "2027-09-01" },
    { medicine_name: "Cipcal 500 mg", mrp: 107.92, quantity: 2, expiry_date: "2027-10-01" },
    { medicine_name: "Cifran CT tablet", mrp: 174.38, quantity: 1, expiry_date: "2027-12-01" },
    { medicine_name: "Cifran CT tablet", mrp: 174.38, quantity: 3, expiry_date: "2028-01-01" },
    { medicine_name: "Cyra D Capsule", mrp: 47.81, quantity: 5, expiry_date: "2027-12-01" },
    { medicine_name: "Cyra D Capsule", mrp: 47.81, quantity: 3, expiry_date: "2027-11-01" },
    { medicine_name: "Cheri XT tablet", mrp: 274.69, quantity: 1, expiry_date: "2027-12-01" },
    { medicine_name: "Cospiaq M 12.5 +", mrp: 93.75, quantity: 2, expiry_date: "2027-04-01" },
    { medicine_name: "Corcuim D3 tablet", mrp: 339.50, quantity: 1, expiry_date: "2027-05-01" },
    { medicine_name: "Cheri", mrp: 201.56, quantity: 1, expiry_date: "2027-04-01" },
    { medicine_name: "Cartigen Pro", mrp: 820, quantity: 2, expiry_date: "2028-01-01" },
    { medicine_name: "Cifran CT H tablet", mrp: 96.56, quantity: 2, expiry_date: "2027-12-01" },
    { medicine_name: "Combiflam", mrp: 57.45, quantity: 1, expiry_date: "2027-11-01" },
    { medicine_name: "Carbophage XT 500", mrp: 21.46, quantity: 2, expiry_date: "2028-03-01" },
    { medicine_name: "Cilamet XL 10/25 mg", mrp: 286.88, quantity: 1, expiry_date: "2028-01-01" },
    { medicine_name: "Conflu 150 mg", mrp: 20.53, quantity: 2, expiry_date: "2028-02-01" },
    { medicine_name: "Clopitab tablet", mrp: 106.55, quantity: 2, expiry_date: "2027-03-01" },
    { medicine_name: "Cardace 1.25", mrp: 117.10, quantity: 1, expiry_date: "2028-06-01" },
    { medicine_name: "Clopivas 75 mg", mrp: 100.72, quantity: 1, expiry_date: "2027-11-01" },
    { medicine_name: "Colimex tablet", mrp: 48.43, quantity: 2, expiry_date: "2028-10-01" },
    { medicine_name: "Crina NCR 15 mg", mrp: 129.20, quantity: 2, expiry_date: "2027-10-01" },
    { medicine_name: "Crina NCR 10 mg", mrp: 212.20, quantity: 2, expiry_date: "2027-12-01" },
    { medicine_name: "Codesoft +", mrp: 292, quantity: 3, expiry_date: "2027-11-01" },
    { medicine_name: "Canditral SB 130 mg", mrp: 307.50, quantity: 1, expiry_date: "2028-02-01" },
    { medicine_name: "Canditral SB 65 mg", mrp: 157.50, quantity: 1, expiry_date: "2027-08-01" },
    { medicine_name: "Creon 10000 capsule", mrp: 796.80, quantity: 1, expiry_date: "2026-10-01" },
    { medicine_name: "Clopitab A 75 mg", mrp: 137.50, quantity: 1, expiry_date: "2027-06-01" },
    { medicine_name: "Clopitab CV 10 mg", mrp: 302.25, quantity: 1, expiry_date: "2027-11-01" },
    { medicine_name: "Carloc 3.125 mg", mrp: 68.47, quantity: 1, expiry_date: "2028-08-01" },
    { medicine_name: "Carloc 3.125 mg", mrp: 75.31, quantity: 1, expiry_date: "2029-03-01" },
    { medicine_name: "Claribid 500 mg", mrp: 425.56, quantity: 1, expiry_date: "2027-08-01" },
    { medicine_name: "CCM 40 tablets", mrp: 561.56, quantity: 1, expiry_date: "2027-08-01" },
    { medicine_name: "Cheston cold tablet", mrp: 65.79, quantity: 2, expiry_date: "2027-12-01" },
    { medicine_name: "Cypon tablet", mrp: 44.30, quantity: 6, expiry_date: "2029-03-01" },
    { medicine_name: "Ciplar LA 40 mg tablet", mrp: 123.28, quantity: 2, expiry_date: "2027-09-01" },
    { medicine_name: "Cifran 500 mg tablet", mrp: 45.28, quantity: 2, expiry_date: "2028-10-01" },
    { medicine_name: "Chymoral AP tablet", mrp: 179.25, quantity: 1, expiry_date: "2027-10-01" },
    { medicine_name: "Chymoral AP tablet", mrp: 187.31, quantity: 1, expiry_date: "2027-12-01" },
    { medicine_name: "Clonax MD 0.5 mg", mrp: 36.85, quantity: 2, expiry_date: "2028-07-01" },
    { medicine_name: "Clonax MD 0.5 mg", mrp: 21.63, quantity: 2, expiry_date: "2028-06-01" },
    { medicine_name: "Cartigen DN tablet", mrp: 277, quantity: 1, expiry_date: "2028-06-01" },
    { medicine_name: "Cartigen duo tablet", mrp: 323.44, quantity: 1, expiry_date: "2028-04-01" },
    { medicine_name: "Criz M Kid tablet", mrp: 93.75, quantity: 1, expiry_date: "2027-04-01" },
    { medicine_name: "Criz M Kid tablet", mrp: 93.75, quantity: 1, expiry_date: "2027-10-01" },
    { medicine_name: "Criz 5 mg tablet", mrp: 65.60, quantity: 1, expiry_date: "2028-11-01" },
    { medicine_name: "Criz M tablet", mrp: 178.10, quantity: 1, expiry_date: "2027-10-01" },
    { medicine_name: "Cepodem 150", mrp: 210.94, quantity: 1, expiry_date: "2028-06-01" },
    { medicine_name: "Clarigard 500 mg", mrp: 331.99, quantity: 2, expiry_date: "2029-01-01" },
    { medicine_name: "Ceftum 500 mg tablet", mrp: 549.41, quantity: 1, expiry_date: "2027-10-01" },
    { medicine_name: "Ceftum 500 mg tablet", mrp: 549.41, quantity: 1, expiry_date: "2027-08-01" },
    { medicine_name: "Ceftum tablet 250 mg", mrp: 206.34, quantity: 1, expiry_date: "2028-01-01" },
    { medicine_name: "Syndopa CR 125 mg", mrp: 29.79, quantity: 4, expiry_date: "2027-12-01" },
    { medicine_name: "Chymoral plus tablet", mrp: 224.15, quantity: 1, expiry_date: "2027-06-01" },
    { medicine_name: "Cyra tablet", mrp: 28.12, quantity: 1, expiry_date: "2027-06-01" },
    { medicine_name: "Cyra 40 mg", mrp: 56.24, quantity: 1, expiry_date: "2027-08-01" },
    { medicine_name: "Cardivas 3.125 mg", mrp: 80.16, quantity: 2, expiry_date: "2028-12-01" },
    { medicine_name: "Cardivas 3.125 mg", mrp: 80.16, quantity: 1, expiry_date: "2028-11-01" },
    { medicine_name: "Cardivas 6.25 mg", mrp: 128.44, quantity: 1, expiry_date: "2029-01-01" },
    { medicine_name: "Cardivas 12.5 mg", mrp: 151, quantity: 1, expiry_date: "2028-01-01" },
    { medicine_name: "Cardivas 25 mg", mrp: 223.13, quantity: 1, expiry_date: "2027-11-01" },
    { medicine_name: "Cardivas CR 40 mg", mrp: 261.56, quantity: 1, expiry_date: "2028-12-01" },
    { medicine_name: "Cardivas CR 20 mg", mrp: 186.56, quantity: 1, expiry_date: "2028-05-01" },
    { medicine_name: "CTD T 6.25 /40 mg", mrp: 236.95, quantity: 1, expiry_date: "2028-04-01" },
    { medicine_name: "CTD T 6.25 /40 mg", mrp: 236.95, quantity: 2, expiry_date: "2028-05-01" },
    { medicine_name: "CTD 6.25 mg tablet", mrp: 128.20, quantity: 1, expiry_date: "2027-01-01" },
    { medicine_name: "CTD 6.25 mg tablet", mrp: 128.20, quantity: 1, expiry_date: "2027-02-01" },
    { medicine_name: "Concor AM 2.5 mg", mrp: 100.63, quantity: 2, expiry_date: "2027-12-01" },
    { medicine_name: "Concor AM 2.5 mg", mrp: 100.63, quantity: 1, expiry_date: "2028-01-01" },
    { medicine_name: "Concor Cor 2.5 mg", mrp: 97.40, quantity: 1, expiry_date: "2027-11-01" },
    { medicine_name: "Concor Cor 2.5 mg", mrp: 97.40, quantity: 1, expiry_date: "2027-12-01" },
    { medicine_name: "Concor Cor 5 mg", mrp: 132.18, quantity: 1, expiry_date: "2027-10-01" },
    { medicine_name: "Concor AM 5 mg", mrp: 132.44, quantity: 3, expiry_date: "2027-11-01" },
    { medicine_name: "Cilacar C", mrp: 171.99, quantity: 1, expiry_date: "2028-10-01" },
    { medicine_name: "Cilacar 5 mg tablet", mrp: 132.17, quantity: 1, expiry_date: "2028-11-01" },
    { medicine_name: "Cilacar 5 mg tablet", mrp: 132.17, quantity: 1, expiry_date: "2028-09-01" },
    { medicine_name: "Cilacar 20 mg tablet", mrp: 332.65, quantity: 1, expiry_date: "2027-11-01" },
    { medicine_name: "Cilacar C 6.25", mrp: 151.91, quantity: 1, expiry_date: "2028-09-01" },
    { medicine_name: "Cilacar TM 50", mrp: 298.03, quantity: 1, expiry_date: "2027-11-01" },
    { medicine_name: "Cilacar T Tablet", mrp: 292.31, quantity: 2, expiry_date: "2028-01-01" },
    { medicine_name: "Cilacar T 80 mg tablet", mrp: 379.72, quantity: 1, expiry_date: "2029-01-01" },
    { medicine_name: "Cilacar TC 12.5 mg", mrp: 266.60, quantity: 1, expiry_date: "2028-12-01" },
    { medicine_name: "Cilacar T 80 mg", mrp: 379.72, quantity: 1, expiry_date: "2029-01-01" },
    { medicine_name: "Cilacar 10 mg tablet", mrp: 241.28, quantity: 1, expiry_date: "2029-03-01" },
    { medicine_name: "Cilacar T 80 mg", mrp: 379.72, quantity: 1, expiry_date: "2028-09-01" },
    { medicine_name: "Cilacar M 10/25", mrp: 225.23, quantity: 1, expiry_date: "2027-08-01" },
    { medicine_name: "Cilacar M 10/50", mrp: 275.32, quantity: 1, expiry_date: "2027-08-01" },
    { medicine_name: "Cilacar TC 6.25", mrp: 256.31, quantity: 1, expiry_date: "2028-11-01" },
    { medicine_name: "Cilacar T 20/40", mrp: 332.45, quantity: 1, expiry_date: "2027-11-01" }
];

async function run() {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB");
    
    const stores = await mongoose.connection.collection('stores').find({}).toArray();
    if (stores.length === 0) {
        console.log("No store found.");
        process.exit(1);
    }
    
    const store = stores[stores.length - 1]; 
    const storeId = store._id;
    console.log(`Using store: ${store.store_name || storeId}`);

    const Inventory = mongoose.connection.collection('inventories');
    
    // Find the current highest short_barcode
    const highestProduct = await Inventory.find({ storeId }).sort({ createdAt: -1 }).limit(100).toArray();
    let currentShortBarcode = 1000;
    
    // Better way: query for highest short barcode by sorting numeric representation, but short_barcode is string.
    // Instead of querying, let's just pick a large random number or timestamp chunk for short_barcode 
    // to avoid collision since it's a manual script.
    
    let counter = 0;
    
    for (const item of items) {
        item.storeId = storeId;
        item.createdAt = new Date();
        item.updatedAt = new Date();
        item.expiry_date = new Date(item.expiry_date);
        
        const normalizedName = item.medicine_name.toUpperCase();
        item.barcode = `${normalizedName.replace(/\s/g, '')}-${Date.now()}-${Math.floor(Math.random() * 1000)}-${counter++}`;
        item.short_barcode = (Date.now() % 1000000 + counter).toString();
        item.batch_number = 'B' + Math.random().toString(36).substring(2, 8).toUpperCase();
        
        await Inventory.insertOne(item);
    }
    
    console.log("All items imported successfully!");
    process.exit(0);
}

run().catch(console.dir);
