import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isAdmin } from "@/lib/admin-auth";
import { apiError, json } from "@/lib/api";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await getChatGPTUser();
    return json({ user: user ? { userId: user.userId, displayName: user.displayName, email: user.email } : null, isAdmin: isAdmin(user) });
  } catch (error) { return apiError(error); }
}
