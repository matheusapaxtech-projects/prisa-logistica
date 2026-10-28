import { previaDeLink } from "@/lib/marca-imagem";

// Prévia que aparece quando alguém manda o link do NILT no WhatsApp ou por e-mail.
export const alt = "NILT, Núcleo Integrado de Logística e Transporte";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function ImagemPrevia() {
  return previaDeLink();
}
