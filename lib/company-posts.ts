import type { Post } from "@/lib/content";

const facebook = "https://www.facebook.com/people/Quick-Building-SARL/100063754682165/";

export const companyPosts: Post[] = [
  {
    id: "facebook-2023-08-16",
    title: "Un couloir en pleine transformation",
    slug: "couloir-en-transformation",
    excerpt: "Plaques, câblages et faux plafond : un moment de chantier publié sur notre page Facebook le 16 août 2023.",
    content: "Cette publication montre un couloir d’immeuble en cours d’aménagement. Les plaques de plâtre sont posées le long des murs, les chemins de câbles restent apparents et le faux plafond commence à prendre sa place.\n\nC’est le quotidien d’un chantier d’intérieur : coordonner les corps d’état, garder le passage praticable et avancer pièce après pièce.\n\nLa vidéo d’origine est sur notre page Facebook.",
    category: "Rénovation",
    status: "published",
    image: "/images/real/corridor.jpg",
    imageAlt: "Couloir de chantier avec plaques de plâtre, câbles apparents et faux plafond en cours",
    gallery: [],
    location: "Genève",
    createdAt: "2023-08-16T10:00:00.000Z",
    updatedAt: "2023-08-16T10:00:00.000Z",
  },
  {
    id: "facebook-2022-05-07",
    title: "Brique, volume et lumière",
    slug: "brique-volume-et-lumiere",
    excerpt: "Mur de brique, plafond technique et grand espace lumineux : des photos de chantier partagées le 7 mai 2022.",
    content: "Ces images viennent de notre page Facebook, publiées le 7 mai 2022. On y voit un mur de brique rouge, un volume déjà ouvert, un plafond technique et un sol encore protégé.\n\nPlus loin, le parquet clair rejoint le béton du chantier. Dans la grande pièce, la lumière entre par les fenêtres pendant que les finitions se préparent.\n\nUn mur blanc porte aussi un dessin au trait, posé dans l’espace comme une signature graphique.\n\nRetrouvez l’ensemble des photos sur notre page Facebook.",
    category: "Maçonnerie",
    status: "published",
    image: "/images/real/photo-2.jpg",
    imageAlt: "Mur de brique rouge dans un intérieur en travaux",
    gallery: [
      { url: "/images/real/photo-3.jpg", alt: "Pièce avec mur de brique, plafond technique et sol protégé" },
      { url: "/images/real/photo-4.jpg", alt: "Deux pans de brique dans un volume encore ouvert" },
      { url: "/images/real/photo-1.jpg", alt: "Mur blanc orné d’un dessin au trait dans un espace lumineux" },
      { url: "/images/real/photo-5.jpg", alt: "Couloir avec parquet clair et cloisons blanches" },
      { url: "/images/real/photo-6.jpg", alt: "Raccord entre le parquet posé et le sol de chantier" },
      { url: "/images/real/photo-7.jpg", alt: "Grande pièce lumineuse pendant les travaux" },
    ],
    location: "Genève",
    createdAt: "2022-05-07T10:00:00.000Z",
    updatedAt: "2022-05-07T10:00:00.000Z",
  },
];

export const facebookPageUrl = facebook;
