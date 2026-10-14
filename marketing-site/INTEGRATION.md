# Marketing site ↔ CMS integration

Where this stands, and what is left to do. Written as a handoff — pick up from
"Next up" at the bottom.

## The three pieces

| Compose service | Builds from | Domains | Image |
|---|---|---|---|
| `api` | `server/Dockerfile` | `api.bluestardigitech.com`, `dem1.manve.co` | Node — Express, `/api/v1` |
| `cms` | root `Dockerfile` | `cms.bluestardigitech.com`, `blu.manve.co` | nginx — the admin dashboard |
| `website` | `marketing-site/` | `bluestardigitech.com`, `www.` | nginx — the public site |

Three containers, one Coolify resource, one compose file. The dashboard and the
website are two entirely separate React apps that happen to share a repo; the
only thing joining them is that the website posts leads to the API, and you
read them in the dashboard.

Because the dashboard is served from `cms.*` and calls `api.*`, every request
it makes is cross-origin: the API host is compiled into the dashboard at build
time (`VITE_NODE_SERVER_URL`), and the API has to list the dashboard in
`CORS_ALLOWED_ORIGINS`. Both are wired up in `docker-compose.yml`.

## Done on the CMS side

Endpoints (both mounted **above** `authenticateToken` in `server/routes/index.ts`):

* `POST /api/v1/public/leads` — the enquiry form's destination.
  `server/controllers/publicLeads.ts`. Validated by `publicLeadSchema`,
  capped at 10/hour per IP by `leadLimiter`, carries a `website` honeypot,
  saves to `leads` with `status: "New"`, then emails the enquiry address
  best-effort.
* `GET /api/v1/public/contact` — name, address, phone, email and
  `whatsappNumber`. A deliberately narrower payload than the authenticated
  `GET /business-details`, which also returns the GSTIN.

Dashboard:

* **Enquiries** page (`src/pages/admin-dashboard/views/Leads.tsx`) — list,
  status pipeline, and one-tap reply by WhatsApp / phone / email.
* **WhatsApp number** and **Enquiry email** fields under Licensing → Invoices →
  Billing details.

Full request/response detail is in `documentation/api_spec.md` § 6.

## Done on the site side

Every CTA used to scroll to the footer. Now:

* **Request a quote** → `wa.me`, prefilled with the product, panel size and
  finish on screen. Built by `buildQuoteMessage` in `src/data/enquiry.ts`.
* **Enquire** → the form in `src/components/EnquiryModal.tsx`, which **posts to
  the CMS** (`src/data/cms.ts`) and shows a confirmation. WhatsApp is the
  second button for anyone who would rather talk now.

The form used to hand its message to the visitor's own WhatsApp and stop there,
so a lead only existed if they went on to press send in another app — and we
never knew about the ones who didn't. It now records the lead first.

`VITE_CMS_API` is inlined by Vite at build time (a Docker build arg), so
changing the API origin means rebuilding the image.

### Verified end to end

Against a throwaway PocketBase with the real schema imported:

* form submit → `POST /public/leads` → row in `leads`, every field intact,
  including `quantity: "10-15"` (which the old number column would have lost)
* the row comes back from the authenticated `GET /leads` under exactly the
  field names the Enquiries view reads
* the status dropdown's `PUT` persists
* honeypot submission answers `201` and creates **no** row
* `503` surfaces as "something went wrong at our end", with the WhatsApp and
  phone fallbacks still offered
* a request from an origin not in `CORS_ALLOWED_ORIGINS` is blocked by the
  browser — confirmed by accident, which is the best way to confirm it

## Next up

1. Read contact details from `GET /public/contact` at runtime (client written,
   `fetchContact()` in `src/data/cms.ts`, not yet called), keeping the compiled
   values in `src/data/company.ts` as the fallback so the footer still shows a
   phone number when the CMS is unreachable.
2. Drop the mailto stopgap in `Footer.tsx`'s catalogue form onto the same
   endpoint.

## Going to production

### 1. Point the domains

**One** Coolify resource (`Frontend`, Base Directory `/`, Compose Location
`/docker-compose.yml`) builds all three services — the same shape as the Manve
project. Each is its own container, so Coolify gives each its own domain field
and its own logs, and one crashing doesn't take the others down.

| Compose service | Builds from | Domains to set in Coolify |
|---|---|---|
| `api` | `server/Dockerfile` | `api.bluestardigitech.com`, `dem1.manve.co` |
| `cms` | root `Dockerfile` (static dashboard) | `cms.bluestardigitech.com`, `blu.manve.co` |
| `website` | `marketing-site/` | `bluestardigitech.com`, `www.` |

Separate fields on purpose: any one of them can move later without touching the
others.

The `Bluestar-Server` and `Bluestar-Web` Coolify apps become redundant — the
API's build moved into the `api` service here. Delete `Bluestar-Server` only
after `dem1.manve.co` has moved onto this resource and a real TV is confirmed
syncing; see the legacy-domain note in `docker-compose.yml`.

Note the naming trap: the Coolify service called **CMS is PocketBase**, not the
dashboard. The dashboard is the `cms` service inside the app called
**Frontend**.

Because the dashboard and the API are separate origins, the dashboard's API
host is compiled in at build time (`VITE_NODE_SERVER_URL`) and the API must
list the dashboard in `CORS_ALLOWED_ORIGINS`. Both are wired in
`docker-compose.yml`.

Domain assignment is Coolify UI configuration, not anything in this repo.

### 2. Import the schema

Into the **existing** PocketBase — nothing here needs a new instance. The six
new `leads` columns (`whatsapp`, `displaySize`, `finish`, `city`, `message`,
`source`), the `quantity` number→text change and the new status values exist in
`pb_schema.json` only:

```bash
./pocketbase admin import pb_schema.json
```

Verified to import cleanly against PocketBase 0.34.2. `deleteMissing: false`,
so it adds columns without touching anything already there.

### 3. Set the CMS environment

`docker-compose.yml` at the repo root lists all of these.

| Variable | Note |
|---|---|
| `POCKETBASE_URL` | the new production database |
| `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` | superuser for that instance |
| `JWT_SECRET` | **must** change from the dev default |
| `APP_URL` | `https://cms.bluestardigitech.com` — used in password-reset links and the "open the enquiry" button in lead emails, so it must be the dashboard domain, not api.* |
| `CORS_ALLOWED_ORIGINS` | `https://bluestardigitech.com,https://www.bluestardigitech.com,https://cms.bluestardigitech.com` |

Leave `VITE_NODE_SERVER_URL` **unset** — unset means same-origin, which is what
the dashboard wants now that one service serves both. The existing value
(`https://dem1.manve.co`) must be removed, or it gets compiled into the
dashboard and points it back at the old host.

`CORS_ALLOWED_ORIGINS` matters more than it looks: unset means `*`, which lets
any site on the internet post enquiries. And the origins must match exactly —
`localhost` and `127.0.0.1` are different origins to a browser.

### 4. Build the site against the API

```bash
docker build --build-arg VITE_CMS_API=https://api.bluestardigitech.com/api/v1 marketing-site/
```

That is also the default in `marketing-site/Dockerfile`, so a plain build is
already correct for production. It uses `api.*` rather than `cms.*` because the
site calls it cross-origin either way, and the public API name should not
change if the dashboard is ever renamed or moved.

### 5. Fill in the dashboard

WhatsApp number and enquiry email under **Licensing → Invoices → Business
details**; SMTP under **Integrations → Email**. Without the enquiry email,
leads are still recorded but nobody is notified (it logs a warning).

The rest of the client-side checklist — testimonials, client-logo sign-off,
opening hours — is in `marketing-site/README.md`.

## Two things worth knowing

**The site's typecheck used to be weaker than it looked.** It had no
`@types/react` at all, so React was untyped and `tsc` passed on things it
should not have. `@types/react` and `@types/react-dom` are now direct
devDependencies, and the first genuinely-typed run found one real mistake: a
`RefObject<HTMLDivElement>` attached to an `<ol>` in `ProcessSection.tsx`, now
`HTMLOListElement`.

**Leads are global rows.** This CMS runs for Bluestar alone, so the `leads`
collection has no organization relation. If signage-os is ever sold to a second
client, the collection and the public endpoint both need an org column plus a
trustworthy way to tell which site a submission came from — a public endpoint
cannot be allowed to name its own tenant.
