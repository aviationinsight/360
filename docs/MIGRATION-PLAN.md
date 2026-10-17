# Migration plan
1. Freeze source provenance and capture table exports; inventory private objects and secrets separately.
2. Preserve original visual components, CSS, JavaScript workbook readers and images in React/Vite. Replace Next server headers with authenticated session context. Keep dashboard documents private on Hono.
3. Create Turso SQLite schema through Drizzle: Better Auth users/accounts/sessions/verification, per-user dashboard permissions, original-ID mapping, file metadata, report jobs and rate limits.
4. Idempotently import users with compatible PBKDF2 verifier, then migrate verified recovery emails when supplied. Provision executive/admin accounts with environment-provided bootstrap passwords; never write those values to exports.
5. Port upload and report services over libSQL/persistent-volume adapters. Protect every private route, add health checks and Netlify same-origin API rewrites.
6. Run integration tests against an actual temporary SQLite/libSQL database: migration repeatability, legacy-password login, role restrictions, admin CRUD, CSRF, upload failures, report endpoint authorization, session revocation, reset flows. Build/typecheck frontend and backend.
7. Import private objects, configure real upstream/secrets/SMTP, deploy staging on Railway/Netlify/Turso. Compare each dashboard and exported image on desktop/iOS/Android. Only then move DNS; retain old production until acceptance.
