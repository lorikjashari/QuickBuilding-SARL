import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Footer, Header } from "@/components/site-chrome";
import "../journal.css";

export default function JournalNotFound() {
  return <div id="top" className="journal-page"><Header /><main id="main" className="journal-not-found section-pad"><span className="eyebrow">404 · CETTE PAGE A CHANGÉ DE CHAPITRE</span><h1>Une histoire<br /><em>à retrouver.</em></h1><p>Cette publication n’existe pas ou n’est plus disponible.<br />D’autres histoires vous attendent dans notre journal.</p><Link className="button button-dark" href="/journal"><ArrowLeft size={17} /> Retour au journal</Link></main><Footer /></div>;
}
