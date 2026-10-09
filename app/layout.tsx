import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://quickbuilding-geneve.zesty-elf-2974.chatgpt.site"),
  title: { default: "Quickbuilding — Bâtir la suite, ensemble.", template: "%s · Quickbuilding" },
  description: "Entreprise générale de bâtiment et de maçonnerie à Carouge, Genève. Construction, rénovation, transformation et accompagnement de votre projet.",
  openGraph: { title: "Quickbuilding — Bâtir la suite, ensemble.", description: "Votre projet, notre engagement. Entreprise générale à Carouge, Genève.", locale: "fr_CH", type: "website", images: [{url: "/images/hero.jpg", width: 1800, height: 1200}] },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr-CH">
      <body>{children}</body>
    </html>
  );
}
