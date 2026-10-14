# Marketing site ↔ CMS integration

Where this stands, and what is left to do. Written as a handoff — pick up from
"Next up" at the bottom.

## The two halves

| Built from | Domains | Image |
|---|---|---|
| `marketing-site/` | `bluestardigitech.com`, `www.` | nginx serving the built site |
| the repo root | `cms.bluestardigitech.com`, `api.bluestardigitech.com` | Node — Express serves `/api/v1` *and* the dashboard |

Two Docker services. The CMS answers on **two** domains that both reach the
same container:

* `cms.*` — the dashboard and its login. Because Express serves the dashboard
  and the API together, the dashboard is same-origin with `/api/v1` and needs
  no API host configured at all.
* `api.*` — the stable public name. TVs in the field and the marketing site
  call this one, so neither has to care what the dashboard is called.

This replaced a split of two Coolify apps — `Bluestar-Server` (the Express API)
and `Frontend` (a static nginx dashboard). The root Dockerfile used to build
that static image with no API in it, which is why the dashboard had to be told
at build time where some other service was listening.

They are separate Vite projects with separate `node_modules` and separate
builds. The site was moved in here on 12 Oct 2026 so both halves live together;
nothing about either build was otherwise changed.

Three guards keep the nested project from leaking into the CMS's tooling —
leave them in place:

* `tsconfig.json` → `exclude: ["marketing-site"]`, or the CMS's typecheck
  compiles the site's sources under the CMS's compiler options.
* `vite.config.ts` → `server.watch.ignored`, or the CMS dev server reloads on
  edits to a site it does not serve.
* `src/index.css` → `@source not "../marketing-site"`, or Tailwind 4's
  automatic source detection sweeps the site's class names into the dashboard's
  stylesheet.

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

In Coolify (project **Bluestar → production**):

| Coolify app | Build from | Domains |
|---|---|---|
| `Frontend` (repurposed) | repo root, `/docker-compose.yml`, service `cms` | `cms.` + `api.bluestardigitech.com` |
| `Bluestar-Web` (repurposed) | base directory `/marketing-site` | `bluestardigitech.com`, `www.` |
| `Bluestar-Server` | — | delete once `Frontend` is serving the API |
| `CMS` (Services) | PocketBase | the database — keep, move its domain |

Note the naming trap: the Coolify service called **CMS is PocketBase**, not the
dashboard. The dashboard is the app called **Frontend**.

The compose service was renamed `frontend` → `cms`, so after **Reload Compose
File** the domain fields are bound to the old name — re-assign them.

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
