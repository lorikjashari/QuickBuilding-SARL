// Next.js on Vercel cannot resolve the Cloudflare Workers runtime.
// Vinext keeps importing the real "cloudflare:workers" module; next.config
// aliases that specifier to this file only for `next build`.
export const env = {
  DB: undefined,
  BUCKET: undefined,
  ADMIN_USER_IDS: process.env.ADMIN_USER_IDS,
  ADMIN_EMAILS: process.env.ADMIN_EMAILS,
};
