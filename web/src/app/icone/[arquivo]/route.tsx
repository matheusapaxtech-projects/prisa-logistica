import { iconeQuadrado } from "@/lib/marca-imagem";

// Ícones do app instalado no Android/Chrome, citados em app/manifest.ts: /icone/192.png e /icone/512.png.
// O ".png" no endereço deixa o pedido fora do proxy de login (src/proxy.ts), como os demais arquivos.
const LADOS: Record<string, number> = { "192.png": 192, "512.png": 512 };

export function generateStaticParams() {
  return Object.keys(LADOS).map((arquivo) => ({ arquivo }));
}

export async function GET(_: Request, { params }: { params: Promise<{ arquivo: string }> }) {
  const lado = LADOS[(await params).arquivo];
  if (!lado) return new Response("Não encontrado", { status: 404 });
  return iconeQuadrado(lado);
}
