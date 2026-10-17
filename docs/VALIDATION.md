# Verification and acceptance

## Completed locally

- Original source restored at deployed version 84, commit 0158655ee35d230d4214029d31cb5b1a4097d80a; feature inventory and source reference retained.
- Production database exported: seven complete employees and two report_runs. No invented production records.
- Drizzle migration applied to real local libSQL/SQLite. Data importer run twice; duplicate records were not created.
- TypeScript check and frontend/backend production builds passed; compiled Node backend started and returned readiness successfully. Netlify proxy generation was exercised with a temporary staging origin (not shipped).
- Eleven automated tests use real temporary SQLite databases and Better Auth requests: health/auth protection, PBKDF2 compatibility, opaque cookies, server-side RBAC/data isolation/export restrictions, CSRF/signup validation, administrator CRUD, invalid password non-mutation, upload validation/storage traversal, logout, single-use reset and scrypt replacement, valid manual outage fallback, four-file report readiness and snapshot deduplication, primary worksheet/date parsing across years, ZIP expansion rejection.
- Original private HTML and assets retained, original business/visual code carried over rather than redrawn.

## Must be accepted before production cutover

| Workflow | Required staging evidence |
|---|---|
| Home and portal | Compare desktop/tablet/iPhone/Android with version 84; aircraft/globe/animations/navigation |
| Employee/admin/general login | Existing authorized credentials, inactive user denial, role permissions, logout, refresh |
| Password recovery | Verified assigned recovery email, SMTP delivery, single-use expiry, old sessions revoked |
| Four operational dashboards | Same actual workbook, date period, totals, charts, map wheel/lines, counters and calculations compared to original |
| Permits | Original filtering/map/detail interactions and permits-only access |
| Excel refresh | Modify each real OneDrive file, confirm Zapier/worker metadata, new app date and numbers |
| Manual uploads | Upload each real workbook, invalid workbook rejection, automatic refresh supersedes it only when newer |
| Exports | All four PNGs visually compared with original at same dates; desktop ZIP and mobile save/share-all |
| Scheduled reports | All four exact cutoff dates required, immutable snapshots, four 3840×2160 PNGs, same-period deduplication |
| Email | Approved test recipient, four valid attachments, corporate external sender approval, Zapier history |
| Storage migration | Every historical key and checksum reconciled; report attachments work after import |
| PWA | Safari/Android installation, home startup, update behavior, private data absent from offline caches |
| Deployment | Railway volume persists after restart, Turso token, HTTPS cookies through Netlify proxy, health checks, backup/rollback |

Automated tests are not a substitute for this device/visual/SMTP acceptance. A local Chromium installation was attempted but its download was unavailable/corrupt in this environment; browser rendering and device comparisons could not be completed. Hosting credentials, redacted runtime secrets, historical R2 objects and verified user recovery addresses were unavailable. Existing OneDrive, Zapier and upstream worker remain external services. Nothing was deployed to production or changed in DNS.

## Dependency audit

`npm audit --omit=dev` found no high/critical vulnerabilities after removing the unused npm xlsx package. Four moderate advisories remain in the Drizzle Kit → esbuild-kit → esbuild development tool chain; Drizzle Kit is used for schema generation only. The application runtime does not start that development server. Recheck advisories at deployment and upgrade the tool chain when an upstream compatible fix is available; do not use force upgrades without rerunning migrations/tests.
