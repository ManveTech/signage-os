# Intern Roadmap & Development Timeline

This timeline divides the development of the **Signage CMS Platform** into weekly milestones. The intern should follow this plan to implement, connect, and verify the platform.

---

## Weekly Development Timeline

```
┌──────────────────────────────────────────────────────────────┐
│  WEEK 1: Backend Connection & Authentication                 │
│  - Set up environment variables                              │
│  - Establish connection to Pocketbase DB                     │
│  - Build login authentication for Admin and Client accounts  │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│  WEEK 2: Schema Synchronization & Basic CRUD                 │
│  - Define database schemas and synchronize with Pocketbase   │
│  - Implement CRUD for User Accounts & Onboarding             │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│  WEEK 3: License & Screen Operations                         │
│  - Integrate License creation & assignment CRUD              │
│  - Develop Screen/Device registration & pairing code system  │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│  WEEK 4: Razorpay Payment Engine & Paywall                   │
│  - Embed Razorpay checkout modal in the Client Portal        │
│  - Build Node.js webhook listeners to process renewals       │
│  - Restrict expired accounts using Paywall overlays          │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│  WEEK 5: Testing, Validation & Acceptance                    │
│  - Run end-to-end user scenarios                             │
│  - Perform real-time sync tests                              │
│  - Prepare system documentation                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Detailed Milestone Descriptions

### Milestone 1: Environment & Auth (Week 1)
* **Goal**: Establish connectivity between the React frontend UI and the Pocketbase backend instance, then secure access control.
* **Core Task**: Connect the frontend with Pocketbase using configuration variables, implement email/password auth logins for both portals, and seed mock user accounts directly inside the DB to verify sign-ins.

### Milestone 2: Schema Setup & Core CRUD (Week 2)
* **Goal**: Synchronize database models and build client onboarding features.
* **Core Task**: Define SQLite tables within Pocketbase, export/import the schemas, and build basic CRUD views in the Admin panel to create, list, edit, and delete user profiles.

### Milestone 3: Licensing & Device Pairing (Week 3)
* **Goal**: Enable hardware provisioning and device linking.
* **Core Task**: Implement license generation logic (associating limits and rates to users) and write the 6-digit screen pairing code mechanisms for linking TV apps.

### Milestone 4: Razorpay Billing Integration (Week 4)
* **Goal**: Integrate payment gateways and implement access restrictions.
* **Core Task**: Integrate Razorpay APIs inside the client renewal views, write Node.js API webhook endpoints to receive payment captures, extend license deadlines automatically, and build the paywall block wrapper.

### Milestone 5: Quality Assurance & Handover (Week 5)
* **Goal**: Compile project type checks, ensure offline TV storage checks are functional, verify SSE subscriptions, and document codebases.
