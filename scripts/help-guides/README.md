# Help guide screenshots

The standard Help Center guides (`server/data/helpDefaults.ts`) show screenshots of
the client dashboard with numbered highlights. These scripts make them, so
they can be redone whenever a page changes.

- `seed.py` fills a throwaway local PocketBase with a demo client — Café Aroma
  (`priya@cafearoma.in` / `ClientPass123`), four screens, a group, six images,
  two playlists, a licence and an invoice. Local test data only.
- `capture.mjs` signs in as that client in a headless Chrome, walks through
  each shot, measures where the highlighted controls are, and writes
  `public/help/<shot>.webp` and `server/data/helpShots.json`, which the
  standard guides in `server/data/helpDefaults.ts` use.

## Running it

Everything runs locally; nothing touches production.

1. A throwaway PocketBase on port 8095 with `pb_schema.json` imported and a
   superuser `admin@local.test` / `LocalTest123!`.
2. The api on port 5099 pointed at it (`POCKETBASE_URL=http://127.0.0.1:8095`,
   `PB_ADMIN_*` as above, `APP_URL=http://localhost:5175`, `SMTP_HOST=` and
   `S3_ENABLED=false` so nothing is emailed or uploaded).
3. The demo photos where the dashboard can serve them:
   `mkdir -p public/help-seed && cp marketing-site/public/installations/0{4,5,7,8}-*.webp marketing-site/public/products/{standee,info-kiosk}.webp public/help-seed/`
4. `python3 scripts/help-guides/seed.py "$PWD/marketing-site/public"`
5. The dashboard dev server on port 5175 (the `signage-os-ui-local-backend`
   launch configuration).
6. `node scripts/help-guides/capture.mjs` — or name shots to redo only those:
   `node scripts/help-guides/capture.mjs billing groups`
7. Delete `public/help-seed/` afterwards.

Needs Google Chrome, Node 22+ and `cwebp`.

## When a guide changes

A step's text refers to the numbered marks on its screenshot as (1), (2)… If
you add, remove or reorder marks in `capture.mjs`, update the text to match.
The API allows 100 requests a minute, which is why the script loads the
account's data once and keeps it between shots — if pages come up empty, wait
a minute and run it again.
