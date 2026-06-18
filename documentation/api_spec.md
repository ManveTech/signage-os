# SignageOS Technologies — Node.js API Specification

This document defines the REST API endpoints, request/response models, and webhook signatures required to power both the **Administrator Dashboard** and the **Client/User Portal**. 

* **Base URL**: `http://localhost:5000/api/v1`
* **Data Store**: Pocketbase (interfaced via Node.js SDK / REST calls)

---

## 1. Authentication & Session APIs

### 1.1 Login Profile
Verifies credentials and issues a JWT token containing role assignments (`admin` or `client`).
* **Endpoint**: `POST /auth/login`
* **Request Header**: `Content-Type: application/json`
* **Request Payload**:
  ```json
  {
    "email": "admin@demo.com",
    "password": "secure_password_hash"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": "usr_948201",
      "email": "admin@demo.com",
      "name": "Super Admin",
      "role": "admin",
      "organizationId": null
    }
  }
  ```

---

## 2. User Management APIs (Admin Dashboard Only)

### 2.1 Fetch All Users
Retrieves client accounts and managers.
* **Endpoint**: `GET /users`
* **Query Parameters**: `role` (optional: `client` | `admin`), `orgId` (optional)
* **Success Response (200 OK)**:
  ```json
  [
    {
      "id": "usr_981245",
      "name": "Priya Sharma",
      "email": "priya@demo.com",
      "role": "client",
      "organizationId": "org_demo_1",
      "createdAt": "2026-05-30T10:00:00Z"
    }
  ]
  ```

### 2.2 Create User Profile
* **Endpoint**: `POST /users`
* **Request Payload**:
  ```json
  {
    "name": "Anil Thomas",
    "email": "anil@demo.com",
    "role": "client",
    "organizationId": "org_demo_4"
  }
  ```
* **Success Response (201 Created)**:
  ```json
  {
    "id": "usr_783921",
    "name": "Anil Thomas",
    "email": "anil@demo.com",
    "role": "client",
    "organizationId": "org_demo_4",
    "createdAt": "2026-06-03T02:00:00Z"
  }
  ```

---

## 3. Screen/Device Control APIs

### 3.1 Pair New TV Screen
Associates a physical TV player with a client's active license slot using the 6-digit code.
* **Endpoint**: `POST /screens/pair`
* **Request Payload**:
  ```json
  {
    "pairingCode": "SG-4920",
    "name": "Mall West wing Gate 2",
    "orientation": "landscape",
    "size": "55\"",
    "resolution": "1920x1080",
    "os": "android",
    "timezone": "Asia/Kolkata",
    "groupId": "grp_lobby_displays"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "id": "scr_89201948",
    "name": "Mall West wing Gate 2",
    "status": "active",
    "hardwareUuid": "hw_f8392-1a2b-3c4d",
    "licenseId": "LIC-001",
    "assignedPlaylistId": "play_normal_loop"
  }
  ```

### 3.2 TV App Sync/Poll Endpoint
Called by the TV player application to pull config updates.
* **Endpoint**: `GET /devices/sync`
* **Headers**: `Authorization: Bearer <device_auth_token>`
* **Success Response (200 OK)**:
  ```json
  {
    "status": "active",
    "licenseStatus": "active",
    "playlist": {
      "id": "play_normal_loop",
      "assets": [
        { "url": "https://pocketbase.url/files/menu-flyer.png", "duration": 15 },
        { "url": "https://pocketbase.url/files/promo-video.mp4", "duration": 30 }
      ]
    }
  }
  ```

### 3.3 TV Diagnostic Heartbeat
TV posts health reports once a minute.
* **Endpoint**: `POST /devices/heartbeat`
* **Request Payload**:
  ```json
  {
    "hardwareUuid": "hw_f8392-1a2b-3c4d",
    "cpuTemp": 54.2,
    "currentPlayingAsset": "promo-video.mp4",
    "storageUsedBytes": 104857600,
    "storageAvailableBytes": 8589934592
  }
  ```
* **Success Response (204 No Content)**

---

## 4. License Management APIs

### 4.1 Issue New License (Admin Set Pricing)
Allows the administrator to create a customized plan and billing rate.
* **Endpoint**: `POST /licenses`
* **Request Payload**:
  ```json
  {
    "name": "Premium License for Demo Org",
    "assignedUserEmail": "anil@demo.com",
    "price": 12000,
    "tenure": "yearly",
    "deviceLimit": 25,
    "storageLimit": 50
  }
  ```
* **Success Response (201 Created)**:
  ```json
  {
    "id": "LIC-003",
    "name": "Premium License for Demo Org",
    "price": 12000,
    "tenure": "yearly",
    "deviceLimit": 25,
    "storageLimit": 50,
    "status": "pending_payment",
    "expiryDate": "2026-06-03" 
  }
  ```

---

## 5. Billing & Razorpay Integration APIs

```
┌─────────────┐             ┌─────────────┐             ┌─────────────┐
│ Client      │────────────▶│ Node.js     │────────────▶│ Razorpay    │
│ Portal      │  1. Renew   │ API Server  │  2. Create  │ API Engine  │
└─────────────┘             └─────────────┘             └─────────────┘
       ▲                           │                           │
       │                           ▼                           │
       │                    ┌─────────────┐                    │
       │                    │ Pocketbase  │                    │
       │                    │ Database    │                    │
       │                    └─────────────┘                    │
       │                           ▲                           │
       │ 4. Update Expiry Date     │                           │
       └───────────────────────────┴───────────────────────────┘
                            3. Webhook captured notification
```

### 5.1 Create Payment Order
Invoked when a client clicks "Pay & Reactivate". Connects to Razorpay to generate a secure order ID.
* **Endpoint**: `POST /payments/create-order`
* **Request Payload**:
  ```json
  {
    "licenseId": "LIC-002"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "orderId": "order_RahulOrd102",
    "amount": 118000, 
    "currency": "INR",
    "razorpayKeyId": "rzp_live_demo83920194"
  }
  ```

### 5.2 Verify Razorpay Signature
Verify signature generated after completion of transaction on client device.
* **Endpoint**: `POST /payments/verify`
* **Request Payload**:
  ```json
  {
    "razorpayPaymentId": "pay_RahulRzp102",
    "razorpayOrderId": "order_RahulOrd102",
    "razorpaySignature": "382a92e10db8421c..."
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "Payment verified successfully. License active."
  }
  ```

### 5.3 Razorpay Webhook Endpoint
Handles background webhook events from Razorpay for robust server-to-server updates.
* **Endpoint**: `POST /payments/webhook`
* **Headers**: `X-Razorpay-Signature: <signature>`
* **Request Payload**:
  ```json
  {
    "event": "order.paid",
    "payload": {
      "payment": {
        "entity": {
          "id": "pay_RahulRzp102",
          "order_id": "order_RahulOrd102",
          "amount": 118000,
          "status": "captured"
        }
      }
    }
  }
  ```
* **Node.js Actions**:
  1. Verify the signature in `X-Razorpay-Signature` against the webhook secret.
  2. Parse `order_id` to locate the associated `license_id` in Pocketbase.
  3. Set license status to `active`.
  4. Calculate new `expiry_date` (adds 30 days for monthly or 365 days for yearly).
  5. Add new record to the `payments` collection.
  6. Return `200 OK` to Razorpay.
