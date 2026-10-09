"use client";

/* eslint-disable @next/next/no-img-element -- Full-resolution gallery images are intentionally served from the media API. */
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Expand, X } from "lucide-react";

export default function JournalGallery({ images, title }: { images: { url: string; alt: string }[]; title: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const image = selected === null ? null : images[selected];
  const previous = () => setSelected(index => index === null ? 0 : (index - 1 + images.length) % images.length);
  const next = () => setSelected(index => index === null ? 0 : (index + 1) % images.length);
  useEffect(() => {
    if (selected === null) { dialog.current?.close(); return; }
    if (!dialog.current?.open) dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, [selected]);
  return <><div className="journal-gallery-grid">{images.map((photo, index) => <figure key={`${photo.url}-${index}`}><button onClick={() => setSelected(index)} aria-label={`Agrandir : ${photo.alt || `photo ${index + 1} du projet`}`}><img src={photo.url} alt={photo.alt || `${title}, photo ${index + 1}`} loading="lazy" /><span><Expand size={19} /></span></button>{photo.alt && <figcaption>{photo.alt}</figcaption>}</figure>)}</div><dialog ref={dialog} className="journal-lightbox" aria-labelledby="journal-lightbox-title" onClose={() => setSelected(null)} onCancel={event => { event.preventDefault(); setSelected(null); }} onClick={event => { if (event.target === event.currentTarget) setSelected(null); }} onKeyDown={event => { if (event.key === "ArrowLeft") { event.preventDefault(); previous(); } if (event.key === "ArrowRight") { event.preventDefault(); next(); } }}><div className="journal-lightbox-inner"><div className="journal-lightbox-top"><span id="journal-lightbox-title">{title}</span><button className="journal-lightbox-close" onClick={() => setSelected(null)} aria-label="Fermer la galerie" autoFocus><X size={22} /></button></div>{image && <img className="journal-lightbox-image" src={image.url} alt={image.alt || title} />}<div className="journal-lightbox-bottom"><p aria-live="polite">{image?.alt || title}</p><div>{images.length > 1 && <button onClick={previous} aria-label="Photo précédente"><ArrowLeft size={20} /></button>}<span>{(selected ?? 0) + 1} / {images.length}</span>{images.length > 1 && <button onClick={next} aria-label="Photo suivante"><ArrowRight size={20} /></button>}</div></div></div></dialog></>;
}
