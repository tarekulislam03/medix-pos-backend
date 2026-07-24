import { jest } from '@jest/globals';

jest.unstable_mockModule('axios', () => {
  return {
    default: {
      post: jest.fn().mockResolvedValue({
        data: {
          secure_url: 'https://res.cloudinary.com/mock/image.jpg',
          public_id: 'mock_public_id'
        }
      })
    }
  };
});

const request = (await import('supertest')).default;
const app = (await import('../../src/app.js')).default;
const {
  connectTestDB,
  disconnectTestDB,
  clearTestDB,
  generateTestToken,
  setTestEnv
} = await import('../setup/testHelpers.js');
const { IDS, seedDatabase } = await import('../fixtures/seedData.js');
const Purchase = (await import('../../src/features/purchase/models/purchaseModel.js')).default;
const Store = (await import('../../src/features/store/models/storeModel.js')).default;
const User = (await import('../../src/features/user/models/userModel.js')).default;
const Customer = (await import('../../src/features/customer/models/customerModel.js')).default;
const Inventory = (await import('../../src/features/product/models/productModel.js')).default;

const models = { Store, User, Customer, Inventory };

describe('Purchase API Integration', () => {
  let token;

  beforeAll(async () => {
    setTestEnv();
    // Provide dummy cloudinary credentials to bypass the validation
    process.env.CLOUDINARY_CLOUD_NAME = 'dummy_cloud';
    process.env.CLOUDINARY_API_KEY = 'dummy_key';
    process.env.CLOUDINARY_API_SECRET = 'dummy_secret';

    await connectTestDB();
    token = generateTestToken(IDS.user, IDS.store);
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    await seedDatabase(models);
  });

  describe('CRUD operations for Purchases under /api/v1/purchase', () => {
    let createdPurchaseId;

    it('should upload a bill and create a purchase record', async () => {
      const res = await request(app)
        .post('/api/v1/purchase/upload-bill')
        .set('Authorization', `Bearer ${token}`)
        .field('supplier_name', 'Mock Supplier')
        .field('notes', 'Test notes')
        .field('total_amount', '1000')
        .attach('bill', Buffer.from('mock image content'), 'bill.jpg');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.supplier_name).toBe('Mock Supplier');
      expect(res.body.data.total_amount).toBe(1000);
      expect(res.body.data.bill_image_url).toBe('https://res.cloudinary.com/mock/image.jpg');

      createdPurchaseId = res.body.data._id;
    });

    it('should list all purchases for the store', async () => {
      // First, create a purchase directly in DB
      await Purchase.create({
        storeId: IDS.store,
        supplier_name: 'Existing Supplier',
        total_amount: 500,
        source: 'manual',
        status: 'pending'
      });

      const res = await request(app)
        .get('/api/v1/purchase/')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].supplier_name).toBe('Existing Supplier');
    });

    it('should finalize a purchase', async () => {
      // Setup a pending purchase
      const purchase = await Purchase.create({
        storeId: IDS.store,
        status: 'pending',
        supplier_name: 'Temp Supplier'
      });

      const finalizePayload = {
        supplier_name: 'Final Supplier',
        total_amount: 1500,
        items_count: 3,
        imported_items: [
          { inventoryId: IDS.product1, quantity: 10, mrp: 30 }
        ]
      };

      const res = await request(app)
        .patch(`/api/v1/purchase/${purchase._id}/finalize`)
        .set('Authorization', `Bearer ${token}`)
        .send(finalizePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('received');
      expect(res.body.data.supplier_name).toBe('Final Supplier');
      expect(res.body.data.total_amount).toBe(1500);
      expect(res.body.data.items_count).toBe(3);
      expect(res.body.data.imported_items).toHaveLength(1);

      // Verify in DB
      const dbPurchase = await Purchase.findById(purchase._id);
      expect(dbPurchase.status).toBe('received');
      expect(dbPurchase.total_amount).toBe(1500);
    });

    it('should delete a purchase', async () => {
      const purchase = await Purchase.create({
        storeId: IDS.store,
        supplier_name: 'To Be Deleted'
      });

      const res = await request(app)
        .delete(`/api/v1/purchase/${purchase._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Purchase deleted');

      const dbPurchase = await Purchase.findById(purchase._id);
      expect(dbPurchase).toBeNull();
    });

    it('should return 404 when deleting a non-existent purchase', async () => {
      const fakeId = '507f1f77bcf86cd799439011'; // valid ObjectId, not in DB
      const res = await request(app)
        .delete(`/api/v1/purchase/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Purchase not found');
    });

    it('should reject bill upload if no image provided', async () => {
      const res = await request(app)
        .post('/api/v1/purchase/upload-bill')
        .set('Authorization', `Bearer ${token}`)
        .field('supplier_name', 'Mock Supplier');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/No bill image provided/);
    });
  });
});
