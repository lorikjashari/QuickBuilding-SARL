import { ApiError, apiError, json, readJson, requireSameOrigin } from "@/lib/api";
import { contactSchema } from "@/lib/content";
import { createContactMessage } from "@/lib/firebase-data";

export const dynamic = "force-dynamic";

const recent = new Map<string, number[]>();

function allow(key: string, limit: number) {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((time) => now - time < 60 * 60 * 1000);
  if (hits.length >= limit) throw new ApiError(429, "Trop de demandes ont été envoyées. Réessayez un peu plus tard, ou appelez-nous.");
  hits.push(now);
  recent.set(key, hits);
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const data = contactSchema.parse(await readJson(request, 24_000));
    if (data.website) return json({ success: true }, 201);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    allow(`ip:${ip}`, 5);
    allow(`email:${data.email.toLowerCase()}`, 3);
    await createContactMessage(data);
    return json({ success: true }, 201);
  } catch (error) {
    return apiError(error);
  }
}
