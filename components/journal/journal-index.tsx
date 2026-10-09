"use client";
/* eslint-disable react-hooks/set-state-in-effect -- The effect owns the abortable remote publication request. */

/* eslint-disable @next/next/no-img-element -- Publication images are served by the R2 media API. */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Building2, LoaderCircle, Search, X } from "lucide-react";
import type { Post } from "@/lib/content";

const categories = ["Tout le journal", "Construction", "Rénovation", "Maçonnerie", "Vie de l’entreprise"];
const formatDate = (value: string) => new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));

export default function JournalIndex() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [category, setCategory] = useState(categories[0]);
  const [search, setSearch] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(false);
    try {
      const response = await fetch("/api/posts", { signal });
      if (!response.ok) throw new Error("Unavailable");
      const body: { posts: Post[] } = await response.json();
      setPosts(body.posts);
    } catch (reason) { if (reason instanceof DOMException && reason.name === "AbortError") return; setError(true); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  const visible = posts.filter(post => (category === categories[0] || post.category === category) && `${post.title} ${post.excerpt} ${post.location}`.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr")));
  return <><section className="journal-entries section-pad" aria-label="Publications"><div className="journal-controls"><div className="journal-categories" aria-label="Catégories">{categories.map(item => <button key={item} aria-pressed={item === category} onClick={() => setCategory(item)} className={item === category ? "selected" : ""}>{item}</button>)}</div><label className="journal-search"><Search size={16} /><input type="search" placeholder="Chercher une histoire…" value={search} onChange={event => setSearch(event.target.value)} aria-label="Rechercher dans le journal" />{search && <button aria-label="Effacer la recherche" onClick={() => setSearch("")}><X size={15} /></button>}</label></div>
    {loading ? <div className="journal-state" role="status"><LoaderCircle className="journal-spin" size={28} /><p>Les nouvelles arrivent…</p></div> : error ? <div className="journal-state" role="alert"><span className="journal-state-number">UN INSTANT.</span><h2>Le journal fait une pause.</h2><p>Nous n’avons pas pu charger les publications.<br />Vous pouvez réessayer dans un instant.</p><button className="button button-dark" onClick={() => void load()}>Réessayer <ArrowUpRight size={17} /></button></div> : visible.length ? <><div className="journal-result-count" aria-live="polite">{visible.length} {visible.length === 1 ? "histoire à découvrir" : "histoires à découvrir"}</div><div className="journal-grid">{visible.map((post, index) => <article className="journal-card" key={post.id}><Link href={`/journal/${post.slug}`} className="journal-card-link"><div className="journal-card-image">{post.image ? <img src={post.image} alt={post.imageAlt || post.title} loading={index < 3 ? "eager" : "lazy"} /> : <div className="journal-card-placeholder"><Building2 size={47} strokeWidth={1} /><span>QUICKBUILDING</span></div>}<span className="journal-card-arrow"><ArrowUpRight size={22} /></span></div><div className="journal-card-meta"><span>{post.category}</span><time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time></div><h2>{post.title}</h2><p>{post.excerpt}</p><span className="journal-card-read">Découvrir l’histoire <ArrowUpRight size={15} /></span></Link></article>)}</div></> : <div className="journal-state"><span className="journal-state-number">{posts.length ? "UNE AUTRE PISTE ?" : "CHAQUE PROJET A SON HISTOIRE."}</span><h2>{posts.length ? "Cette histoire reste à trouver." : <>La suite s’écrit.<br /><em>À nos côtés.</em></>}</h2><p>{posts.length ? "Aucune publication ne correspond à votre recherche." : "Nos réalisations et les nouvelles de notre entreprise seront bientôt réunies ici."}</p>{posts.length ? <button className="button button-dark" onClick={() => { setSearch(""); setCategory(categories[0]); }}>Voir tout le journal <ArrowUpRight size={17} /></button> : <Link className="button button-dark" href="/#contact">Et si nous parlions de votre projet ? <ArrowUpRight size={17} /></Link>}</div>}
  </section><section className="journal-contact-band section-pad"><div><span className="eyebrow">LE PROCHAIN CHAPITRE</span><h2>Et si c’était <em>votre projet ?</em></h2></div><Link className="button button-dark" href="/#contact">Écrivons la suite ensemble <ArrowUpRight size={18} /></Link></section></>;
}
