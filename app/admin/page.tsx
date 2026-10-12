"use client";

/* eslint-disable @next/next/no-img-element -- Uploaded images are served directly from the media API without an image optimization service. */

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/content";
import { ADMIN_EMAIL, ADMIN_LOGIN } from "@/lib/firebase-config";
import { listAllPosts, listContactMessages, markContactRead, removeContactMessage, removePost, savePost as storePost, uploadImage } from "@/lib/firebase-data";
import { firebaseApp } from "@/lib/firebase";
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle2,
  ChevronRight, CircleHelp, Eye, FileText, ImagePlus, Inbox, LayoutDashboard,
  LoaderCircle, LogOut, Mail, MapPin, Menu, Pencil, Plus,
  RefreshCw, Save, Search, ShieldCheck, Trash2, Upload, X,
} from "lucide-react";
import "./admin.css";

type Category = "Construction" | "Rénovation" | "Maçonnerie" | "Vie de l’entreprise";
type Post = {
  id: string; title: string; slug: string; excerpt: string; content: string;
  category: Category; status: "draft" | "published"; image: string; imageAlt: string;
  gallery: { url: string; alt: string }[]; location: string; createdAt: string; updatedAt: string;
};
type Message = { id: string; name: string; email: string; phone: string; service: string; location: string; message: string; createdAt: string; read: boolean };
type Session = { user: { userId: string; displayName: string; email: string } | null; isAdmin: boolean };
type Section = "overview" | "posts" | "inbox" | "editor";
const categories: Category[] = ["Construction", "Rénovation", "Maçonnerie", "Vie de l’entreprise"];
const blankPost = (): Post => ({ id: "", title: "", slug: "", excerpt: "", content: "", category: "Construction", status: "draft", image: "", imageAlt: "", gallery: [], location: "", createdAt: "", updatedAt: "" });
const date = (value: string) => value ? new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "À l’instant";
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function auth() { return getAuth(firebaseApp()); }
function loginEmail(value: string) {
  const login = value.trim().toLowerCase();
  return login === ADMIN_LOGIN ? ADMIN_EMAIL : login;
}
function actionMessage(error: unknown, fallback: string) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code.includes("permission-denied")) return "Action refusée. Déconnectez-vous, reconnectez-vous, puis réessayez.";
  if (code.includes("unavailable") || code.includes("network-request-failed")) return "Connexion interrompue. Vérifiez votre réseau, puis réessayez.";
  if (error instanceof Error && error.message && !/Missing or insufficient permissions|FirebaseError/.test(error.message)) return error.message;
  return fallback;
}
function authMessage(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-email") return "Identifiant ou mot de passe incorrect.";
  if (code === "auth/too-many-requests") return "Trop de tentatives. Réessayez dans quelques minutes.";
  if (error instanceof Error && error.message) return error.message;
  return "La connexion a échoué. Réessayez.";
}

function Brand({ light = false }: { light?: boolean }) {
  return <span className={`admin-brand ${light ? "admin-brand-light" : ""}`}><img src="/logo.png" alt="" /></span>;
}

function Modal({ children, label, onClose, wide = false }: { children: React.ReactNode; label: string; onClose: () => void; wide?: boolean }) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, textarea, select, [tabindex="0"]');
        if (!items?.length) { event.preventDefault(); return; }
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener("keydown", handleKey); previous?.focus(); };
  }, [onClose]);
  return <div className="admin-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div className={`admin-modal ${wide ? "admin-modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={label} ref={dialog} tabIndex={-1}>{children}</div></div>;
}

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionError, setSessionError] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [draft, setDraft] = useState<Post>(blankPost);
  const [original, setOriginal] = useState(JSON.stringify(blankPost()));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState<Post | null>(null);
  const [preview, setPreview] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [deleteMessageConfirm, setDeleteMessageConfirm] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const titleInput = useRef<HTMLInputElement>(null);
  const dirty = section === "editor" && JSON.stringify(draft) !== original;
  const unread = messages.filter(message => !message.read).length;
  const published = posts.filter(post => post.status === "published").length;
  const drafts = posts.filter(post => post.status === "draft").length;

  const loadContent = useCallback(async () => {
    setLoading(true); setError("");
    const [postResult, messageResult] = await Promise.allSettled([
      listAllPosts(), listContactMessages(),
    ]);
    if (postResult.status === "fulfilled") setPosts(postResult.value);
    if (messageResult.status === "fulfilled") setMessages(messageResult.value);
    const failure = [postResult, messageResult].find(result => result.status === "rejected");
    if (failure?.status === "rejected") setError(failure.reason instanceof Error ? failure.reason.message : "Impossible de charger les données.");
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(getAuth(firebaseApp()), user => {
        if (!active) return;
        const email = user?.email?.toLowerCase() || "";
        const next = { user: user ? { userId: user.uid, displayName: user.displayName || "Administrateur", email } : null, isAdmin: email === ADMIN_EMAIL };
        setSession(next);
        if (next.isAdmin) void loadContent(); else setLoading(false);
      });
    } catch (reason) {
      setSessionError(reason instanceof Error ? reason.message : "Firebase n’est pas encore configuré.");
      setLoading(false);
    }
    return () => { active = false; unsubscribe(); };
  }, [loadContent]);

  const openAdmin = async (event: FormEvent) => {
    event.preventDefault();
    setSessionError(""); setSigningIn(true);
    try { await signInWithEmailAndPassword(auth(), loginEmail(login), password); }
    catch (reason) { setSessionError(authMessage(reason)); }
    finally { setSigningIn(false); }
  };

  const leaveAdmin = async () => {
    if (dirty && !window.confirm("Quitter sans enregistrer les modifications ?")) return;
    await signOut(auth());
  };

  useEffect(() => {
    if (!dirty && !uploading && !busy) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty, uploading, busy]);

  const navigate = (next: Section) => {
    if (busy || uploading) { setError("Veuillez attendre la fin de l’enregistrement ou du transfert."); return; }
    if (dirty && !window.confirm("Vos modifications ne sont pas enregistrées. Quitter sans les enregistrer ?")) return;
    setSection(next); setSidebarOpen(false); setError(""); setNotice("");
  };

  const editPost = (post?: Post) => {
    if (busy || uploading) { setError("Veuillez attendre la fin de l’enregistrement ou du transfert."); return; }
    if (dirty && !window.confirm("Quitter cette publication sans enregistrer vos modifications ?")) return;
    const value = post ? { ...post, gallery: post.gallery || [] } : blankPost();
    setDraft(value); setOriginal(JSON.stringify(value)); setSection("editor"); setError(""); setNotice(""); setSidebarOpen(false);
    window.setTimeout(() => titleInput.current?.focus(), 100);
  };

  const savePost = async (nextStatus: Post["status"]) => {
    setError(""); setNotice("");
    if (draft.title.trim().length < 3) { setError("Donnez un titre d’au moins 3 caractères à votre publication."); titleInput.current?.focus(); return; }
    if (nextStatus === "published" && (!draft.excerpt.trim() || !draft.content.trim())) { setError("Ajoutez une introduction et un texte avant de publier."); return; }
    if (nextStatus === "published" && draft.image && !draft.imageAlt.trim()) { setError("Décrivez l’image de couverture pour la rendre accessible à tous."); return; }
    if (nextStatus === "published" && draft.gallery.some(photo => !photo.alt.trim())) { setError("Ajoutez une description à chaque photo de la galerie avant de publier."); return; }
    setBusy(true);
    try {
      const payload = { title: draft.title.trim(), slug: slugify(draft.slug || draft.title), excerpt: draft.excerpt, content: draft.content, category: draft.category, status: nextStatus, image: draft.image, imageAlt: draft.imageAlt, gallery: draft.gallery, location: draft.location };
      const result = await storePost(payload, draft.id);
      setPosts(current => [result, ...current.filter(post => post.id !== result.id)]);
      setDraft(result); setOriginal(JSON.stringify(result));
      setNotice(nextStatus === "published" ? "Votre publication est en ligne." : "Votre brouillon est enregistré.");
    } catch (reason) { setError(actionMessage(reason, "L’enregistrement a échoué. Votre texte est conservé.")); }
    finally { setBusy(false); }
  };

  const uploadFiles = async (files: FileList | null, gallery = false) => {
    if (!files?.length) return;
    setError("");
    const selected = Array.from(files);
    if (selected.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) { setError("Choisissez des images au format JPG, PNG ou WebP."); return; }
    if (selected.some(file => file.size > MAX_UPLOAD_BYTES)) { setError(`Chaque image doit peser moins de ${MAX_UPLOAD_MB} Mo.`); return; }
    if (gallery && draft.gallery.length + selected.length > 12) { setError("La galerie peut contenir jusqu’à 12 images."); return; }
    setUploading(true);
    try {
      for (const file of selected) {
        const url = await uploadImage(file);
        setDraft(current => gallery ? { ...current, gallery: [...current.gallery, { url, alt: "" }] } : { ...current, image: url, imageAlt: "" });
      }
    } catch (reason) { setError(actionMessage(reason, "Le transfert de l’image a échoué.")); }
    finally { setUploading(false); }
  };

  const persistDraft = async (next: Post, success: string) => {
    if (!next.id) { setDraft(next); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const payload = { title: next.title.trim(), slug: slugify(next.slug || next.title), excerpt: next.excerpt, content: next.content, category: next.category, status: next.status, image: next.image, imageAlt: next.imageAlt, gallery: next.gallery, location: next.location };
      const result = await storePost(payload, next.id);
      setPosts(current => [result, ...current.filter(post => post.id !== result.id && post.slug !== result.slug)]);
      setDraft(result); setOriginal(JSON.stringify(result));
      setNotice(success);
    } catch (reason) { setError(actionMessage(reason, "La photo n’a pas pu être retirée.")); }
    finally { setBusy(false); }
  };

  const deletePost = async () => {
    if (!deleting) return;
    setBusy(true); setError("");
    try {
      await removePost(deleting.id);
      setPosts(current => current.filter(post => post.id !== deleting.id));
      setDeleting(null); setNotice("La publication a été supprimée.");
    } catch (reason) { setError(actionMessage(reason, "La suppression a échoué.")); setDeleting(null); }
    finally { setBusy(false); }
  };

  const openMessage = async (message: Message) => {
    setDeleteMessageConfirm(false);
    setSelectedMessage(message);
    if (message.read) return;
    try {
      await markContactRead(message.id);
      setMessages(current => current.map(item => item.id === message.id ? { ...item, read: true } : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Impossible de marquer le message comme lu."); }
  };

  const deleteMessage = async () => {
    if (!selectedMessage) return;
    setBusy(true); setError("");
    try {
      await removeContactMessage(selectedMessage.id);
      setMessages(current => current.filter(message => message.id !== selectedMessage.id));
      setSelectedMessage(null); setDeleteMessageConfirm(false); setNotice("La demande a été supprimée.");
    } catch (reason) {
      setSelectedMessage(null); setDeleteMessageConfirm(false);
      setError(actionMessage(reason, "La suppression de la demande a échoué."));
    } finally { setBusy(false); }
  };

  const closePreview = useCallback(() => setPreview(false), []);
  const closeMessage = useCallback(() => setSelectedMessage(null), []);
  const closeDelete = useCallback(() => { if (!busy) setDeleting(null); }, [busy]);
  const filteredPosts = posts.filter(post => (status === "all" || post.status === status) && (category === "all" || post.category === category) && `${post.title} ${post.excerpt} ${post.location}`.toLowerCase().includes(query.toLowerCase()));

  if (!session?.isAdmin) return <main className="admin-gate">
    <div className="admin-gate-art"><Link href="/" aria-label="Quickbuilding, accueil"><Brand light /></Link><div className="admin-gate-lines" aria-hidden="true"><span /><span /><span /><i /></div><div className="admin-gate-statement"><span className="admin-eyebrow">VOTRE SAVOIR-FAIRE, MIS EN LUMIÈRE.</span><h1>De beaux projets.<br />Une belle vitrine.</h1><p>Un espace pour partager ce que vous construisez.</p></div><span className="admin-gate-region">QUICK BUILDING SÀRL · GENÈVE</span></div>
    <div className="admin-gate-content"><Link className="admin-back" href="/"><ArrowLeft size={16} /> Retour au site</Link><div className="admin-gate-card"><span className="admin-gate-icon"><ShieldCheck size={27} strokeWidth={1.4} /></span><span className="admin-eyebrow">ESPACE PRIVÉ</span><h2>{session?.user ? "Votre espace d’administration" : "Bienvenue chez vous."}</h2>
      {loading ? <p className="admin-loading"><LoaderCircle className="admin-spin" size={18} /> Vérification de votre accès…</p> : session?.user ? <><p>Vous êtes connecté avec <strong>{session.user.email || session.user.displayName}</strong>. Ce compte n’a pas accès à l’administration.</p><button className="admin-btn admin-btn-secondary" onClick={() => void signOut(auth())}>Changer de compte <ArrowRight size={17} /></button></> : <><p>Vos réalisations, vos actualités et vos demandes de contact. Tout est ici, simplement.</p><form className="admin-gate-form" onSubmit={event => void openAdmin(event)}><label className="admin-field">Identifiant<input value={login} onChange={event => setLogin(event.target.value)} autoComplete="username" required /></label><label className="admin-field">Mot de passe<input value={password} onChange={event => setPassword(event.target.value)} type="password" autoComplete="current-password" required /></label>{sessionError && <p className="admin-error" role="alert">{sessionError}</p>}<button className="admin-btn admin-btn-primary admin-gate-login" disabled={signingIn} type="submit">{signingIn ? <LoaderCircle className="admin-spin" size={18} /> : null}Ouvrir l’espace <ArrowRight size={18} /></button></form><p className="admin-gate-secure"><ShieldCheck size={14} /> Accès réservé à l’administrateur.</p></>}
    </div><span className="admin-gate-bottom">Un espace pensé pour faire vivre votre entreprise.</span></div>
  </main>;

  return <div className="admin-shell">
    {sidebarOpen && <button aria-label="Fermer le menu" className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
    <aside className={`admin-sidebar ${sidebarOpen ? "admin-sidebar-open" : ""}`}><Link href="/" aria-label="Quickbuilding, accueil" onClick={event => { if (dirty && !window.confirm("Quitter sans enregistrer les modifications ?")) event.preventDefault(); }}><Brand /></Link><span className="admin-sidebar-label">VOTRE ESPACE</span><nav aria-label="Administration">
      <button className={section === "overview" ? "active" : ""} onClick={() => navigate("overview")}><LayoutDashboard size={18} /> Vue d’ensemble</button>
      <button className={["posts", "editor"].includes(section) ? "active" : ""} onClick={() => navigate("posts")}><FileText size={18} /> Publications <span>{posts.length}</span></button>
      <button className={section === "inbox" ? "active" : ""} onClick={() => navigate("inbox")}><Inbox size={18} /> Demandes {unread > 0 && <span className="admin-nav-count">{unread}</span>}</button>
    </nav><div className="admin-sidebar-note"><span className="admin-note-dot" /><strong>Votre site, vivant.</strong><p>Chaque projet mérite<br />d’être partagé.</p><button onClick={() => editPost()}>Raconter un projet <ArrowUpRight size={16} /></button></div><div className="admin-sidebar-bottom"><a href="/" target="_blank" rel="noreferrer">Voir le site <ArrowUpRight size={16} /></a><div className="admin-profile"><span>{(session.user?.displayName || "Q").slice(0, 1).toUpperCase()}</span><div><strong>{session.user?.displayName || "Administrateur"}</strong><small>Administrateur</small></div><button type="button" title="Se déconnecter" aria-label="Se déconnecter" onClick={() => void leaveAdmin()}><LogOut size={17} /></button></div></div></aside>
    <div className="admin-workspace"><header className="admin-topbar"><div><button className="admin-mobile-menu admin-icon-btn" aria-label="Ouvrir le menu" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}><Menu size={21} /></button><span>Administration</span><ChevronRight size={13} /><strong>{{ overview: "Vue d’ensemble", posts: "Publications", inbox: "Demandes", editor: draft.id ? "Modifier une publication" : "Nouvelle publication" }[section]}</strong></div><a href="/" target="_blank" rel="noreferrer">Quickbuilding.ch <ArrowUpRight size={14} /></a></header>
    <main className="admin-main">
      {error && <div className="admin-feedback admin-feedback-error" role="alert"><CircleHelp size={18} /><span>{error}</span><button aria-label="Fermer le message" onClick={() => setError("")}><X size={17} /></button></div>}
      {notice && <div className="admin-feedback admin-feedback-success" role="status"><CheckCircle2 size={18} /><span>{notice}</span>{section === "editor" && draft.status === "published" && <a href={`/journal/${draft.slug}`} target="_blank" rel="noreferrer">Voir en ligne <ArrowUpRight size={14} /></a>}<button aria-label="Fermer le message" onClick={() => setNotice("")}><X size={17} /></button></div>}

      {section === "overview" && <>
        <div className="admin-page-heading"><div><span className="admin-eyebrow">LE FIL DE VOTRE ENTREPRISE</span><h1>Un regard sur l’essentiel.</h1><p>Bienvenue. Faisons vivre votre savoir-faire.</p></div><button className="admin-btn admin-btn-primary" onClick={() => editPost()}><Plus size={18} /> Nouvelle publication</button></div>
        <div className="admin-stats"><button onClick={() => { setStatus("published"); navigate("posts"); }}><span>Publications en ligne <ArrowUpRight size={17} /></span><strong>{loading ? "—" : String(published).padStart(2, "0")}</strong><small><span className="admin-status-dot" /> Visibles sur votre site</small></button><button onClick={() => { setStatus("draft"); navigate("posts"); }}><span>Brouillons <FileText size={17} /></span><strong>{loading ? "—" : String(drafts).padStart(2, "0")}</strong><small>Des histoires à terminer</small></button><button className="admin-stat-accent" onClick={() => { setUnreadOnly(true); navigate("inbox"); }}><span>Nouvelles demandes <ArrowDownLeft size={18} /></span><strong>{loading ? "—" : String(unread).padStart(2, "0")}</strong><small>{unread ? "Des projets attendent votre réponse" : "Vous êtes à jour"}</small></button></div>
        <div className="admin-overview-grid"><section className="admin-panel"><div className="admin-panel-title"><div><h2>Vos dernières publications</h2><p>Les nouvelles de votre entreprise.</p></div><button className="admin-text-btn" onClick={() => { setStatus("all"); navigate("posts"); }}>Tout voir <ArrowRight size={16} /></button></div>{loading ? <Loading /> : !posts.length ? <EmptyState icon={<FileText size={25} />} title="Votre prochaine histoire commence ici." description="Un chantier livré, une belle rénovation, une nouvelle équipe. Partagez ce qui fait votre entreprise." action={<button className="admin-btn admin-btn-secondary" onClick={() => editPost()}><Plus size={16} /> Créer une publication</button>} /> : <div className="admin-recent-posts">{posts.slice(0, 5).map(post => <button key={post.id} onClick={() => editPost(post)}><PostImage post={post} /><span><small>{post.category}</small><strong>{post.title}</strong><span>{date(post.updatedAt)}</span></span><Status value={post.status} /><ChevronRight size={17} /></button>)}</div>}</section>
        <section className="admin-panel admin-inbox-preview"><div className="admin-panel-title"><div><h2>À votre écoute</h2><p>Les dernières demandes de contact.</p></div><Inbox size={20} /></div>{loading ? <Loading /> : !messages.length ? <EmptyState icon={<Mail size={25} />} title="Une nouvelle rencontre à venir." description="Les messages envoyés depuis le formulaire du site apparaîtront ici." /> : <div className="admin-mini-messages">{messages.slice(0, 4).map(message => <button key={message.id} onClick={() => void openMessage(message)}><span className={`admin-message-avatar ${!message.read ? "admin-message-new" : ""}`}>{message.name.slice(0, 1).toUpperCase()}</span><span><strong>{message.name}</strong><small>{message.service || "Nouveau projet"}</small><span>{message.message}</span></span>{!message.read && <i aria-label="Non lu" />}</button>)}</div>}<button className="admin-panel-footer" onClick={() => navigate("inbox")}>Ouvrir les demandes <ArrowRight size={17} /></button></section></div>
        <div className="admin-tip"><span><ImagePlus size={22} /></span><div><strong>Une image raconte déjà beaucoup.</strong><p>Quelques photos de chantier et un texte simple suffisent pour donner vie à votre prochaine publication.</p></div><button className="admin-icon-btn" aria-label="Créer une publication" onClick={() => editPost()}><ArrowUpRight size={21} /></button></div>
      </>}

      {section === "posts" && <>
        <div className="admin-page-heading"><div><span className="admin-eyebrow">VOTRE SAVOIR-FAIRE EN IMAGES</span><h1>Publications.</h1><p>Partagez vos projets et les actualités de votre entreprise.</p></div><button className="admin-btn admin-btn-primary" onClick={() => editPost()}><Plus size={18} /> Nouvelle publication</button></div>
        <div className="admin-post-controls"><div className="admin-tabs" aria-label="Filtrer les publications">{[{ value: "all", label: "Toutes", count: posts.length }, { value: "published", label: "En ligne", count: published }, { value: "draft", label: "Brouillons", count: drafts }].map(tab => <button key={tab.value} className={status === tab.value ? "active" : ""} onClick={() => setStatus(tab.value)}>{tab.label}<span>{tab.count}</span></button>)}</div><div className="admin-filters"><label className="admin-search"><Search size={17} /><input aria-label="Rechercher une publication" placeholder="Rechercher une publication…" value={query} onChange={event => setQuery(event.target.value)} /></label><select aria-label="Filtrer par catégorie" value={category} onChange={event => setCategory(event.target.value)}><option value="all">Toutes les catégories</option>{categories.map(item => <option key={item}>{item}</option>)}</select><button className="admin-icon-btn" aria-label="Actualiser les publications" disabled={loading} onClick={() => void loadContent()}><RefreshCw size={17} className={loading ? "admin-spin" : ""} /></button></div></div>
        {loading ? <div className="admin-panel"><Loading /></div> : !filteredPosts.length ? <div className="admin-panel"><EmptyState icon={<FileText size={27} />} title={posts.length ? "Aucune publication trouvée." : "Tout commence par une première publication."} description={posts.length ? "Essayez une autre recherche ou changez les filtres." : "Présentez un projet, une réalisation ou une nouvelle de votre entreprise."} action={posts.length ? <button className="admin-btn admin-btn-secondary" onClick={() => { setQuery(""); setStatus("all"); setCategory("all"); }}>Réinitialiser les filtres</button> : <button className="admin-btn admin-btn-primary" onClick={() => editPost()}><Plus size={17} /> Créer une publication</button>} /></div> : <div className="admin-post-grid">{filteredPosts.map(post => <article className="admin-post-card" key={post.id}><button className="admin-post-cover" onClick={() => editPost(post)} aria-label={`Modifier ${post.title}`}><PostImage post={post} /><Status value={post.status} /></button><div className="admin-post-card-body"><span className="admin-eyebrow">{post.category}</span><h2><button onClick={() => editPost(post)}>{post.title}</button></h2><p>{post.excerpt || "Votre introduction apparaîtra ici."}</p><div className="admin-post-meta"><span>{date(post.updatedAt)}</span><span>{post.location && <><MapPin size={12} />{post.location}</>}</span></div></div><div className="admin-post-card-footer"><button onClick={() => editPost(post)}><Pencil size={14} /> Modifier</button><div>{post.status === "published" && <a href={`/journal/${post.slug}`} target="_blank" rel="noreferrer" aria-label={`Voir ${post.title} sur le site`}><ArrowUpRight size={17} /></a>}<button className="admin-delete-btn" aria-label={`Supprimer ${post.title}`} onClick={() => setDeleting(post)}><Trash2 size={16} /></button></div></div></article>)}</div>}
      </>}

      {section === "editor" && <>
        <button className="admin-back" onClick={() => navigate("posts")}><ArrowLeft size={16} /> Toutes les publications</button>
        <div className="admin-page-heading admin-editor-heading"><div><span className="admin-eyebrow">UNE HISTOIRE À PARTAGER</span><h1>{draft.id ? "Peaufiner les détails." : "À vous de raconter."}</h1><p>{dirty ? "Modifications non enregistrées" : draft.id ? `Dernier enregistrement : ${date(draft.updatedAt)}` : "Donnez vie à votre prochain projet."}</p></div><div className="admin-heading-actions"><button className="admin-btn admin-btn-secondary" onClick={() => setPreview(true)}><Eye size={17} /> Aperçu</button><button className="admin-btn admin-btn-primary" disabled={busy || uploading} onClick={() => void savePost("published")}>{busy ? <LoaderCircle size={17} className="admin-spin" /> : <ArrowUpRight size={17} />}{draft.status === "published" ? "Mettre à jour" : "Publier"}</button></div></div>
        <fieldset className="admin-editor-grid" disabled={busy}><div className="admin-editor-main"><section className="admin-panel admin-form-panel"><div className="admin-section-number">01 <span>LE RÉCIT</span></div><label className="admin-field">Titre de la publication <span className="admin-required">*</span><input ref={titleInput} maxLength={150} placeholder="Ex. Une nouvelle vie pour une maison genevoise" value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label><label className="admin-field">Introduction<textarea rows={3} maxLength={320} placeholder="En quelques mots, ce qui rend ce projet particulier…" value={draft.excerpt} onChange={event => setDraft({ ...draft, excerpt: event.target.value })} /><span className="admin-field-help"><span>Le résumé affiché sur les cartes du journal.</span><span>{draft.excerpt.length}/320</span></span></label><label className="admin-field">Votre texte<textarea className="admin-content-input" rows={13} maxLength={30000} placeholder={"Racontez le projet, les travaux réalisés, les détails dont vous êtes fier…\n\nSéparez vos paragraphes par une ligne vide."} value={draft.content} onChange={event => setDraft({ ...draft, content: event.target.value })} /><span className="admin-field-help">Un texte simple, concret et à votre image.</span></label></section>
          <section className="admin-panel admin-form-panel"><div className="admin-section-number">02 <span>LA GALERIE</span><small>{draft.gallery.length}/12</small></div><p className="admin-section-description">Montrez les détails, les étapes et le résultat de votre travail.</p><div className="admin-gallery-grid">{draft.gallery.map((photo, index) => <div className="admin-gallery-item" key={`${photo.url}-${index}`}><div><img src={photo.url} alt={photo.alt || `Photo ${index + 1}`} /><button type="button" className="admin-image-remove" aria-label={`Retirer la photo ${index + 1}`} disabled={uploading || busy} onClick={() => void persistDraft({ ...draft, gallery: draft.gallery.filter((_, i) => i !== index) }, "La photo a été retirée.")}><X size={15} /></button></div><input aria-label={`Description de la photo ${index + 1}`} placeholder="Décrivez cette photo…" maxLength={220} value={photo.alt} onChange={event => setDraft({ ...draft, gallery: draft.gallery.map((item, i) => i === index ? { ...item, alt: event.target.value } : item) })} /></div>)}{draft.gallery.length < 12 && <label className={`admin-upload admin-gallery-upload ${uploading ? "admin-upload-busy" : ""}`}><ImagePlus size={25} strokeWidth={1.5} /><strong>Ajouter des photos</strong><span>JPG, PNG, WebP · {MAX_UPLOAD_MB} Mo max.</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} aria-label="Ajouter des photos à la galerie" onChange={event => { void uploadFiles(event.target.files, true); event.currentTarget.value = ""; }} /></label>}</div></section>
        </div><aside className="admin-editor-side"><section className="admin-panel admin-form-panel"><div className="admin-panel-inline-title"><h2>Publication</h2><Status value={draft.status} /></div><label className="admin-field">Catégorie<select value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value as Category })}>{categories.map(item => <option key={item}>{item}</option>)}</select></label><label className="admin-field">Lieu du projet <span className="admin-optional">facultatif</span><input maxLength={100} placeholder="Ex. Genève, Carouge…" value={draft.location} onChange={event => setDraft({ ...draft, location: event.target.value })} /></label><label className="admin-field">Adresse de la publication<input maxLength={150} placeholder={slugify(draft.title) || "mon-nouveau-projet"} value={draft.slug} onChange={event => setDraft({ ...draft, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} /><span className="admin-field-help admin-url-preview">/journal/{draft.slug || slugify(draft.title) || "mon-nouveau-projet"}</span></label><div className="admin-publish-note"><ShieldCheck size={17} /><p>{draft.status === "published" ? "Cette publication est visible sur votre site. Enregistrez les modifications pour la mettre à jour." : "Votre brouillon reste privé jusqu’à sa publication."}</p></div><button className="admin-btn admin-btn-secondary admin-full-width" disabled={busy || uploading} onClick={() => void savePost("draft")}>{busy ? <LoaderCircle size={16} className="admin-spin" /> : <Save size={16} />}{draft.status === "published" ? "Retirer du site et enregistrer" : "Enregistrer le brouillon"}</button></section>
          <section className="admin-panel admin-form-panel"><h2>Image de couverture</h2><p className="admin-section-description">La première impression de votre projet.</p>{draft.image ? <div className="admin-cover-preview"><img src={draft.image} alt={draft.imageAlt || "Couverture de la publication"} /><button type="button" className="admin-image-remove" aria-label="Retirer l’image de couverture" disabled={uploading || busy} onClick={() => void persistDraft({ ...draft, image: "", imageAlt: "" }, "L’image de couverture a été retirée.")}><X size={15} /></button></div> : null}<label className={`admin-upload ${draft.image ? "admin-upload-replace" : ""} ${uploading ? "admin-upload-busy" : ""}`}>{uploading ? <LoaderCircle size={26} className="admin-spin" /> : <Upload size={26} strokeWidth={1.4} />}<strong>{uploading ? "Transfert en cours…" : draft.image ? "Changer l’image" : "Choisir une image"}</strong>{!draft.image && <span>JPG, PNG, WebP · {MAX_UPLOAD_MB} Mo max.</span>}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} aria-label="Choisir l’image de couverture" onChange={event => { void uploadFiles(event.target.files); event.currentTarget.value = ""; }} /></label>{draft.image && <label className="admin-field admin-image-alt">Description de l’image<textarea rows={2} maxLength={220} placeholder="Ex. Façade rénovée d’une maison à Genève" value={draft.imageAlt} onChange={event => setDraft({ ...draft, imageAlt: event.target.value })} /><span className="admin-field-help">Pour les personnes qui utilisent un lecteur d’écran.</span></label>}</section>
          <div className="admin-editor-help"><CircleHelp size={19} /><p>Un titre précis, des photos lumineuses et quelques mots sincères. C’est tout ce qu’il faut.</p></div>
        </aside></fieldset>
      </>}

      {section === "inbox" && <>
        <div className="admin-page-heading"><div><span className="admin-eyebrow">DE BELLES RENCONTRES EN PERSPECTIVE</span><h1>Vos demandes.</h1><p>Chaque message est peut-être le début d’un beau projet.</p></div><button className="admin-btn admin-btn-secondary" disabled={loading} onClick={() => void loadContent()}><RefreshCw size={16} className={loading ? "admin-spin" : ""} /> Actualiser</button></div>
        <div className="admin-tabs admin-inbox-tabs"><button className={!unreadOnly ? "active" : ""} onClick={() => setUnreadOnly(false)}>Toutes les demandes <span>{messages.length}</span></button><button className={unreadOnly ? "active" : ""} onClick={() => setUnreadOnly(true)}>Non lues <span>{unread}</span></button></div>
        <section className="admin-panel">{loading ? <Loading /> : !messages.filter(message => !unreadOnly || !message.read).length ? <EmptyState icon={<Inbox size={28} />} title={unreadOnly ? "Tout est à jour." : "La porte est ouverte."} description={unreadOnly ? "Vous avez consulté toutes vos demandes." : "Les messages envoyés depuis votre site seront réunis ici. Vous pourrez y répondre directement par e-mail."} /> : <div className="admin-message-list">{messages.filter(message => !unreadOnly || !message.read).map(message => <button className={!message.read ? "admin-message-unread" : ""} key={message.id} onClick={() => void openMessage(message)}><span className={`admin-message-avatar ${!message.read ? "admin-message-new" : ""}`}>{message.name.slice(0, 1).toUpperCase()}</span><span className="admin-message-name"><strong>{message.name}</strong><span>{message.email}</span></span><span className="admin-message-excerpt"><strong>{message.service || "Une nouvelle demande"}</strong><span>{message.message}</span></span><span className="admin-message-date">{date(message.createdAt)}{!message.read && <small>Non lu</small>}</span><ChevronRight size={17} /></button>)}</div>}</section>
      </>}
      <footer className="admin-footer"><span>Quick Building Sàrl</span><span>Bâtir des liens. Donner vie aux projets.</span></footer>
    </main></div>

    {deleting && <Modal label="Supprimer la publication" onClose={closeDelete}><span className="admin-dialog-icon"><Trash2 size={24} /></span><h2>Supprimer cette publication ?</h2><p>« {deleting.title} » sera définitivement supprimée du journal et de l’administration. Cette action ne peut pas être annulée.</p><div className="admin-dialog-actions"><button className="admin-btn admin-btn-secondary" disabled={busy} onClick={closeDelete}>Conserver</button><button className="admin-btn admin-btn-danger" disabled={busy} onClick={() => void deletePost()}>{busy ? <LoaderCircle className="admin-spin" size={16} /> : <Trash2 size={16} />} Supprimer</button></div></Modal>}
    {preview && <Modal label="Aperçu de la publication" onClose={closePreview} wide><div className="admin-preview-top"><span><Eye size={16} /> Aperçu de votre publication</span><button className="admin-icon-btn" aria-label="Fermer l’aperçu" onClick={closePreview}><X size={21} /></button></div><article className="admin-article-preview"><span className="admin-eyebrow">{draft.category}{draft.location && ` · ${draft.location}`}</span><h1>{draft.title || "Le titre de votre projet"}</h1><p className="admin-article-intro">{draft.excerpt || "L’introduction de votre publication apparaîtra ici."}</p>{draft.image && <img className="admin-article-cover" src={draft.image} alt={draft.imageAlt} />}<div className="admin-article-text">{draft.content.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>{draft.gallery.length > 0 && <div className="admin-preview-gallery">{draft.gallery.map((photo, index) => <figure key={index}><img src={photo.url} alt={photo.alt} />{photo.alt && <figcaption>{photo.alt}</figcaption>}</figure>)}</div>}</article><div className="admin-preview-bottom">Aperçu du contenu. La mise en page finale s’adapte à votre site.</div></Modal>}
    {selectedMessage && <Modal label={`Demande de ${selectedMessage.name}`} onClose={closeMessage}><div className="admin-message-modal-top"><span className="admin-message-avatar admin-message-new">{selectedMessage.name.slice(0, 1).toUpperCase()}</span><button className="admin-icon-btn" aria-label="Fermer la demande" onClick={closeMessage}><X size={21} /></button></div><span className="admin-eyebrow">UNE NOUVELLE CONVERSATION</span><h2>{selectedMessage.name}</h2><span className="admin-message-sent">Reçu le {date(selectedMessage.createdAt)}</span><div className="admin-message-details"><a href={`mailto:${selectedMessage.email}`}><Mail size={16} />{selectedMessage.email}</a>{selectedMessage.phone && <a href={`tel:${selectedMessage.phone.replace(/[^+0-9]/g, "")}`}>{selectedMessage.phone}</a>}{selectedMessage.location && <span><MapPin size={16} />{selectedMessage.location}</span>}{selectedMessage.service && <span className="admin-service-tag">{selectedMessage.service}</span>}</div><div className="admin-message-full">{selectedMessage.message}</div><a className="admin-btn admin-btn-primary admin-full-width" href={`mailto:${selectedMessage.email}?subject=${encodeURIComponent(`Votre projet ${selectedMessage.service ? `de ${selectedMessage.service.toLowerCase()} ` : ""}— Quickbuilding`)}`}><Mail size={17} /> Répondre par e-mail <ArrowUpRight size={16} /></a><p className="admin-reply-help">Ouvre votre application de messagerie.</p>{deleteMessageConfirm ? <div className="admin-message-delete-confirm"><p>Supprimer définitivement cette demande ?</p><div><button className="admin-btn admin-btn-secondary" disabled={busy} onClick={() => setDeleteMessageConfirm(false)}>Conserver</button><button className="admin-btn admin-btn-danger" disabled={busy} onClick={() => void deleteMessage()}>{busy ? <LoaderCircle size={15} className="admin-spin" /> : <Trash2 size={15} />} Supprimer</button></div></div> : <button className="admin-message-delete-link" onClick={() => setDeleteMessageConfirm(true)}><Trash2 size={13} /> Supprimer cette demande</button>}</Modal>}
  </div>;
}

function Status({ value }: { value: Post["status"] }) { return <span className={`admin-status admin-status-${value}`}><span />{value === "published" ? "En ligne" : "Brouillon"}</span>; }
function PostImage({ post }: { post: Post }) { return post.image ? <img src={post.image} alt={post.imageAlt || post.title} loading="lazy" /> : <span className="admin-image-placeholder"><ImagePlus size={26} strokeWidth={1.2} /></span>; }
function Loading() { return <div className="admin-loading-state" role="status"><LoaderCircle className="admin-spin" size={24} /><p>Chargement de votre espace…</p></div>; }
function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) { return <div className="admin-empty"><span>{icon}</span><h3>{title}</h3><p>{description}</p>{action}</div>; }





