import { requireAdmin } from "@/lib/admin-auth";
import { apiError, json, readJson, requireSameOrigin } from "@/lib/api";
import { contactSchema } from "@/lib/content";
import { database, fingerprint, mapContact, rateLimit, type ContactRow } from "@/lib/storage";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const data = contactSchema.parse(await readJson(request, 24_000));
    if (data.website) return json({ success: true }, 201);
    // The edge supplies CF-Connecting-IP. Store only a hashed, short-lived abuse key.
    const ip = request.headers.get("cf-connecting-ip") || "local-preview";
    await rateLimit(`contact-ip:${await fingerprint(ip)}`, 5);
    await rateLimit(`contact-email:${await fingerprint(data.email.toLowerCase())}`, 3);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await database().prepare("INSERT INTO contact_messages (id, name, email, phone, service, location, message, read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)")
      .bind(id, data.name, data.email.toLowerCase(), data.phone, data.service, data.location, data.message, now).run();
    return json({ success: true }, 201);
  } catch (error) { return apiError(error); }
}
export async function GET() {
  try {
    await requireAdmin();
    const result = await database().prepare("SELECT * FROM contact_messages ORDER BY created_at DESC").all<ContactRow>();
    return json({ messages: result.results.map(mapContact) });
  } catch (error) { return apiError(error); }
}
