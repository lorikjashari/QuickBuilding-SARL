import type { Metadata } from "next";
import { Footer, Header } from "@/components/site-chrome";
import JournalIndex from "@/components/journal/journal-index";
import "./journal.css";

export const metadata: Metadata = {
  title: "Le journal",
  description: "Projets, réalisations et nouvelles de Quick Building Sàrl, entreprise générale de bâtiment et de maçonnerie à Carouge, Genève.",
  alternates: { canonical: "/journal" },
};

export default function JournalPage() {
  return <div id="top" className="journal-page"><Header /><main id="main"><section className="journal-hero section-pad"><span className="eyebrow"><span className="tiny-cross">+</span> LE JOURNAL QUICKBUILDING</span><div><h1>Des projets.<br /><em>Des histoires.</em></h1><p>Les nouvelles de notre entreprise,<br />le fil de nos réalisations.<br />Un regard sur ce que nous construisons.</p></div><span className="journal-hero-line" /></section><JournalIndex /></main><Footer /></div>;
}
