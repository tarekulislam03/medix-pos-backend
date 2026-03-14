# Account Migration Plan

This plan outlines the steps to migrate an existing single-tenant account's data into the new multi-tenant system. The migration will ensure that all records are correctly scoped to a new `storeId`.

## User Review Required

> [!IMPORTANT]
> The migration requires the **Target Store ID** (which you mentioned you will provide).
> Please confirm if the source data is in JSON format, CSV, or directly in another MongoDB instance.

## Proposed Changes

The migration will be handled via a script (to be executed in the backend environment) that processes the following entities:

### 1. Store Setup
- Ensure the `Store` record exists for the provided ID.
- Verify that the target store is initialized correctly.

### 2. Inventory Migration
- **Model**: `Inventory`
- **Actions**:
  - Map old product data to the `Inventory` schema.
  - Assign the provided `storeId` to each record.
  - Handle `barcode` and `short_barcode` uniqueness within the new store.

### 3. Customer Migration
- **Model**: `Customer`
- **Actions**:
  - Map old customer data.
  - Assign `storeId`.
  - Ensure `phone_no` uniqueness per store.

### 4. Sales Migration
- **Model**: `Sales`
- **Actions**:
  - Migrate past transactions.
  - Update references: `customer` and `items.product_id` must point to the *newly created* IDs in the multi-tenant database.
  - Assign `storeId`.

### 5. Credit Migration
- **Model**: `Credit` (if applicable)
- **Actions**:
  - Migrate credit history records.
  - Link to the new `storeId` and `customerId`.

## Verification Plan

### Automated Tests
- Create a temporary migration script that:
  1. Validates schema compliance for a sample of records.
  2. Checks for cross-tenant data leakage (ensuring all records have the correct `storeId`).
  3. Verifies that count of records matches source (excluding duplicates).

### Manual Verification
- After running the migration for the specific IDs:
  - Log in as the new store owner.
  - Verify that the Dashboard reflects the correct totals.
  - Check the Inventory table for migrated products.
  - Check the Customers table for migrated clients.
