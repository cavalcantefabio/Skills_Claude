import type { MetadataRoute } from "next";

/** Permite instalar o app na tela inicial (necessário para notificações no iPhone). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Milhas Inteligentes AI",
    short_name: "Milhas AI",
    description: "Pontos, milhas, cartões, viagens e alertas de voos.",
    start_url: "/voos",
    scope: "/",
    display: "standalone",
    background_color: "#0b0c0e",
    theme_color: "#0b0c0e",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
