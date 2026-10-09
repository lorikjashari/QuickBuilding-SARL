import { ApiError, apiError } from "@/lib/api";
import { MEDIA_KEY } from "@/lib/content";
import { bucket } from "@/lib/storage";

export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await context.params;
    if (!MEDIA_KEY.test(key)) throw new ApiError(404, "Image introuvable.");
    const object = await bucket().get(key);
    if (!object) throw new ApiError(404, "Image introuvable.");
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("ETag", object.httpEtag);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
    if (request.headers.get("if-none-match") === object.httpEtag) return new Response(null, { status: 304, headers });
    return new Response(object.body, { headers });
  } catch (error) { return apiError(error); }
}
