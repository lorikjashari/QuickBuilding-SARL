"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Footer, Header } from "@/components/site-chrome";
import "./journal.css";

export default function JournalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div id="top" className="journal-page"><Header /><main id="main" className="journal-not-found section-pad"><span className="eyebrow">UN COURT INSTANT</span><h1>Le journal<br /><em>fait une pause.</em></h1><p>Cette publication ne peut pas être chargée pour le moment.<br />Réessayez dans un instant ou contactez notre équipe.</p><div className="journal-error-actions"><button className="button button-dark" onClick={reset}>Réessayer <ArrowUpRight size={17} /></button><Link className="journal-back" href="/#contact">Nous contacter <ArrowUpRight size={17} /></Link></div></main><Footer /></div>;
}
