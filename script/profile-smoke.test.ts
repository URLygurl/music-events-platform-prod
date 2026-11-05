import assert from "node:assert/strict";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const dbURL = process.env.AUTH_TEST_DATABASE_URL;
const base = process.env.PROFILE_TEST_URL || "http://127.0.0.1:4186";
if (!dbURL || !["127.0.0.1", "localhost"].includes(new URL(dbURL).hostname) || !new URL(dbURL).pathname.endsWith("_test") || !["127.0.0.1", "localhost"].includes(new URL(base).hostname)) throw new Error("Use an explicitly configured disposable localhost test database/server only.");
const pool = new Pool({ connectionString: dbURL });
async function call(path: string, method = "GET", body?: unknown, cookie = "", origin = base) {
  return fetch(`${base}${path}`, {
    method, headers: { Cookie: cookie, "X-Forwarded-Proto": "https", ...(method !== "GET" ? { Origin: origin } : {}), ...(body !== undefined && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}) },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
}
async function login(name: string) {
  const res = await call("/api/login", "POST", { username: name, password: "local-profile-test-only" });
  assert.equal(res.status, 200, await res.text());
  const cookie = res.headers.getSetCookie().map((v) => v.split(";")[0]).join("; ");
  assert(cookie); return cookie;
}
try {
  const hash = await bcrypt.hash("local-profile-test-only", 10);
  for (const [id, username, email] of [["profile-test-a", "profile-local-a", "same-owner@example.test"], ["profile-test-b", "profile-local-b", "other@example.test"]]) {
    await pool.query('INSERT INTO public.users(id,username,email,role,password_hash) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET password_hash=$5', [id, username, email, "user", hash]);
  }
  await pool.query("DELETE FROM public.user_profiles WHERE user_id IN ('profile-test-a','profile-test-b')");
  await pool.query("DELETE FROM public.orders WHERE owner_user_id IN ('profile-test-a','profile-test-b') OR customer_email='same-owner@example.test'");
  const a = await login("profile-local-a"), b = await login("profile-local-b");
  assert.equal((await call("/api/profile")).status, 401);
  let res = await call("/api/profile", "GET", undefined, a);
  assert.equal(res.status, 200);
  let profile = await res.json();
  assert.equal(profile.userType, "audience");
  assert.equal(profile.email, "same-owner@example.test");
  assert.equal(profile.favourites.length, 0);
  res = await call("/api/profile", "PATCH", { username: "saved-profile-a" }, a, "https://evil.example.test");
  assert.equal(res.status, 403, "Cross-origin profile mutation accepted");
  res = await call("/api/profile", "PATCH", { username: "saved-profile-a", userType: "artist", role: "admin", userId: "profile-test-b" }, a, "https://127.0.0.1:4186");
  assert.equal(res.status, 400, "Mass assignment accepted");
  res = await call("/api/profile", "PATCH", { username: "saved-profile-a" }, a, "https://127.0.0.1:4186");
  assert.equal(res.status, 200, await res.text());
  res = await call("/api/profile", "PATCH", { username: "SAVED-PROFILE-A" }, b, "https://127.0.0.1:4186");
  assert.equal(res.status, 409, "Case-insensitive username collision accepted");
  res = await call("/api/profile", "PATCH", { username: "bad name" }, a, "https://127.0.0.1:4186");
  assert.equal(res.status, 400);
  profile = await (await call("/api/profile", "GET", undefined, a)).json();
  assert.equal(profile.username, "saved-profile-a");
  assert.equal((await pool.query('SELECT username,role FROM public.users WHERE id=$1', ["profile-test-a"])).rows[0].username, "profile-local-a", "Existing login username was changed");
  let data = new FormData(); data.append("file", new Blob(["<svg/>"] ,{type:"image/svg+xml"}), "evil.svg");
  assert.equal((await call("/api/profile/avatar", "POST", data, a, "https://127.0.0.1:4186")).status, 415);
  data = new FormData(); data.append("file", new Blob(["not-an-image"] ,{type:"image/png"}), "fake.png");
  assert.equal((await call("/api/profile/avatar", "POST", data, a, "https://127.0.0.1:4186")).status, 415);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6r9sAAAAASUVORK5CYII=", "base64");
  data = new FormData(); data.append("file", new Blob([png],{type:"image/png"}), "avatar.png");
  res = await call("/api/profile/avatar", "POST", data, a, "https://127.0.0.1:4186"); assert.equal(res.status,200,await res.text());
  res = await call("/api/profile/avatar", "GET", undefined, a); assert.equal(res.status,200); assert.equal(res.headers.get("content-type")?.split(";")[0],"image/png"); assert(res.headers.get("cache-control")?.includes("private")); assert.deepEqual(Buffer.from(await res.arrayBuffer()),png);
  assert.equal((await call("/api/profile/avatar", "GET", undefined, b)).status,404);
  assert.equal((await call("/api/profile/avatar")).status,401);
  const product = await pool.query("INSERT INTO public.products(name,price,active) VALUES('Profile test product',1234,true) RETURNING id");
  const id = product.rows[0].id;
  res = await call("/api/profile/favourites", "POST", { productId: id }, a, "https://127.0.0.1:4186"); assert.equal(res.status,200,await res.text());
  assert.equal((await call("/api/profile/favourites", "POST", {productId:id,userId:"profile-test-b"},a,"https://127.0.0.1:4186")).status,400);
  await call("/api/profile/favourites", "POST", { productId: id }, a, "https://127.0.0.1:4186");
  profile = await (await call("/api/profile", "GET", undefined, a)).json(); assert.equal(profile.favourites.length,1);
  assert.equal((await (await call("/api/profile", "GET", undefined, b)).json()).favourites.length,0);
  await call(`/api/profile/favourites/${id}`, "DELETE", undefined, b, "https://127.0.0.1:4186");
  assert.equal((await (await call("/api/profile", "GET", undefined, a)).json()).favourites.length,1,"Other account removed favourite");
  assert.equal((await call("/api/profile/favourites/import","POST",{productIds:[id,id]},b,"https://127.0.0.1:4186")).status,200);
  await pool.query("INSERT INTO public.orders(owner_user_id,customer_email,status,amount_total,items) VALUES($1,$2,'paid',1234,'[]'),(NULL,$2,'paid',9999,'[]')",["profile-test-a","same-owner@example.test"]);
  await pool.query("INSERT INTO public.user_tickets(user_id,label,ticket_reference,status) VALUES($1,'Test admission','private-ref','issued')",["profile-test-a"]);
  profile=await(await call("/api/profile","GET",undefined,a)).json(); assert.equal(profile.purchases.length,1,"Claimed unowned order by email"); assert.equal(profile.tickets.length,1);
  const other=await(await call("/api/profile","GET",undefined,b)).json(); assert.equal(other.purchases.length,0);assert.equal(other.tickets.length,0);
  assert.equal((await call("/api/profile/tickets","POST",{label:"Free ticket"},a,"https://127.0.0.1:4186")).status,404);
  const authUser=await(await call("/api/auth/user","GET",undefined,a)).json();assert.equal(authUser.role,"user");assert(!("passwordHash" in authUser));
  console.log("PASS: persisted profile, login unchanged, username uniqueness, CSRF/mass-assignment refusal, private avatar validation, favourites/import, purchase/ticket ownership, no email-based order claims or role escalation.");
} finally { await pool.end(); }
