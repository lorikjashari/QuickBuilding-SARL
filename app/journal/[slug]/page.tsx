/* eslint-disable @next/next/no-img-element -- Publication images are served by the R2 media API. */
import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, MapPin } from "lucide-react";
import { Header, Footer } from "@/components/site-chrome";
import JournalGallery from "@/components/journal/journal-gallery";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isAdmin } from "@/lib/admin-auth";
import { database, mapPost, type PostRow } from "@/lib/storage";
import "../journal.css";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
const getPost = cache(async (slug: string) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 160) notFound();
  const row = await database().prepare("SELECT * FROM posts WHERE slug = ? LIMIT 1").bind(slug).first<PostRow>();
  if (!row || (row.status !== "published" && !isAdmin(await getChatGPTUser()))) notFound();
  return mapPost(row);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost((await params).slug);
  return {
    title: post.title, description: post.excerpt || `${post.title} — Le journal de Quickbuilding, à Carouge, Genève.`,
    alternates: { canonical: `/journal/${post.slug}` },
    robots: post.status === "draft" ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { type: "article", locale: "fr_CH", title: post.title, description: post.excerpt, url: `/journal/${post.slug}`, publishedTime: post.createdAt, modifiedTime: post.updatedAt, authors: ["Quick Building Sàrl"], images: post.image ? [{ url: post.image, alt: post.imageAlt }] : [] },
    twitter: { card: post.image ? "summary_large_image" : "summary", title: post.title, description: post.excerpt, images: post.image ? [post.image] : [] },
  };
}

export default async function PostPage({ params }: Props) {
  const post = await getPost((await params).slug);
  const formattedDate = new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "long", year: "numeric" }).format(new Date(post.updatedAt));
  return <div id="top" className="journal-page"><Header /><main id="main"><article className="journal-article section-pad"><Link className="journal-back" href="/journal"><ArrowLeft size={15} /> Toutes les histoires</Link>{post.status === "draft" && <p className="journal-draft-notice">Brouillon — cette publication n’est visible que par l’équipe autorisée.</p>}<header className="journal-article-header"><span className="eyebrow"><span className="tiny-cross">+</span> {post.category}</span><h1>{post.title}</h1><p className="journal-article-intro">{post.excerpt}</p><div className="journal-article-meta"><span>QUICKBUILDING</span><time dateTime={post.updatedAt}>Mis à jour le {formattedDate}</time>{post.location && <span><MapPin size={13} />{post.location}</span>}</div></header>{post.image && <figure className="journal-article-cover"><img src={post.image} alt={post.imageAlt || post.title} fetchPriority="high" /></figure>}<div className="journal-article-body"><aside><span className="eyebrow">AU FIL DU PROJET</span><span>{post.category}</span>{post.location && <span>{post.location}</span>}<span className="journal-article-aside-line" /><Link href="/#contact">Un projet similaire ?<ArrowUpRight size={17} /></Link></aside><div className="journal-prose">{post.content.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></div>{post.gallery.length > 0 && <section className="journal-article-gallery"><div><span className="eyebrow">DANS LE DÉTAIL</span><h2>Le projet, <em>en images.</em></h2></div><JournalGallery images={post.gallery} title={post.title} /></section>}<div className="journal-article-end"><Link className="journal-back" href="/journal"><ArrowLeft size={15} /> Retour au journal</Link><span>QUICKBUILDING · LE SENS DU TRAVAIL BIEN FAIT</span></div></article><section className="journal-contact-band section-pad"><div><span className="eyebrow">VOTRE PROJET PREND FORME</span><h2>Parlons de <em>vos envies.</em></h2></div><Link className="button button-dark" href="/#contact">Rencontrons-nous <ArrowUpRight size={18} /></Link></section></main><Footer /></div>;
}
