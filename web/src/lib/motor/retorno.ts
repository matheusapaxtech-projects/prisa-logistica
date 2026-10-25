/* Frete de retorno e previsão de chegada (motor de despacho, retorno.ts e a parte de ETA de monitoramento.ts).
   Sem o app do motorista não há posições de GPS: a previsão sai da hora em que a viagem entrou em "Em rota",
   do km e da regra de descanso (Lei 13.103: 30 min a cada 5h30 ao volante; 11 h de descanso a cada 13 h).
   O retorno cruza a viagem que vai descarregar com os pedidos abertos perto do destino. Puro. */
import { estradaKm } from "@/lib/calculadora/rota";

export type Ponto = { lat: number; lon: number; uf: string };

const H = 36e5;

/** Previsão de chegada ao destino a partir da saída, como em analisarViagem (velocidade de 60 km/h). */
export function previsaoDeChegada(saidaIso: string, km: number, velocidadeKmH = 60): string | null {
  if (!(km > 0)) return null;
  const dirigindo = km / velocidadeKmH;
  const pausas = Math.floor(dirigindo / 5.5) * 0.5;
  const pernoites = Math.floor(dirigindo / 13) * 11;
  return new Date(Date.parse(saidaIso) + (dirigindo + pausas + pernoites) * H).toISOString();
}

/** Atraso previsto em horas contra a entrega combinada (fim do dia da entrega prevista, 18 h de Brasília). */
export function atrasoPrevisto(previsaoIso: string, entregaPrevista: string | null): number | null {
  if (!entregaPrevista) return null;
  const limite = Date.parse(`${entregaPrevista}T21:00:00Z`);
  return Math.round(((Date.parse(previsaoIso) - limite) / H) * 10) / 10;
}

export type ViagemTerminando = { destino: Ponto; origemIda: Ponto; previsaoChegada: string; capacidadeT: number };

export type CargaAberta = { id: string; origem: Ponto; destino: Ponto; pesoT: number; embarqueEm: string };

export type ParamRetorno = { raioKm: number; horasDescarga: number; esperaMaxH: number; atrasoMaxH: number };

export const RETORNO_PADRAO: ParamRetorno = { raioKm: 150, horasDescarga: 6, esperaMaxH: 48, atrasoMaxH: 4 };

export type SugestaoRetorno = {
  carga: CargaAberta;
  kmVazioAteEmbarque: number;
  kmRetornoAteBase: number;
  kmVoltaVazio: number;
  horasEspera: number;
  pesoAtendidoT: number;
  score: number;
  motivos: string[];
};

/** Cargas a até 150 km do destino, embarcando até 48 h depois de descarregar (ou até 4 h antes), de
   preferência voltando para perto da base. Nota: km vazio 35%, volta para a base 30%, espera 20%, ocupação 15%. */
export function sugerirRetornos(v: ViagemTerminando, cargas: readonly CargaAberta[], p: ParamRetorno = RETORNO_PADRAO): SugestaoRetorno[] {
  const livre = Date.parse(v.previsaoChegada) + p.horasDescarga * H;
  const kmVoltaVazio = estradaKm(v.destino, v.origemIda);
  const out: SugestaoRetorno[] = [];
  for (const c of cargas) {
    const kmVazio = estradaKm(v.destino, c.origem);
    if (kmVazio > p.raioKm) continue;
    const espera = (Date.parse(c.embarqueEm) - livre) / H;
    if (espera > p.esperaMaxH || espera < -p.atrasoMaxH) continue;
    const kmBase = estradaKm(c.destino, v.origemIda);
    const peso = Math.min(c.pesoT, v.capacidadeT);
    const nVazio = 1 - kmVazio / p.raioKm;
    const nBase = Math.max(0, 1 - kmBase / Math.max(300, kmVoltaVazio));
    const nTempo = espera <= 12 ? 1 : Math.max(0, 1 - (espera - 12) / (p.esperaMaxH - 12));
    const nOcup = v.capacidadeT > 0 ? peso / v.capacidadeT : 0;
    const score = Math.round(100 * (0.35 * nVazio + 0.3 * nBase + 0.2 * nTempo + 0.15 * nOcup) * 10) / 10;
    const t = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
    out.push({
      carga: c,
      kmVazioAteEmbarque: kmVazio,
      kmRetornoAteBase: kmBase,
      kmVoltaVazio,
      horasEspera: Math.round(espera * 10) / 10,
      pesoAtendidoT: peso,
      score,
      motivos: [
        `${kmVazio} km vazio até o embarque do retorno`,
        kmBase <= 80 ? "o retorno termina perto da base do motorista" : `o retorno termina a ${kmBase} km da base (a volta vazia seria de ${kmVoltaVazio} km)`,
        espera >= 0 ? `espera de ${Math.round(espera)} h depois de descarregar` : `chega ${Math.round(-espera)} h depois do início da janela`,
        `${t(peso)} t de ${t(v.capacidadeT)} t`,
      ],
    });
  }
  return out.sort((a, b) => b.score - a.score);
}
