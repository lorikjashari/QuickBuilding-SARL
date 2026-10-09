import { env } from "cloudflare:workers";
import { ApiError } from "@/lib/api";
import type { ContactMessage, Post } from "@/lib/content";

export function database(): D1Database {
  if (!env.DB) throw new ApiError(503, "Le service est temporairement indisponible.");
  return env.DB;
}
export function bucket(): R2Bucket {
  if (!env.BUCKET) throw new ApiError(503, "Le stockage des images est temporairement indisponible.");
  return env.BUCKET;
}
export type PostRow = Omit<Post, "imageAlt" | "gallery" | "createdAt" | "updatedAt"> & { image_alt: string; gallery: string; created_at: string; updated_at: string };
export function mapPost(row: PostRow): Post {
  return { id: row.id, title: row.title, slug: row.slug, excerpt: row.excerpt, content: row.content, category: row.category, status: row.status, image: row.image, imageAlt: row.image_alt, gallery: JSON.parse(row.gallery), location: row.location, createdAt: row.created_at, updatedAt: row.updated_at };
}
export type ContactRow = Omit<ContactMessage, "read" | "createdAt"> & { read: number; created_at: string };
export function mapContact(row: ContactRow): ContactMessage {
  return { id: row.id, name: row.name, email: row.email, phone: row.phone, service: row.service, location: row.location, message: row.message, read: Boolean(row.read), createdAt: row.created_at };
}
export async function rateLimit(key: string, max: number, windowSeconds = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const result = await database().prepare("INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN expires_at <= ? THEN 1 ELSE count + 1 END, expires_at = CASE WHEN expires_at <= ? THEN ? ELSE expires_at END RETURNING count")
    .bind(key, now + windowSeconds, now, now, now + windowSeconds).first<{ count: number }>();
  if (!result || result.count > max) throw new ApiError(429, "Trop de demandes ont été envoyées. Veuillez réessayer dans une heure ou nous appeler.");
  await database().prepare("DELETE FROM rate_limits WHERE expires_at < ?").bind(now - 86400).run();
}
export async function fingerprint(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
