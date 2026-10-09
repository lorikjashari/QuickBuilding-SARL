import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(), title: text("title").notNull(), slug: text("slug").notNull(),
  excerpt: text("excerpt").notNull().default(""), content: text("content").notNull().default(""),
  category: text("category").notNull().default("Construction"), status: text("status").notNull().default("draft"),
  image: text("image").notNull().default(""), imageAlt: text("image_alt").notNull().default(""),
  gallery: text("gallery").notNull().default("[]"), location: text("location").notNull().default(""),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("posts_slug_unique").on(table.slug), index("posts_status_created").on(table.status, table.createdAt)]);

export const contactMessages = sqliteTable("contact_messages", {
  id: text("id").primaryKey(), name: text("name").notNull(), email: text("email").notNull(),
  phone: text("phone").notNull().default(""), service: text("service").notNull(),
  location: text("location").notNull().default(""), message: text("message").notNull(),
  read: integer("read", { mode: "boolean" }).notNull().default(false), createdAt: text("created_at").notNull(),
}, (table) => [index("contact_created").on(table.createdAt)]);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(), count: integer("count").notNull().default(1), expiresAt: integer("expires_at").notNull(),
}, (table) => [index("rate_expiry").on(table.expiresAt)]);
