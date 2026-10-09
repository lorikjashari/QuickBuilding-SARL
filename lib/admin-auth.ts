import { env } from "cloudflare:workers";
import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { ApiError } from "@/lib/api";

export function isAdmin(user: ChatGPTUser | null): boolean {
  if (!user) return false;
  const ids = (env.ADMIN_USER_IDS || "").split(",").map((id) => id.trim()).filter(Boolean);
  const emails = (env.ADMIN_EMAILS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  // Identity headers are supplied and authenticated by Sites dispatch.
  // Explicit email allowlisting supports handover before a client's site-scoped ID is known.
  return ids.includes(user.userId) || emails.includes(user.email.trim().toLowerCase());
}
export async function requireAdmin(): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (!user) throw new ApiError(401, "Connectez-vous pour accéder à cet espace.");
  if (!isAdmin(user)) throw new ApiError(403, "Ce compte n’est pas autorisé à administrer le site.");
  return user;
}
