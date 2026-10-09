import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { ApiError, apiError, json, readJson, requireSameOrigin, validId } from "@/lib/api";
import { database, mapContact, type ContactRow } from "@/lib/storage";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    await requireAdmin();
    const id = validId((await context.params).id);
    const { read } = z.object({ read: z.boolean() }).strict().parse(await readJson(request, 1000));
    const row = await database().prepare("UPDATE contact_messages SET read = ? WHERE id = ? RETURNING *").bind(read ? 1 : 0, id).first<ContactRow>();
    if (!row) throw new ApiError(404, "Demande introuvable.");
    return json({ message: mapContact(row) });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    await requireAdmin();
    const id = validId((await context.params).id);
    const result = await database().prepare("DELETE FROM contact_messages WHERE id = ?").bind(id).run();
    if (!result.meta.changes) throw new ApiError(404, "Demande introuvable.");
    return json({ success: true });
  } catch (error) { return apiError(error); }
}
