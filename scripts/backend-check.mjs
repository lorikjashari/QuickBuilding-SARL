/* eslint-disable @next/next/no-assign-module-variable -- This is a standalone CommonJS harness with an intentional module shim. */
// Real API routes, SQLite-backed D1 adapter and in-memory R2 adapter.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const sqlite = new DatabaseSync(":memory:");
const migrations = readdirSync(resolve(root, "drizzle")).filter((file) => file.endsWith(".sql")).sort();
assert.ok(migrations.length, "Generate the D1 migration first.");
for (const file of migrations) sqlite.exec(readFileSync(resolve(root, "drizzle", file), "utf8"));
class Statement {
  constructor(sql, bindings = []) { this.sql = sql; this.bindings = bindings; }
  bind(...bindings) { return new Statement(this.sql, bindings); }
  async first() { return sqlite.prepare(this.sql).get(...this.bindings) || null; }
  async all() { return { results: sqlite.prepare(this.sql).all(...this.bindings) }; }
  async run() { const result = sqlite.prepare(this.sql).run(...this.bindings); return { meta: { changes: Number(result.changes) } }; }
}
const objects = new Map();
const env = {
  ADMIN_USER_IDS: "owner-123", ADMIN_EMAILS: "", DB: { prepare(sql) { return new Statement(sql); } },
  BUCKET: {
    async put(key, bytes, options) { objects.set(key, { bytes, options }); },
    async get(key) {
      const stored = objects.get(key);
      if (!stored) return null;
      return { body: stored.bytes, httpEtag: '"test-etag"', writeHttpMetadata(headers) { headers.set("Content-Type", stored.options.httpMetadata.contentType); } };
    },
  },
};
let currentUser = null;
const modules = new Map();
function load(file) {
  const filename = resolve(root, file);
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} }; modules.set(filename, module);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const localRequire = (specifier) => {
    if (specifier === "cloudflare:workers") return { env };
    if (specifier === "@/app/chatgpt-auth") return { getChatGPTUser: async () => currentUser };
    if (specifier.startsWith("@/")) return load(`${specifier.slice(2)}.ts`);
    return require(specifier);
  };
  new Function("require", "module", "exports", source)(localRequire, module, module.exports);
  return module.exports;
}
const posts = load("app/api/posts/route.ts"), post = load("app/api/posts/[id]/route.ts"), session = load("app/api/session/route.ts");
const contacts = load("app/api/contact/route.ts"), contact = load("app/api/contact/[id]/route.ts");
const uploads = load("app/api/upload/route.ts"), media = load("app/api/media/[key]/route.ts");
const base = "https://quickbuilding.test";
const admin = { userId: "owner-123", email: "owner@example.test", displayName: "Owner", fullName: null };
function request(path, method = "GET", data, extraHeaders = {}) {
  return new Request(base + path, { method, headers: { ...(method === "GET" ? {} : { origin: base, "content-type": "application/json" }), ...extraHeaders }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
}
function context(id) { return { params: Promise.resolve({ id }) }; }
async function expect(response, status) { assert.equal(response.status, status, await response.clone().text()); return response.json(); }
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }

await check("anonymous and ordinary signed-in users cannot administer", async () => {
  assert.deepEqual(await expect(await session.GET(), 200), { user: null, isAdmin: false });
  await expect(await posts.GET(request("/api/posts?admin=1")), 401);
  await expect(await posts.POST(request("/api/posts", "POST", { title: "Unauthorized" })), 401);
  await expect(await contacts.GET(), 401);
  currentUser = { ...admin, userId: "visitor", email: "visitor@example.test" };
  await expect(await posts.GET(request("/api/posts?admin=1")), 403);
  await expect(await posts.POST(request("/api/posts", "POST", { title: "Unauthorized" })), 403);
});
await check("allowlists fail closed and email matching is explicit", async () => {
  env.ADMIN_USER_IDS = ""; currentUser = admin;
  assert.equal((await expect(await session.GET(), 200)).isAdmin, false);
  env.ADMIN_EMAILS = " OWNER@example.test ";
  assert.equal((await expect(await session.GET(), 200)).isAdmin, true);
  currentUser = { ...admin, email: "owner@example.test.evil" };
  assert.equal((await expect(await session.GET(), 200)).isAdmin, false);
  env.ADMIN_USER_IDS = "owner-123"; env.ADMIN_EMAILS = ""; currentUser = admin;
});
await check("writes reject missing or foreign Origin", async () => {
  await expect(await posts.POST(request("/api/posts", "POST", { title: "Unsafe origin" }, { origin: "https://evil.test" })), 403);
  const missing = request("/api/posts", "POST", { title: "Unsafe origin" }); missing.headers.delete("origin");
  await expect(await posts.POST(missing), 403);
  await expect(await posts.POST(request("/api/posts", "POST", { title: "Unsafe origin" }, { "sec-fetch-site": "cross-site" })), 403);
});
let saved;
await check("draft creation persists defaults and French slug", async () => {
  saved = (await expect(await posts.POST(request("/api/posts", "POST", { title: "Rénovation à Genève", excerpt: "Une rénovation soignée.", content: "Un véritable projet client." })), 201)).post;
  assert.equal(saved.slug, "renovation-a-geneve"); assert.equal(saved.status, "draft"); assert.deepEqual(saved.gallery, []);
  assert.equal((await expect(await post.GET(request(`/api/posts/${saved.id}`), context(saved.id)), 200)).post.id, saved.id);
});
await check("drafts are hidden from anonymous and non-admin visitors", async () => {
  currentUser = null;
  assert.deepEqual((await expect(await posts.GET(request("/api/posts")), 200)).posts, []);
  await expect(await post.GET(request(`/api/posts/${saved.slug}`), context(saved.slug)), 404);
  currentUser = { ...admin, userId: "visitor", email: "visitor@example.test" };
  await expect(await post.GET(request(`/api/posts/${saved.id}`), context(saved.id)), 404);
  await expect(await post.PATCH(request(`/api/posts/${saved.id}`, "PATCH", { status: "published" }), context(saved.id)), 403);
  await expect(await post.DELETE(request(`/api/posts/${saved.id}`, "DELETE"), context(saved.id)), 403);
  currentUser = admin;
});
await check("invalid fields, image URLs and slug collisions fail", async () => {
  await expect(await posts.POST(request("/api/posts", "POST", { title: "Bad category", category: "Other" })), 400);
  await expect(await posts.POST(request("/api/posts", "POST", { title: "Empty publication", status: "published" })), 400);
  await expect(await posts.POST(request("/api/posts", "POST", { title: "Bad image", image: "javascript:alert(1)" })), 400);
  await expect(await posts.POST(request("/api/posts", "POST", { title: "External image", image: "https://tracker.test/a.jpg" })), 400);
  await expect(await posts.POST(request("/api/posts", "POST", { title: "Slug duplicate", slug: saved.slug })), 409);
  await expect(await post.PATCH(request(`/api/posts/${saved.id}`, "PATCH", { id: "overwrite" }), context(saved.id)), 400);
});
await check("publication and unpublication change public visibility", async () => {
  await expect(await post.PATCH(request(`/api/posts/${saved.id}`, "PATCH", { status: "published" }), context(saved.id)), 200);
  currentUser = null;
  assert.equal((await expect(await posts.GET(request("/api/posts")), 200)).posts.length, 1);
  assert.equal((await expect(await post.GET(request(`/api/posts/${saved.slug}`), context(saved.slug)), 200)).post.title, saved.title);
  currentUser = admin;
  await expect(await post.PATCH(request(`/api/posts/${saved.id}`, "PATCH", { status: "draft" }), context(saved.id)), 200);
  currentUser = null;
  await expect(await post.GET(request(`/api/posts/${saved.slug}`), context(saved.slug)), 404);
  currentUser = admin;
});
await check("body limits and malformed JSON are rejected", async () => {
  await expect(await posts.POST(request("/api/posts", "POST", { title: "Huge post", content: "x".repeat(101000) })), 413);
  await expect(await posts.POST(new Request(base + "/api/posts", { method: "POST", headers: { origin: base, "content-type": "application/json" }, body: "{" })), 400);
});
const inquiry = { name: "Jane Client", email: "jane@example.test", phone: "+41 22 123 45 67", service: "Rénovation", location: "Genève", message: "Je souhaite discuter de mon projet.", privacy: true, website: "" };
let message;
await check("contact consent, honeypot and persistence work", async () => {
  currentUser = null;
  await expect(await contacts.POST(request("/api/contact", "POST", { ...inquiry, privacy: false })), 400);
  await expect(await contacts.POST(request("/api/contact", "POST", { ...inquiry, website: "spam" })), 201);
  await expect(await contacts.POST(request("/api/contact", "POST", inquiry)), 201);
  await expect(await contacts.GET(), 401);
  currentUser = admin;
  const result = await expect(await contacts.GET(), 200);
  assert.equal(result.messages.length, 1); message = result.messages[0]; assert.equal(message.read, false);
  assert.equal((await expect(await contact.PATCH(request(`/api/contact/${message.id}`, "PATCH", { read: true }), context(message.id)), 200)).message.read, true);
});
await check("contact rate limiting persists across requests", async () => {
  await expect(await contacts.POST(request("/api/contact", "POST", inquiry)), 201);
  await expect(await contacts.POST(request("/api/contact", "POST", inquiry)), 201);
  await expect(await contacts.POST(request("/api/contact", "POST", inquiry)), 429);
  assert.equal((await expect(await contacts.GET(), 200)).messages.length, 3);
});
function uploadRequest(bytes, type) {
  const data = new FormData(); data.set("file", new Blob([bytes], { type }), "photo.png");
  return new Request(base + "/api/upload", { method: "POST", headers: { origin: base }, body: data });
}
let image;
await check("uploads require admin and reject SVG, false MIME and large images", async () => {
  currentUser = null;
  await expect(await uploads.POST(uploadRequest("image", "image/png")), 401);
  currentUser = admin;
  await expect(await uploads.POST(uploadRequest('<svg onload="alert(1)"></svg>', "image/svg+xml")), 415);
  await expect(await uploads.POST(uploadRequest("this is not a png", "image/png")), 415);
  await expect(await uploads.POST(uploadRequest(new Uint8Array(8 * 1024 * 1024 + 1), "image/png")), 413);
});
await check("image storage, media retrieval and gallery roundtrip work", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl4vwsAAAAASUVORK5CYII=", "base64");
  image = (await expect(await uploads.POST(uploadRequest(png, "image/png")), 201)).url;
  const key = image.split("/").pop();
  const response = await media.GET(request(image), { params: Promise.resolve({ key }) });
  assert.equal(response.status, 200); assert.equal(response.headers.get("Content-Type"), "image/png"); assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array(png));
  await expect(await media.GET(request("/api/media/invalid.svg"), { params: Promise.resolve({ key: "../invalid.svg" }) }), 404);
  const updated = (await expect(await post.PATCH(request(`/api/posts/${saved.id}`, "PATCH", { image, imageAlt: "Chantier", gallery: [{ url: image, alt: "Détail" }] }), context(saved.id)), 200)).post;
  assert.equal(updated.gallery[0].url, image);
});
await check("private responses disable caching", async () => {
  for (const response of [await session.GET(), await contacts.GET(), await posts.GET(request("/api/posts?admin=1"))]) assert.match(response.headers.get("cache-control"), /no-store/);
});
await check("deletion persists and missing records return 404", async () => {
  await expect(await post.DELETE(request(`/api/posts/${saved.id}`, "DELETE"), context(saved.id)), 200);
  await expect(await post.GET(request(`/api/posts/${saved.id}`), context(saved.id)), 404);
  await expect(await post.DELETE(request(`/api/posts/${saved.id}`, "DELETE"), context(saved.id)), 404);
  await expect(await contact.DELETE(request(`/api/contact/${message.id}`, "DELETE"), context(message.id)), 200);
  await expect(await contact.PATCH(request(`/api/contact/${message.id}`, "PATCH", { read: true }), context(message.id)), 404);
});
sqlite.close();
console.log(`\n${checks} backend integration/security checks passed.`);
