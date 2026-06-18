# Project Overview — CMS Signage Management System

This document outlines the core architecture, target users, and functional divisions of the **CMS Signage Management System**, designed as an intern onboarding document.

---

## 1. Project Introduction

The **CMS Signage Management System** is a real-time Content Management System (CMS) designed to manage content playback on digital display screens (such as TV signage, stands, kiosks, and shop windows). 

The platform allows administrators to control client organizations, provision display hardware licenses, set up custom pricing models, and monitor hardware health metrics. Clients log in to manage their own media libraries, create play sequences (playlists), map screens, and pay for license renewals.

---

## 2. Platform Architecture

The application is structured into three main layers:

```
┌──────────────────────────────────────────────────────────────┐
│                  FRONTEND USER INTERFACES                    │
│   ┌───────────────────────────┐  ┌────────────────────────┐  │
│   │   Administrator Portal    │  │  Client/User Portal    │  │
│   └───────────────────────────┘  └────────────────────────┘  │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                      BACKEND SERVER API                      │
│   ┌───────────────────────────────────────────────────────┐  │
│   │                    Node.js Service                    │  │
│   │  (Business Logic, Razorpay Webhooks, Pairing Checks)  │  │
│   └───────────────────────────────────────────────────────┘  │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    DATABASE & STORAGE BAAS                   │
│   ┌───────────────────────────────────────────────────────┐  │
│   │                  Pocketbase Backend                   │  │
│   │  (SQLite Database, REST APIs, SSE Real-time Updates)  │  │
│   └───────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

1. **Frontend UI (React/Vite)**: Clean client-side interface containing two main portals (Admin and Client).
2. **Node.js Gateway Server**: Handles secure operations, schedules, diagnostic heartbeats, and third-party integrations (like Razorpay payments).
3. **Pocketbase Server**: Provides a lightweight database (SQLite), native file storage for images/videos, and real-time subscriptions (Server-Sent Events) to push updates instantly to smart TV player devices.

---

## 3. Core Functional Cohorts

### 1. The Administrator
* **Role**: System manager with full oversight of the ecosystem.
* **Key Tasks**: Onboarding client user accounts, creating custom licenses, setting custom renewal prices, grouping screens, and reviewing system-wide hardware logs.

### 2. The Client User (Tenant)
* **Role**: Account holder representing a business location (e.g. Cafe, Retail Store).
* **Key Tasks**: Managing media files, building playlists, configuring local split-screen layout zones, viewing billing history, raising support tickets, and paying for licenses via the renewal checkout.

### 3. The TV Player App
* **Role**: Playback client software running directly on smart TVs or media boxes.
* **Key Tasks**: Connecting to the backend, caching media files locally to ensure offline loop stability, rendering playlists, and sending periodic heartbeat diagnostics back to the server.

---

## 4. Business Licensing Model

The platform uses a **Manual Pay-to-Renew Model** instead of recurring subscriptions:
* **Custom Pricing**: The administrator manually sets the price, tenure (monthly or yearly), and limits for each client license during user onboarding.
* **Active vs. Pending Status**: Active licenses allow full client portal access and TV signage streaming.
* **Suspension Paywall**: When a license expires, the client user is locked behind a suspension page (Paywall) blocking all menu navigation. Access is restored once the client completes the payment.
