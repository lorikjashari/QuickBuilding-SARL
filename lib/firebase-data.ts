import { deleteDoc, doc, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { and, equal, execute, field } from "firebase/firestore/pipelines";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  CATEGORIES, createPostSchema, detectImage, MAX_UPLOAD_BYTES, slugify, validatePublication,
  type ContactMessage, type Post, type PostCategory,
} from "@/lib/content";
import { database, mediaStorage } from "@/lib/firebase";

type PostFields = {
  title: string; slug: string; excerpt: string; content: string; category: PostCategory;
  status: "draft" | "published"; image: string; imageAlt: string;
  gallery: { url: string; alt: string }[]; location: string;
  createdAt: Timestamp; updatedAt: Timestamp;
};

function iso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date(0).toISOString();
}

function asGallery(value: unknown): Post["gallery"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const photo = item as { url?: unknown; alt?: unknown };
    return typeof photo.url === "string" && photo.url ? [{ url: photo.url, alt: typeof photo.alt === "string" ? photo.alt : "" }] : [];
  });
}

function asPost(id: string, data: Record<string, unknown>): Post {
  const category = CATEGORIES.includes(data.category as PostCategory) ? data.category as PostCategory : "Construction";
  return {
    id,
    title: String(data.title ?? ""),
    slug: String(data.slug ?? ""),
    excerpt: String(data.excerpt ?? ""),
    content: String(data.content ?? ""),
    category,
    status: data.status === "published" ? "published" : "draft",
    image: String(data.image ?? ""),
    imageAlt: String(data.imageAlt ?? ""),
    gallery: asGallery(data.gallery),
    location: String(data.location ?? ""),
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt),
  };
}

function asMessage(id: string, data: Record<string, unknown>): ContactMessage {
  return {
    id,
    name: String(data.name ?? ""),
    email: String(data.email ?? ""),
    phone: String(data.phone ?? ""),
    service: String(data.service ?? ""),
    location: String(data.location ?? ""),
    message: String(data.message ?? ""),
    read: data.read === true,
    createdAt: iso(data.createdAt),
  };
}

async function postsQuery(status?: "published") {
  const pipeline = database().pipeline().collection("posts");
  const filtered = status ? pipeline.where(equal(field("status"), status)) : pipeline;
  const snapshot = await execute(filtered.sort(field("createdAt").descending()));
  return snapshot.results.flatMap((result) => result.id ? [asPost(result.id, result.data() as Record<string, unknown>)] : []);
}

export async function listPublishedPosts(): Promise<Post[]> {
  return postsQuery("published");
}

export async function listAllPosts(): Promise<Post[]> {
  return postsQuery();
}

export async function getPublishedPost(slug: string): Promise<Post | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 160) return null;
  const snapshot = await execute(database().pipeline().collection("posts").where(and(
    equal(field("slug"), slug),
    equal(field("status"), "published"),
  )).limit(1));
  const result = snapshot.results[0];
  return result?.id ? asPost(result.id, result.data() as Record<string, unknown>) : null;
}

async function postWithSlug(slug: string): Promise<Post | null> {
  const snapshot = await execute(database().pipeline().collection("posts").where(equal(field("slug"), slug)).limit(1));
  const result = snapshot.results[0];
  return result?.id ? asPost(result.id, result.data() as Record<string, unknown>) : null;
}

export async function savePost(input: unknown, existingId = ""): Promise<Post> {
  const data = createPostSchema.parse(input);
  validatePublication({ ...data, gallery: data.gallery });
  const id = existingId || crypto.randomUUID();
  let slug = data.slug || slugify(data.title);
  const taken = await postWithSlug(slug);
  if (taken && taken.id !== id) {
    if (data.slug) throw new Error("Cette adresse est déjà utilisée par une autre publication.");
    slug = `${slug}-${id.slice(0, 8)}`.replace(/-+$/, "").slice(0, 160);
  }
  const now = Timestamp.now();
  const fields: PostFields = {
    title: data.title, slug, excerpt: data.excerpt, content: data.content, category: data.category,
    status: data.status, image: data.image, imageAlt: data.imageAlt, gallery: data.gallery, location: data.location,
    createdAt: now, updatedAt: now,
  };
  const reference = doc(database(), "posts", id);
  if (existingId) {
    const { createdAt, ...changes } = fields;
    void createdAt;
    await updateDoc(reference, changes);
    const current = await postWithSlug(slug);
    return current ?? { ...asPost(id, { ...fields }), createdAt: taken?.createdAt || now.toDate().toISOString() };
  }
  await setDoc(reference, fields);
  return asPost(id, { ...fields });
}

export async function removePost(id: string): Promise<void> {
  await deleteDoc(doc(database(), "posts", id));
}

export async function uploadImage(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Chaque image doit peser moins de 8 Mo.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = detectImage(bytes);
  if (!image) throw new Error("Choisissez des images au format JPG, PNG ou WebP.");
  const key = `${crypto.randomUUID()}.${image.extension}`;
  const stored = ref(mediaStorage(), `media/${key}`);
  await uploadBytes(stored, bytes, { contentType: image.mime });
  return getDownloadURL(stored);
}

export async function createContactMessage(input: {
  name: string; email: string; phone: string; service: string; location: string; message: string;
}): Promise<void> {
  const id = crypto.randomUUID();
  await setDoc(doc(database(), "contact_messages", id), {
    name: input.name,
    email: input.email.toLowerCase(),
    phone: input.phone,
    service: input.service,
    location: input.location,
    message: input.message,
    read: false,
    createdAt: Timestamp.now(),
  });
}

export async function listContactMessages(): Promise<ContactMessage[]> {
  const snapshot = await execute(database().pipeline().collection("contact_messages").sort(field("createdAt").descending()));
  return snapshot.results.flatMap((result) => result.id ? [asMessage(result.id, result.data() as Record<string, unknown>)] : []);
}

export async function markContactRead(id: string): Promise<void> {
  await updateDoc(doc(database(), "contact_messages", id), { read: true });
}

export async function removeContactMessage(id: string): Promise<void> {
  await deleteDoc(doc(database(), "contact_messages", id));
}
