import { apiError, json } from "@/lib/api";
import { listPublishedPosts } from "@/lib/firebase-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json({ posts: await listPublishedPosts() });
  } catch (error) {
    return apiError(error);
  }
}
