# QuickBuilding

A French-language website and editorial administration for the Geneva building and masonry business. Built with React, TypeScript and Vinext, hosted by Sites on Cloudflare Workers. Posts and enquiries persist in D1; uploaded images persist in R2. There are no fabricated client projects or testimonials in the database.

## Administration

Open `/admin` and sign in with ChatGPT. Access is checked on every administrative API request. Configure the comma-separated `ADMIN_USER_IDS` runtime variable with the administrator’s stable, site-scoped user ID. The `/api/session` response gives a signed-in user their own ID. `ADMIN_EMAILS` accepts an explicit comma-separated list of authenticated identity emails for initial handover; replace email entries with stable IDs once the client signs in. Empty allowlists deny access. There is no shared password and the first visitor does not become an administrator.

The editor supports creating, editing, publishing, returning to draft and deleting publications, with a cover image and gallery. Drafts are hidden from public list and detail APIs. Images accept JPG, PNG or WebP, maximum 8 MB each. The server checks file signatures and sizes. Images have immutable random names; removing a post or detaching a photo does not erase its R2 object, preserving any other use of the same image. Uploaded image URLs are public resources; use photos approved for publication.

The inbox stores quote/contact requests, with read/unread status and deletion. Requests are stored in the admin inbox; automatic email notifications are **not configured**. The administrator should check the inbox and use the client’s submitted contact details to reply.

## Local development

Requires Node.js 22.13+ and the installed Sites plugin runtime. The plugin’s `install-dependencies.mjs` manages initial installation. Do not run concurrent installers.

1. Keep `.openai/hosting.json` configured with `d1: "DB"` and `r2: "BUCKET"`.
2. Create an ignored `.dev.vars` with `ADMIN_USER_IDS=local_seedy` for local preview only. Do not deploy this development identity.
3. Run `npm run db:generate` after schema changes. Inspect and retain generated SQL and Drizzle metadata.
4. Build using the Sites plugin’s `build-site.mjs`, or `npm run build` for standalone local use.
5. Apply each pending migration once to the local database, replacing the SQL filename below with the actual migration:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_lowly_surge.sql
```

6. Run `npm run dev -- --port 5173` and open the printed loopback URL. Local sign-in uses the starter’s development-only simulation at `/signin-with-chatgpt?return_to=/admin`. Production sign-in is owned by Sites dispatch.

Local preview and hosted D1/R2 storage are separate. Preserve migration history after it has been applied; append migrations for schema changes. Publishing through Sites applies pending hosted migrations. Runtime environment variables belong in native Sites settings, not the hosting manifest or client code. `.env.example` documents names without credentials.

## Verification

```sh
node scripts/backend-check.mjs
npx tsc --noEmit
npm run build
```

The backend checks execute the actual API route modules against SQLite and an in-memory R2 adapter. They cover authorization, explicit allowlists, CSRF, hidden drafts, publishing, validation, body/upload limits, image storage, inbox persistence, anti-spam rate limits and deletion. Local browser checks should also cover desktop/mobile navigation, contact submission, sign-in, editorial CRUD and uploading actual images. Sites native deployment status verifies publication; local tests do not establish hosted behaviour by themselves.

## API

All error responses use `{ "error": "French message" }`. JSON and identity-dependent responses disable caching. Writes require a same-origin `Origin` header. Admin endpoints additionally require an authenticated allowlisted identity.

| Route | Behaviour |
| --- | --- |
| `GET /api/session` | Current identity and `isAdmin`; never exposes the allowlist |
| `GET /api/posts` | Published posts only |
| `GET /api/posts?admin=1` | All posts; admin only |
| `GET /api/posts/:id-or-slug` | Published post; drafts require admin |
| `POST /api/posts` | Create publication; admin only |
| `PATCH /api/posts/:id` | Edit publication; admin only |
| `DELETE /api/posts/:id` | Delete publication; admin only |
| `POST /api/upload` | Multipart `file`; admin only |
| `GET /api/media/:key` | Uploaded image with fixed media type and safe key validation |
| `POST /api/contact` | Validate consent, honeypot and rate limits; store enquiry |
| `GET /api/contact` | Enquiries; admin only |
| `PATCH /api/contact/:id` | Set `{ "read": true }` or false; admin only |
| `DELETE /api/contact/:id` | Delete enquiry; admin only |

Contact rate limiting permits up to five requests per IP and three per email per hour. Only hashes are retained as short-lived rate-limit keys. There is also an administrative upload limit of 100 images per hour. Contact data stays in the database until an administrator deletes it; agree the client’s retention practice before collecting public requests.

## Client handover

- Verify company contact details and legal/privacy copy with the owner.
- Replace illustrative service imagery with approved photographs of actual work where available. Do not present stock or generated photography as completed client projects.
- Authorize the client’s ChatGPT identity through `ADMIN_USER_IDS` or an explicit `ADMIN_EMAILS` entry; remove any temporary designer access after handover.
- Publish authentic project stories from the admin editor. No migration seeds promotional content.
- Confirm public audience and custom domain settings when ready for a public launch; the initial Sites deployment remains owner-private.
- Configure email notifications separately if the client wants alerts instead of checking the inbox.

The existing legacy website and external hosting are not modified by this project.

# QuickBuilding-SARL
