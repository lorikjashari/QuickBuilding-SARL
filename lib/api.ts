import { z } from "zod";
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", ...extraHeaders } });
}
export function apiError(error: unknown): Response {
  if (error instanceof ApiError) return json({ error: error.message }, error.status);
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    const fallback: Partial<Record<z.ZodIssueCode, string>> = {
      invalid_type: "Veuillez renseigner les champs requis dans le bon format.",
      invalid_enum_value: "Choisissez une valeur proposée dans la liste.",
      unrecognized_keys: "Le formulaire contient un champ non autorisé.",
      too_big: "Un champ dépasse la longueur ou la taille autorisée.",
      too_small: "Veuillez compléter les champs requis.",
      invalid_string: "Veuillez vérifier le format des informations saisies.",
    };
    // Zod's default messages are English; retain our explicit French messages.
    const message = issue?.message && !/^(Required|Invalid |Expected |String must |Array must |Unrecognized key)/.test(issue.message)
      ? issue.message : fallback[issue?.code] || "Veuillez vérifier les informations saisies.";
    return json({ error: message }, 400);
  }
  console.error("QuickBuilding API failure", error instanceof Error ? error.message : "unknown");
  return json({ error: "Une erreur est survenue. Veuillez réessayer dans quelques instants." }, 500);
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) throw new ApiError(403, "Origine de la requête non autorisée.");
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new ApiError(403, "Requête non autorisée.");
}
export async function readBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(request.headers.get("content-length"));
  if (declared > maxBytes) throw new ApiError(413, "Le contenu envoyé est trop volumineux.");
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { await reader.cancel(); throw new ApiError(413, "Le contenu envoyé est trop volumineux."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}
export async function readJson(request: Request, maxBytes = 100_000): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ApiError(415, "Envoyez les données au format JSON.");
  const body = await readBody(request, maxBytes);
  try { return JSON.parse(new TextDecoder().decode(body)); }
  catch { throw new ApiError(400, "Le contenu envoyé est invalide."); }
}
export function validId(value: string) {
  if (!z.string().uuid().safeParse(value).success) throw new ApiError(404, "Élément introuvable.");
  return value;
}
