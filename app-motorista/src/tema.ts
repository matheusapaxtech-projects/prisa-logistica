/* Tokens do app, tirados do DESIGN.md do NILT (protótipo aprovado em docs/design/app-motorista-prototipo.html):
   fundo quente com gradiente, vidro creme, a pílula preta (noite) como ação principal e cor que vale situação. */
import type { TextStyle } from "react-native";

export const cor = {
  fundo: "#e8e6de",
  pessego: "#eddbce",
  creme: "#ece4cd",
  salvia: "#e3e8de",
  vidro: "rgba(250,246,238,0.74)",
  vidroBorda: "rgba(255,255,255,0.8)",
  folha: "#fbf8f2",
  circulo: "#f5f3eb",
  borda: "#e4ddd0",
  filete: "#ebe5da",
  meioFio: "#cdc5b6",
  tinta: "#161818",
  apagado: "#55574f",
  fraco: "#66675f",
  noite: "#161818",
  noiteTexto: "#c9c9c1",
  verde: "#2c5a4d",
  verdeClaro: "#e1ebe4",
  verdeTinta: "#1f4237",
  laranja: "#e38b3d",
  laranjaClaro: "#f8e7d4",
  laranjaTinta: "#7a3c0b",
  mostardaClaro: "#f7edc8",
  mostardaTinta: "#574300",
  mostardaBorda: "#b8901a",
  ferrugem: "#b9381a",
  ferrugemClaro: "#f6e1d9",
  ferrugemTinta: "#8a2a12",
  azul: "#2f5f8a",
  azulClaro: "#e2eaf1",
  azulTinta: "#1d3f5e",
  placaAzul: "#1a4fa0",
};

/** Gradiente do fundo do NILT (pêssego no alto à esquerda, creme no alto, sálvia embaixo à direita). */
export const FUNDO_GRADIENTE =
  `radial-gradient(120% 60% at 0% 0%, ${cor.pessego} 0%, transparent 60%), ` +
  `radial-gradient(90% 50% at 70% 0%, ${cor.creme} 0%, transparent 60%), ` +
  `radial-gradient(110% 60% at 100% 100%, ${cor.salvia} 0%, transparent 65%)`;

export const sombra = {
  painel: "0 18px 40px -26px rgba(60,40,20,0.28)",
  cartao: "0 10px 24px -14px rgba(22,24,24,0.45)",
  flutuante: "0 28px 60px -18px rgba(22,24,24,0.45)",
};

/** Outfit por peso (o React Native não sintetiza peso em fonte carregada). */
export function fonte(peso: 400 | 500 | 600 | 700 = 400): TextStyle {
  return { fontFamily: { 400: "Outfit_400Regular", 500: "Outfit_500Medium", 600: "Outfit_600SemiBold", 700: "Outfit_700Bold" }[peso] };
}
/** Overpass Mono: só placa e identificadores. */
export const mono: TextStyle = { fontFamily: "OverpassMono_600SemiBold" };
export const numeros: TextStyle = { fontVariant: ["tabular-nums"] };

export const reais = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const DIAS = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];
const dd = (n: number) => String(n).padStart(2, "0");

/** Data em Brasília (UTC−3; o Brasil não tem horário de verão desde 2019). Sem Intl: o Hermes do Android não
    garante fuso horário em toLocaleString. */
function brasilia(d: Date) {
  const b = new Date(d.getTime() - 3 * 36e5);
  return { ano: b.getUTCFullYear(), mes: b.getUTCMonth() + 1, dia: b.getUTCDate(), hora: b.getUTCHours(), semana: b.getUTCDay() };
}
/** Dias corridos entre duas datas no calendário de Brasília. */
function difDias(a: { ano: number; mes: number; dia: number }, b: { ano: number; mes: number; dia: number }) {
  return Math.round((Date.UTC(b.ano, b.mes - 1, b.dia) - Date.UTC(a.ano, a.mes - 1, a.dia)) / 864e5);
}

/** Data de um pedido ("2026-10-27") para a frase: "hoje, 27/10", "amanhã, 28/10" ou "29/10". */
export function diaDoPedido(iso: string | null): string {
  if (!iso) return "a combinar";
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  const dif = difDias(brasilia(new Date()), { ano, mes, dia });
  const dm = `${dd(dia)}/${dd(mes)}`;
  return dif === 0 ? `hoje, ${dm}` : dif === 1 ? `amanhã, ${dm}` : dm;
}

/** Fim de um prazo: "hoje, 21 h", "amanhã, 9 h" ou "qui., 28/10, 21 h". */
export function fimDoPrazo(d: Date): string {
  const b = brasilia(d);
  const dif = difDias(brasilia(new Date()), b);
  const hora = `${b.hora} h`;
  if (dif === 0) return `hoje, ${hora}`;
  if (dif === 1) return `amanhã, ${hora}`;
  return `${DIAS[b.semana]}, ${dd(b.dia)}/${dd(b.mes)}, ${hora}`;
}

/** Quanto falta até uma data, grande: "2 dias", "18 h", "40 min". */
export function faltaAte(iso: string): string {
  const min = Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 6e4));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 36) return `${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "1 dia" : `${d} dias`;
}

/** "há 12 min", "há 3 h". */
export function haQuanto(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 6e4));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `há ${h} h` : `há ${Math.round(h / 24)} dias`;
}

export function saudacao(): string {
  const h = brasilia(new Date()).hora;
  return h < 5 ? "Boa noite" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export const CARROCERIA: Record<string, string> = {
  graneleiro: "graneleiro",
  basculante: "basculante",
  cacamba: "caçamba",
  bau: "baú",
  sider: "sider",
  grade_baixa: "grade baixa",
  prancha: "prancha",
  tanque: "tanque",
  frigorifico: "frigorífico",
  porta_container: "porta-contêiner",
  boiadeiro: "boiadeiro",
  cegonha: "cegonha",
  outro: "outra carroceria",
};
