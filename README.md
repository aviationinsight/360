# Aviation Insight — full-stack migration

Migration of the deployed Sites **version 84**, commit `0158655ee35d230d4214029d31cb5b1a4097d80a`. Original React components, CSS, assets, private dashboard HTML, Excel calculations, maps and export rendering are retained. The live original website and DNS were not changed.

**Status:** implemented source, migrations and local verification; production cutover requires the owner-supplied configuration and storage export below. This package is not a claim of completed production/device acceptance. Read [feature inventory](docs/FEATURE-INVENTORY.md), [migration plan](docs/MIGRATION-PLAN.md), and [acceptance record](docs/VALIDATION.md).

## Structure

- `apps/frontend`: React, Vite, TypeScript, Tailwind; original component tree under `src/original`.
- `apps/backend`: modular Hono API, Better Auth, private files, workbook ingestion, scheduled reporting and Chromium rendering.
- `packages/shared`: role/dashboard contracts.
- `database/schema`, `database/migrations`, `database/seeds`, `database/import`: Drizzle schema, SQL migrations, optional bootstrap and repeatable import.
- `scripts`: migration, authorized exports/imports, report scheduler and deployment configuration.
- `automation`: preserved original Python Excel automation.

## Local setup

Use Node **22.13+** and npm. Run from repository root:

```sh
npm ci
node scripts/setup-local.mjs
npm run db:migrate
npm run db:import
npm run db:seed
npx playwright install chromium
npm run dev
```

Open `http://localhost:5173`. Setup generates random local secrets into `.env`; it never prints them. Imported employees retain their existing username/password and permissions. There are no default passwords. General/executive password-only access requires setting `BOOTSTRAP_EXECUTIVE_PASSWORD` and rerunning seed. Set optional bootstrap admin inputs only if a new owner administrator is needed. Existing usernames are never overwritten by seed/import. Do not commit `.env`, private JSON, databases or exports.

```sh
npm run typecheck
npm test
npm run build
```

## Data and authentication migration

`database/import/exports` contains **7 real employee identities and 2 report records**, exported from the production database. These private JSON files include password hashes/salts and report capability tokens. Keep this handover archive private. No plaintext passwords are exported. No business/test data is seeded into production.

`npm run db:import -- /absolute/export-directory` runs transactionally and retains existing target rows on conflict. Legacy numeric IDs remain on user records, relationship IDs remain stable, and report IDs/tokens are preserved. Import was exercised twice. A migrated PBKDF2 SHA-256 credential is verified with the original 100,000 iterations; new/reset passwords use Better Auth's scrypt. Old browser cookies are intentionally invalidated; users log in again.

Original employees have no email column. `<username>@legacy.invalid` is a technical identifier, not a recipient address. Before password recovery, an owner must verify and assign each person's real address:

```sh
node --import tsx scripts/set-recovery-email.ts USERNAME verified-address@example.com
```

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` for reset mail. Password recovery uses Better Auth single-use tokens, generic responses and session revocation. Public registration is blocked because the original application is administrator-provisioned. Original roles and per-dashboard/export permissions are enforced by the API. Administrators can still set a new employee password in the original admin interface.

### Private object files: required owner export

The connector exposed database rows but **not R2 object listing/download**. Historical report PNGs, XLSX snapshots and any manual upload objects have not been recovered. Imported report records alone do not recreate their attachments. Export all original object keys/bytes from the original storage owner account (R2 dashboard/S3-compatible client). Preserve exact keys, especially `reports/<id>/*` and `dashboard-data/<dashboard>/*`. Create an `objects.json` array beside the downloaded files:

```json
[{"key":"reports/EXISTING_REPORT_ID/amos.png","file":"downloaded/amos.png"}]
```

The example shows format only; do not create synthetic historical files. Then run:

```sh
node --import tsx scripts/import-objects.ts /absolute/export/objects.json
```

The importer validates paths, records checksums, and skips existing keys. Back up the target before import. For **current** workbooks only, use an authorized short-lived session from the original application:

```sh
# Set EXPORT_ORIGIN and EXPORT_COOKIE privately in your shell; do not paste cookies into source.
node --import tsx scripts/export-objects.ts artifacts/live-data
```

This exports four XLSX files and a manifest; it is not a historical storage export. Upload these four current workbooks through the new Admin → manual upload workflow to activate/validate them. The generic object importer by itself does not activate current-file pointers. Existing automatic refresh still uses `SYNC_ORIGIN`. Its Cloudflare/OneDrive/Zapier ownership remains a separate external dependency; this migration does not transfer those accounts.

## API and security

See [API reference](docs/API.md). All dashboard data/documents, administrative actions and report operations require server-verified access. Exceptions are public health/auth routes and scoped report attachment links (secret capability token, same behavior as original). The short-lived HMAC renderer cookie accesses only a specific immutable report/dashboard snapshot.

Use the same public browser origin for React and API through Netlify rewrites. Set `PUBLIC_ORIGIN` to that exact HTTPS origin. CORS credentials allow only it. Unsafe browser requests require the same `Origin`; service report calls require `X-Report-Secret`. Better Auth cookies are HTTP-only, Secure in production, SameSite=Lax, expire after eight hours and are revocable. User role/active/permission state is read from the database on each protected request. No public sign-up or role fields are accepted from auth clients.

Login requests use a persistent shared 90/minute budget plus Better Auth limits; do not rely on untrusted forwarded IPs. Uploads are limited to 25 MiB, must contain valid primary sheet/date data, and have bounded ZIP expansion. Private object paths reject traversal. Configure host-level rate/DoS limits as appropriate for your deployment load.

## Railway + Turso

1. Create a Turso database. Obtain its `libsql://` URL and a restricted database token. Set production `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` in Railway. Generate fresh `BETTER_AUTH_SECRET` and `REPORT_SYNC_SECRET` (at least 32 characters each); never reuse the token exposed in the old chat.
2. Create a Railway service from this repository using `Dockerfile` / `railway.toml`. The Playwright image contains Chromium; do not omit it because automatic PNG reports need a browser. Attach a **persistent volume at `/data`**, writable by the image's `pwuser` (UID 1000). Set `DATA_DIR=/data/objects`.
3. Set `NODE_ENV=production`, `PUBLIC_ORIGIN=https://YOUR-FRONTEND-DOMAIN`, `SYNC_ORIGIN` to the existing sync worker, and optionally SMTP inputs. Leave `REPORT_EMAIL_ENABLED=false` until approved recipient testing is complete. Set `REPORT_EMAIL_HOOK` privately to the existing authorized Zapier webhook when ready.
4. Railway predeploy runs database migrations. Build is `npm ci` then backend TypeScript build (Docker handles this). Start is `node apps/backend/dist/apps/backend/src/index.js` from repository root. `PORT` comes from Railway.
5. Run employee/report JSON import using a trusted local shell connected to production Turso (exports are deliberately excluded from Docker). Import private objects **inside the deployed service/volume** or upload their bytes to that mounted volume securely. `DATA_DIR` on a local laptop does not refer to the Railway volume.
6. Back up Turso **and** the persistent volume. Use one backend replica while the filesystem volume is used. Multiple replicas need shared object storage; do not horizontally scale this local-volume implementation.
7. Railway health check: `/health/ready`; liveness `/health/live`. Readiness checks Turso connectivity; verify file writes/rendering separately before cutover.

## Netlify

1. Connect the repository. `netlify.toml` runs `npm ci`, creates proxy rules, builds React and publishes `apps/frontend/dist`.
2. Set Netlify build env `RAILWAY_API_ORIGIN=https://YOUR-RAILWAY-SERVICE.up.railway.app`. This is configuration, not a frontend secret. The build fails without a valid HTTPS origin rather than shipping placeholder API URLs.
3. Set Railway `PUBLIC_ORIGIN` to the final Netlify/custom frontend origin. Use a single canonical origin, including for authentication and report rendering. Review preview deployments separately; production cookies are not shared with them.
4. Generated rules proxy `/api/*` and `/secure-dashboard` before the SPA fallback. This keeps cookies first-party and preserves original endpoint URLs. Do not point frontend directly at Railway with cross-site cookie workarounds.
5. Test `/health/ready` on the Railway origin (only `/api` is proxied through Netlify); test `/api/me` through Netlify (401 anonymous is expected). Verify both public home and authenticated dashboard render before moving custom-domain DNS.

## Report automation

The original service checks the **actual primary workbook reporting dates**, never upload timestamps. It waits for the exact 12th/26th in all four workbooks, snapshots all four files, and creates a unique period ID. Date range starts on the first of that month. A process call renders one 4K dashboard image; a subsequent call submits the email webhook once. Test periods and production periods have different IDs.

Create a separate Railway scheduled job every five minutes running `npm run report:tick` with `PUBLIC_ORIGIN` and `REPORT_SYNC_SECRET` matching the backend, plus `REPORT_API_ORIGIN` set to the direct Railway HTTPS origin to avoid the frontend proxy timeout during long renders. It calls authenticated check/process endpoints; it must not start another API server. Four images may take several invocations. Supply the same Node/package source; it does not require a second volume because it calls the backend API.

Webhook recipients/body mapping remain in the existing Zapier email action. Begin with the approved test recipient. Keep email disabled until all four downloaded attachments and recipients are verified. `submitted` means webhook accepted, not proof of inbox delivery. Ambiguous delivery is marked `delivery_unknown` and never automatically resent: inspect Zapier history before any manual intervention. This preserves once-per-period behavior without pretending external email supports exactly-once delivery.

## PWA and offline behavior

Original install UI and approved app icons are retained; start URL is home. On iOS use Safari → Share → Add to Home Screen; Android offers install. Service worker caches only public offline content/icons. API, cookies, Excel, reports and private dashboards are not cached. Offline displays a public offline page rather than sensitive/stale operational data. App updates follow website deployments.

## Cutover and rollback

Keep original hosting online. Complete staging acceptance using the matrix in `docs/VALIDATION.md`, including real Excel totals, charts, four report PNGs, iOS/Android share/save, session/reset and corporate email filtering. Export final private storage/database immediately before cutover, back up target, import, pause duplicate old/new report schedulers, then change DNS. Preserve old deployment/config for rollback. Never run two email schedulers against separate databases with delivery enabled.

The supplied archive contains source and confidential migration exports; create a private repository and exclude `database/import/exports`, `.env`, `.data` and artifacts. Credentials are entered in hosting dashboards, never committed. No production deployment or DNS mutation was performed by this task.
