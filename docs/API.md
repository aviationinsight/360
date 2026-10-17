# REST API

All browser calls are same-origin through Netlify and use cookies. Unsafe methods require the configured Origin. JSON errors omit sensitive inputs and server internals.

| Route | Access | Behavior |
|---|---|---|
| GET /health/live, /health/ready | Public | Liveness / database connectivity |
| /api/auth/* | Better Auth | Username login, sign-out, session, password recovery/reset; public signup blocked |
| POST /api/login | Public login form | Executive password-only login |
| POST /api/employee-login | Public login form | Employee username/password |
| POST /api/admin-login | Public login form | Administrator username/password |
| POST /api/logout | Session | Revoke session, redirect home |
| GET /api/me | Session or scoped render cookie | Current sanitized principal and permissions |
| GET, POST /api/admin/users | Administrator | List sanitized users / provision credential user |
| PATCH, DELETE /api/admin/users/:id | Administrator | Update/revoke sessions / delete; self-removal blocked |
| GET, POST /api/admin/dashboard-data | Administrator | Current data status / multipart XLSX upload |
| GET /api/dashboard-sync/:dashboard/metadata | Dashboard permission | Latest selected source metadata |
| GET /api/dashboard-sync/:dashboard/file | Dashboard permission | Selected current XLSX or report snapshot |
| POST /api/dashboard-sync/client-event | Session/render cookie | Validate original client telemetry contract |
| GET /secure-dashboard?tab=... | Dashboard permission | Original private dashboard document; export also requires canExport |
| GET /api/reports/status | Administrator or service secret | Last twelve report states |
| POST /api/reports/check | Administrator or service secret | Check four cutoff dates and queue snapshots; optional {test:true,period_end:"YYYY-MM-12"} |
| POST /api/reports/process | Administrator or service secret | Claim and advance one job stage |
| POST /api/reports/rebuild-test | Administrator or service secret | Rebuild inactive test while email paused |
| GET /api/reports/attachment/:id/:dashboard.png?token=... | Scoped secret capability | Private report image for email attachment retrieval |

Dashboard keys: amos, fak, aog, marshaling; permits additionally has its private HTML view. `marshalling` spelling in existing external upload worker is retained there; this app uses `marshaling` consistently.

Create user JSON fields: name, username, password, optional email, isAdmin, canExport, canAmos, canFak, canAog, canMarshaling, canPermits. Update includes full role/permission state and active; password is optional. Manual multipart fields: dashboard and file. Uploaded filenames are display metadata, not routing keys.

Service calls use `X-Report-Secret`, supplied as an environment secret. Attachment URLs are credentials: do not log query tokens or expose them on public pages. No API provides password hashes or raw session records.
