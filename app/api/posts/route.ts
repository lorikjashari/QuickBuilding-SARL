import { requireAdmin } from "@/lib/admin-auth";
import { ApiError, apiError, json, readJson, requireSameOrigin } from "@/lib/api";
import { createPostSchema, slugify, validatePublication } from "@/lib/content";
import { database, mapPost, type PostRow } from "@/lib/storage";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const admin = new URL(request.url).searchParams.get("admin") === "1";
    if (admin) await requireAdmin();
    const query = admin ? "SELECT * FROM posts ORDER BY created_at DESC" : "SELECT * FROM posts WHERE status = 'published' ORDER BY created_at DESC";
    const result = await database().prepare(query).all<PostRow>();
    return json({ posts: result.results.map(mapPost) });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await requireAdmin();
    const data = createPostSchema.parse(await readJson(request));
    validatePublication(data);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    let slug = data.slug || slugify(data.title);
    const duplicate = await database().prepare("SELECT id FROM posts WHERE slug = ?").bind(slug).first();
    if (duplicate && data.slug) throw new ApiError(409, "Cette adresse est déjà utilisée par une autre publication.");
    if (duplicate) slug += `-${id.slice(0, 8)}`;
    try {
      await database().prepare("INSERT INTO posts (id, title, slug, excerpt, content, category, status, image, image_alt, gallery, location, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, data.title, slug, data.excerpt, data.content, data.category, data.status, data.image, data.imageAlt, JSON.stringify(data.gallery), data.location, now, now).run();
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE")) throw new ApiError(409, "Cette adresse est déjà utilisée par une autre publication.");
      throw error;
    }
    return json({ post: { ...data, id, slug, createdAt: now, updatedAt: now } }, 201);
  } catch (error) { return apiError(error); }
}
