import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isAdmin, requireAdmin } from "@/lib/admin-auth";
import { ApiError, apiError, json, readJson, requireSameOrigin, validId } from "@/lib/api";
import { updatePostSchema, validatePublication } from "@/lib/content";
import { database, mapPost, type PostRow } from "@/lib/storage";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (!/^[a-z0-9-]{1,160}$/.test(id)) throw new ApiError(404, "Publication introuvable.");
    const row = await database().prepare("SELECT * FROM posts WHERE id = ? OR slug = ? LIMIT 1").bind(id, id).first<PostRow>();
    if (!row || (row.status !== "published" && !isAdmin(await getChatGPTUser()))) throw new ApiError(404, "Publication introuvable.");
    return json({ post: mapPost(row) });
  } catch (error) { return apiError(error); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    await requireAdmin();
    const id = validId((await context.params).id);
    const data = updatePostSchema.parse(await readJson(request));
    const row = await database().prepare("SELECT * FROM posts WHERE id = ?").bind(id).first<PostRow>();
    if (!row) throw new ApiError(404, "Publication introuvable.");
    const post = { ...mapPost(row), ...data, updatedAt: new Date().toISOString() };
    validatePublication(post);
    try {
      await database().prepare("UPDATE posts SET title = ?, slug = ?, excerpt = ?, content = ?, category = ?, status = ?, image = ?, image_alt = ?, gallery = ?, location = ?, updated_at = ? WHERE id = ?")
        .bind(post.title, post.slug, post.excerpt, post.content, post.category, post.status, post.image, post.imageAlt, JSON.stringify(post.gallery), post.location, post.updatedAt, id).run();
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE")) throw new ApiError(409, "Cette adresse est déjà utilisée par une autre publication.");
      throw error;
    }
    return json({ post });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    await requireAdmin();
    const id = validId((await context.params).id);
    const result = await database().prepare("DELETE FROM posts WHERE id = ?").bind(id).run();
    if (!result.meta.changes) throw new ApiError(404, "Publication introuvable.");
    return json({ success: true });
  } catch (error) { return apiError(error); }
}
