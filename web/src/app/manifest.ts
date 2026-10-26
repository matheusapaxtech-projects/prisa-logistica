import type { MetadataRoute } from "next";

// Dados do NILT quando instalado como app (atalho na tela inicial do celular ou no computador).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NILT",
    short_name: "NILT",
    description: "Núcleo Integrado de Logística e Transporte",
    start_url: "/",
    display: "standalone",
    background_color: "#e8e6de",
    theme_color: "#0b6b3a",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icone/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icone/512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
