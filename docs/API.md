# Local API

The Electron window calls only the HTTP service on 127.0.0.1. Requests use local
session cookies; writes require the same local Origin.

| Route | Purpose |
|---|---|
| /health/live, /health/ready | Application and SQLite readiness |
| /api/admin-login, /api/employee-login, /api/login | Sign in |
| /api/logout, /api/me | Sign out and current account |
| /api/admin/users | Administrator account management and password changes |
| /api/admin/dashboard-data | Local source status and XLSX/XLSM uploads |
| /api/dashboard-sync/:dashboard/metadata | Selected local workbook metadata |
| /api/dashboard-sync/:dashboard/file | Selected local workbook bytes |
| /api/dashboard-sync/client-event | Local dashboard refresh status |
| /secure-dashboard | Authenticated dashboard document |

Project Excel sources load at cold start. The word sync in the routes means
refreshing the local dashboard from local workbook storage. Images are generated
inside the Electron window by the presentation capture code.

Password changes are performed by an administrator. Public sign-up and
email-based password recovery are disabled.
