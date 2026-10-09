import { requireAdmin } from "@/lib/admin-auth";
import { ApiError, apiError, json, readBody, requireSameOrigin } from "@/lib/api";
import { detectImage, MAX_UPLOAD_BYTES } from "@/lib/content";
import { bucket, rateLimit } from "@/lib/storage";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const admin = await requireAdmin();
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.startsWith("multipart/form-data;")) throw new ApiError(415, "Envoyez une image avec le formulaire de téléchargement.");
    const body = await readBody(request, MAX_UPLOAD_BYTES + 128 * 1024);
    let form: FormData;
    try { form = await new Request(request.url, { method: "POST", headers: { "content-type": contentType }, body: body.buffer as ArrayBuffer }).formData(); }
    catch { throw new ApiError(400, "Le fichier envoyé est invalide."); }
    const file = form.get("file");
    if (!file || typeof file === "string" || !file.size) throw new ApiError(400, "Sélectionnez une image.");
    if (form.getAll("file").length !== 1) throw new ApiError(400, "Envoyez une seule image à la fois.");
    if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, "L’image doit peser moins de 8 Mo.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = detectImage(bytes);
    if (!detected || (file.type && file.type !== detected.mime)) throw new ApiError(415, "Formats acceptés : JPG, PNG et WebP. Le fichier doit être une image valide.");
    await rateLimit(`upload:${admin.userId}`, 100);
    const key = `${crypto.randomUUID()}.${detected.extension}`;
    await bucket().put(key, bytes, { httpMetadata: { contentType: detected.mime, contentDisposition: `inline; filename="${key}"`, cacheControl: "public, max-age=31536000, immutable" } });
    return json({ url: `/api/media/${key}` }, 201);
  } catch (error) { return apiError(error); }
}
