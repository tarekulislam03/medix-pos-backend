import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../setup/testHelpers.js';
import { getNextShortBarcode } from '../../src/services/getNextShortBarcode.js';
import Counter from '../../src/models/counterModel.js';
import Inventory from '../../src/models/productModel.js';

describe('Barcode Generation Service - getNextShortBarcode', () => {
    const mockStoreId = new mongoose.Types.ObjectId();

    beforeAll(async () => {
        await connectTestDB();
    });

    afterAll(async () => {
        await disconnectTestDB();
    });

    beforeEach(async () => {
        await clearTestDB();
    });

    it('should generate 100001 for a new store with no inventory or counter', async () => {
        // Act
        const barcode = await getNextShortBarcode(mockStoreId);

        // Assert
        expect(barcode).toBe('100001');
        
        // Verify counter is created in DB
        const counter = await Counter.findOne({ storeId: mockStoreId });
        expect(counter).not.toBeNull();
        expect(counter.short_barcode_seq).toBe(100001);
    });

    it('should continue from highest inventory short_barcode if no counter exists', async () => {
        // Arrange
        await Inventory.create({
            storeId: mockStoreId,
            medicine_name: 'Test Med',
            mrp: 10,
            cost_price: 5,
            quantity: 10,
            short_barcode: '100500'
        });

        // Act
        const barcode = await getNextShortBarcode(mockStoreId);

        // Assert
        expect(barcode).toBe('100501');
        
        const counter = await Counter.findOne({ storeId: mockStoreId });
        expect(counter.short_barcode_seq).toBe(100501);
    });

    it('should increment the counter when it exists and is >= base', async () => {
        // Arrange
        await Counter.create({ storeId: mockStoreId, short_barcode_seq: 100200 });

        // Act
        const barcode = await getNextShortBarcode(mockStoreId);

        // Assert
        expect(barcode).toBe('100201');
        
        const counter = await Counter.findOne({ storeId: mockStoreId });
        expect(counter.short_barcode_seq).toBe(100201);
    });

    it('should sync counter to the highest inventory barcode if counter is lagging', async () => {
        // Arrange
        // Create an inventory item with a much higher short_barcode
        await Inventory.create({
            storeId: mockStoreId,
            medicine_name: 'High Barcode Med',
            mrp: 15,
            cost_price: 10,
            quantity: 10,
            short_barcode: '101000'
        });

        // Create a counter that is lower than the inventory item
        await Counter.create({ storeId: mockStoreId, short_barcode_seq: 100500 });

        // Act
        const barcode = await getNextShortBarcode(mockStoreId);

        // Assert
        expect(barcode).toBe('101001'); // It should jump to 101000 + 1
        
        const counter = await Counter.findOne({ storeId: mockStoreId });
        expect(counter.short_barcode_seq).toBe(101001);
    });

    it('should handle sequential generations properly', async () => {
        // Act
        const barcode1 = await getNextShortBarcode(mockStoreId);
        const barcode2 = await getNextShortBarcode(mockStoreId);
        const barcode3 = await getNextShortBarcode(mockStoreId);

        // Assert
        expect(barcode1).toBe('100001');
        expect(barcode2).toBe('100002');
        expect(barcode3).toBe('100003');
        
        const counter = await Counter.findOne({ storeId: mockStoreId });
        expect(counter.short_barcode_seq).toBe(100003);
    });
});
