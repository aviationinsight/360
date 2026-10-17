# Audited feature inventory — source version 84
Source commit: 0158655ee35d230d4214029d31cb5b1a4097d80a. Production database inspected October 17, 2026.

| Area | Preserved behavior | Migration |
|---|---|---|
| Home | Scroll-driven aircraft/globe, navigation, responsive layouts, approved logo | Original React components, CSS and assets copied verbatim |
| Login | Executive password-only, employee username/password, admin credentials, logout | Same forms/redirects, Better Auth sessions replacing deterministic cookies |
| Accounts | Admin create/edit/delete, active toggle, administrator toggle, dashboard/export permissions | Normalized users, credential accounts and permission rows, original numeric employee IDs retained |
| Portal | Role-filtered cards, five views including permits, welcome journey and dashboard intros | React context populated only from authenticated backend |
| AMOS | Excel parsing, exception/on-time logic, targets, dates, stores, shifts, counters, charts | Original private dashboard document retained |
| FAK | Aircraft type, dates, network map, pan/zoom/wheel, flights, on-time calculations | Original private document retained |
| AOG | Deliveries, stations, shifts, on-time rules, dates and visuals | Original private document retained |
| Marshaling | Summary/New Date/year handling, condition/location/shift matrix | Original private document retained |
| Security permits | Individuals/gates, map, table/detail controls, filters | Original private document retained; backend permits access enforced |
| Export | Per-view date limits, all-data, 4K PNG, desktop ZIP, mobile previews/share/save-all | Original renderer and UI retained; export permission checked on capture API requests |
| Manual uploads | Admin-only XLSX validation, immutable upload, newest manual vs automatic selection, outage fallback | Private persistent Railway volume object store and normalized file metadata |
| Excel automation | Existing Cloudflare/OneDrive/Zapier upstream refresh and client events | Protected proxy keeps same API URLs; upstream configurable |
| Reports | Exact 12/26 readiness across all four files; immutable snapshots; once-per-period jobs; render/retry/test/status/rebuild; attachment links; email pause | Original service/SQL retained over libSQL adapter, local Chromium renderer; scheduler command |
| PWA | Install UI, manifest, approved icons, start at home; no cached sessions/data | Original install UX, updated network-only navigation and static-only offline cache |
| Extras | Concept and flight-lab routes | Original components retained |

## Accessible data and boundaries
7 complete employee rows and 2 report_runs rows exported to restricted JSON. Hashes/salts only; no plaintext passwords. Existing DB does not store employee email addresses. Legacy identity uses a deterministic @legacy.invalid technical identifier until an admin assigns a verified real recovery email. No fabricated business records are seeded.
R2 object listing/download is not exposed by the available Sites connector. Report PNG/XLSX snapshots and manual files need an authorized R2 export; supplied scripts import an object manifest. Runtime secret values are redacted and must be re-entered. Current upstream files can be captured by the provided authenticated export command if reachable. No Railway/Netlify/Turso/SMTP credentials are available. Production cutover and full device acceptance are not claimed.

## Security changes (intentional, without removing workflows)
Opaque expiring Better Auth sessions, server RBAC on file/metadata/HTML/report APIs, origin checks for unsafe browser requests, persistent throttling, bounded payloads, generic server errors, disabled public self-registration (original UI is admin-provisioned), hash-only credential migration. Legacy insecure cookies are not accepted.
