# Technical Milestone Tasks & Development Steps

This document outlines the detailed step-by-step tasks, requirements, and acceptance criteria for the intern to implement the backend services and connect them to the React client application.

---

## Task 1: Environment Setup & Pocketbase Connection

The application must read environment variables dynamically to connect to the backend server.

### Step-by-Step Instructions:
1. **Environment Configuration**: Create a `.env` file in the project root containing:
   ```env
   VITE_POCKETBASE_URL=http://127.0.0.1:8090
   VITE_NODE_SERVER_URL=http://localhost:5000
   ```
2. **SDK Initialization**: Configure a client helper file (e.g. `src/lib/pocketbase.ts`) to initialize the SDK:
   ```typescript
   import PocketBase from 'pocketbase';
   export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL);
   ```
3. **API Client**: Configure Axios or fetch utilities to handle business logic requests directed to the Node.js API server.

---

## Task 2: Authentication Engine

Replace the current mock login logic in `AdminLogin.tsx` with a secure credentials check querying Pocketbase auth collections.

### Step-by-Step Instructions:
1. **Seeding Demo Accounts**: Open the Pocketbase Admin UI (`http://localhost:8090/_/`) and create mock accounts directly in the `users` table:
   * **Admin User**: `admin@demo.com` / password: `admin12345` (set field `role` to `'admin'`).
   * **Client User**: `priya@demo.com` / password: `client12345` (set field `role` to `'client'`).
2. **Login API Integration**: Update the sign-in form submit logic to execute auth via email and password:
   ```typescript
   const authData = await pb.collection('users').authWithPassword(email, password);
   ```
3. **Session Routing**: Retrieve the user's role metadata from the auth response and direct the session:
   * If `role === 'admin'`, route the user to the Administrator Dashboard.
   * If `role === 'client'`, route the user to the Client Portal.

---

## Task 3: Pocketbase Schema Synchronization

To ensure database schema consistency, define tables (collections) in Pocketbase and maintain them as exported JSON code in the project.

### Step-by-Step Instructions:
1. **Define Collections**: In the Pocketbase UI, create these collections matching the specified structures:
   * `licenses`: fields `id`, `name`, `client_email`, `price`, `tenure` (monthly/yearly), `status`, `expiry_date`, `device_limit`, `storage_limit`.
   * `screens`: fields `id`, `name`, `pairing_code`, `hardware_uuid`, `status`, `license_id` (relation), `assigned_playlist_id` (relation).
   * `playlists`: fields `id`, `name`, `media_files` (relation list), `durations` (JSON).
   * `media`: fields `id`, `title`, `file` (file type), `size`.
2. **Export Schema JSON**: Go to Pocketbase Admin UI -> Settings -> Export Schema. Save the generated `pb_schema.json` file inside the project root directory.
3. **Import System**: Document the deployment step for other team members to load the schema:
   `./pocketbase admin import pb_schema.json`

---

## Task 4: CRUD Actions & Onboarding Features

Develop full Create, Read, Update, and Delete (CRUD) operations on both portals, communicating directly with Pocketbase.

### Step-by-Step Instructions:
1. **User Onboarding CRUD**:
   * Build an administration view to manage accounts.
   * Creating a user must register the email and role inside the Pocketbase `users` auth collection.
2. **License Provisioning CRUD**:
   * Build the Admin License view to generate and edit client licenses.
   * Design a relation mapping licenses to users: when listing user accounts, fetch their associated licenses from the `licenses` collection and display them as a badge next to the user's name.
3. **Screen Management CRUD**:
   * In the Client Portal, implement adding, editing, and deleting screen profiles.
   * **TV Screen pairing flow**: 
     * Implement a tab toggle inside the "Add Screen" wizard.
     * *Mode 1 (TV displays code)*: Input field to receive the code shown on the TV, matching it against the `pairing_code` field in the database.
     * *Mode 2 (Portal generates code)*: Display a randomly generated 6-digit code in the wizard, saving it to the `pairing_code` field in Pocketbase for later TV entry.

---

## Task 5: Razorpay Payment Integration & Paywall Logic

Integrate Razorpay to handle portal access blockage, checkout initialization, and background payment capture webhooks.

### Step-by-Step Instructions:
1. **License Expiry Check**:
   * On client login, query the client's `licenses` record.
   * If `status === 'expired'` or `status === 'pending_payment'`, block the dashboard using a full-screen **Paywall Overlay Component**.
2. **Razorpay Checkout Modal**:
   * Add the Razorpay checkout script (`https://checkout.razorpay.com/v1/checkout.js`) inside the paywall component.
   * When the client clicks "Pay & Reactivate", invoke the Node.js API endpoint `POST /payments/create-order` to generate a Razorpay order.
   * Open the checkout overlay using the returned Order ID and the merchant keys.
3. **Verification Webhook**:
   * Write a Node.js endpoint `POST /payments/webhook` to listen to Razorpay transaction capture events (`payment.captured`).
   * When Razorpay fires the webhook:
     1. Verify the webhook cryptographic signature.
     2. Update the license status to `active` in Pocketbase.
     3. Calculate the new `expiry_date` (extend by 30 days for monthly plans, 365 days for yearly plans).
     4. Log the transaction receipt inside the `payments` collection.
   * Once updated, the real-time subscription will trigger on the TV App and client browser, instantly unblocking access.
