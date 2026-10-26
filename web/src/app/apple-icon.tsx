import { iconeQuadrado } from "@/lib/marca-imagem";

// Ícone do atalho na tela inicial do iPhone (o iOS arredonda os cantos sozinho).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return iconeQuadrado(180);
}
