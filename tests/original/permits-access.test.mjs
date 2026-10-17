import assert from "node:assert/strict";
import test from "node:test";

const encoder = new TextEncoder();
const hex = buffer => Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, "0")).join("");
const sha256 = async value => hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));

const env = {
  SAL_PORTAL_PASSWORD: "portal-test-password",
  SAL_ADMIN_USERNAME: "admin",
  SAL_ADMIN_PASSWORD: "admin-test-password",
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  DB: { prepare() { throw new Error("The permits access test must not query employee data."); } },
};
const context = { waitUntil() {}, passThroughOnException() {} };

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("permits-test", `${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(workerUrl.href)).default;
}

test("keeps security permits admin-only and serves the embedded dashboard", async () => {
  const worker = await loadWorker();
  const adminSession = await sha256(`sal-admin:${env.SAL_ADMIN_USERNAME}:${env.SAL_ADMIN_PASSWORD}`);
  const generalSession = await sha256(`sal-session:${env.SAL_PORTAL_PASSWORD}`);

  const anonymous = await worker.fetch(new Request("http://localhost/secure-dashboard?tab=permits", { redirect: "manual" }), env, context);
  assert.equal(anonymous.status, 303);
  assert.equal(new URL(anonymous.headers.get("location")).pathname, "/login");

  const general = await worker.fetch(new Request("http://localhost/secure-dashboard?tab=permits", { redirect: "manual", headers: { cookie: `sal_session=${generalSession}` } }), env, context);
  assert.equal(general.status, 303);
  assert.equal(new URL(general.headers.get("location")).pathname, "/portal");
  assert.equal(new URL(general.headers.get("location")).searchParams.get("denied"), "1");

  const adminHeaders = { cookie: `sal_admin=${adminSession}` };
  const full = await worker.fetch(new Request("http://localhost/secure-dashboard?tab=permits", { headers: adminHeaders }), env, context);
  const fullHtml = await full.text();
  assert.equal(full.status, 200);
  assert.match(full.headers.get("cache-control"), /private, no-store/);
  assert.match(fullHtml, /Security Permits Dashboard/);
  assert.match(fullHtml, /id="stationMap"/);
  assert.match(fullHtml, /id="workbookInput"/);

  const embedded = await worker.fetch(new Request("http://localhost/secure-dashboard?tab=permits&embedded=1", { headers: adminHeaders }), env, context);
  assert.match(await embedded.text(), /\.topbar\{display:none!important\}/);

  const adminPortal = await worker.fetch(new Request("http://localhost/portal", { headers: adminHeaders }), env, context);
  assert.match(await adminPortal.text(), /Security Permits/);
  const generalPortal = await worker.fetch(new Request("http://localhost/portal", { headers: { cookie: `sal_session=${generalSession}` } }), env, context);
  assert.doesNotMatch(await generalPortal.text(), /Security Permits/);
});

test("sends administrator login to the dashboard portal", async () => {
  const worker = await loadWorker();
  const body = new URLSearchParams({ username: env.SAL_ADMIN_USERNAME, password: env.SAL_ADMIN_PASSWORD });
  const response = await worker.fetch(new Request("http://localhost/api/admin-login", {
    method: "POST",
    body,
    redirect: "manual",
  }), env, context);

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/portal?welcome=1");
  assert.match(response.headers.get("set-cookie") || "", /sal_admin=/);
});

test("allows an employee to open Security Permits when the admin grants access", async () => {
  const worker = await loadWorker();
  const employee = {
    id: 7,
    name: "Permit User",
    username: "permit.user",
    password_hash: "stored-hash",
    password_salt: "stored-salt",
    can_amos: 0,
    can_aog: 0,
    can_fak: 0,
    can_marshaling: 0,
    can_permits: 1,
    can_export: 0,
    active: 1,
    created_at: "2026-09-20T00:00:00.000Z",
    updated_at: "2026-09-20T00:00:00.000Z",
  };
  const employeeEnv = {
    ...env,
    DB: {
      prepare() {
        return {
          bind() {
            return { first: async () => employee };
          },
        };
      },
    },
  };
  const expiry = Date.now() + 60_000;
  const signature = await sha256(`employee-session:${employee.username}:${expiry}:${employee.password_hash}`);
  const encodedUsername = Buffer.from(employee.username).toString("base64url");
  const headers = { cookie: `sal_employee=${encodedUsername}.${expiry}.${signature}` };

  const portal = await worker.fetch(new Request("http://localhost/portal", { headers }), employeeEnv, context);
  const portalHtml = await portal.text();
  assert.equal(portal.status, 200);
  assert.match(portalHtml, /Security Permits/);
  assert.match(portalHtml, /Five.*operations/s);

  const dashboard = await worker.fetch(new Request("http://localhost/secure-dashboard?tab=permits", { headers }), employeeEnv, context);
  assert.equal(dashboard.status, 200);
  assert.match(await dashboard.text(), /Security Permits Dashboard/);
});
