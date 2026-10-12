import { z } from "zod";

export const CATEGORIES = ["Construction", "Rénovation", "Maçonnerie", "Vie de l’entreprise"] as const;
export type PostCategory = (typeof CATEGORIES)[number];
export type Post = {
  id: string; title: string; slug: string; excerpt: string; content: string;
  category: PostCategory; status: "draft" | "published"; image: string; imageAlt: string;
  gallery: { url: string; alt: string }[]; location: string; createdAt: string; updatedAt: string;
};
export type ContactMessage = {
  id: string; name: string; email: string; phone: string; service: string;
  location: string; message: string; read: boolean; createdAt: string;
};

export const MEDIA_KEY = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(jpg|png|webp)$/;
const imageUrl = z.string().max(2000).refine((value) => {
  if (value === "") return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "firebasestorage.googleapis.com";
  } catch { return false; }
}, "L’image doit provenir de la médiathèque.");
const fields = {
  title: z.string().trim().min(3, "Le titre doit contenir au moins 3 caractères.").max(150),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Utilisez des lettres minuscules, des chiffres et des tirets pour l’adresse.").max(160),
  excerpt: z.string().trim().max(320), content: z.string().trim().max(50000),
  category: z.enum(CATEGORIES), status: z.enum(["draft", "published"]), image: imageUrl,
  imageAlt: z.string().trim().max(220),
  gallery: z.array(z.object({ url: imageUrl.refine(Boolean, "Une image est nécessaire."), alt: z.string().trim().max(220) }).strict()).max(12),
  location: z.string().trim().max(160),
};
export const createPostSchema = z.object({
  ...fields, slug: fields.slug.optional(), excerpt: fields.excerpt.default(""), content: fields.content.default(""),
  category: fields.category.default("Construction"), status: fields.status.default("draft"), image: fields.image.default(""),
  imageAlt: fields.imageAlt.default(""), gallery: fields.gallery.default([]), location: fields.location.default(""),
}).strict();
export const updatePostSchema = z.object(fields).partial().strict().refine((v) => Object.keys(v).length > 0, "Aucune modification à enregistrer.");
export function validatePublication(post: Pick<Post, "status" | "excerpt" | "content" | "image" | "imageAlt" | "gallery">) {
  if (post.status !== "published") return;
  const issues: z.ZodIssue[] = [];
  if (!post.excerpt.trim() || !post.content.trim()) issues.push({ code: "custom", path: ["content"], message: "Ajoutez une introduction et un texte avant de publier." });
  if ((post.image && !post.imageAlt.trim()) || post.gallery.some((photo) => !photo.alt.trim())) issues.push({ code: "custom", path: ["imageAlt"], message: "Décrivez chaque image avant de publier." });
  if (issues.length) throw new z.ZodError(issues);
}
export const contactSchema = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom.").max(120),
  email: z.string().trim().email("Indiquez une adresse e-mail valide.").max(254),
  phone: z.string().trim().max(40).default(""), service: z.string().trim().min(2, "Choisissez une prestation.").max(120),
  location: z.string().trim().max(160).default(""),
  message: z.string().trim().min(10, "Décrivez votre projet en quelques mots.").max(6000),
  privacy: z.literal(true, { errorMap: () => ({ message: "Veuillez accepter le traitement de votre demande." }) }),
  website: z.string().max(300).default(""),
}).strict();

export function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 140).replace(/-+$/, "") || "actualite";
}
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export function detectImage(bytes: Uint8Array): { extension: "jpg" | "png" | "webp"; mime: string } | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { extension: "jpg", mime: "image/jpeg" };
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)) return { extension: "png", mime: "image/png" };
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { extension: "webp", mime: "image/webp" };
  return null;
}
