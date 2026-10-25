"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Plus, RotateCcw, X } from "lucide-react";
import { Sinal } from "@/components/Sinal";
import { toast } from "@/components/Toast";
import { formato, lerNumeroBr } from "@/lib/formato";
import {
  ACRESCIMO_SUGERIDO,
  calcularCTe,
  checklistCiot,
  coeficientePara,
  decidir,
  freteEmpresaMinimo,
  freteSugerido,
  horasDeViagem,
  horasTexto,
  MARGEM_DUPLICATA,
  MARGEM_MINIMA,
  margemComDuplicata,
  pisoAntt,
  situacaoContratado,
  type Coeficiente,
  type Decisao,
  type EntradaCTe,
  type ItemCiot,
  type ParamFiscais,
  type TipoCarga,
} from "@/lib/calculadora/regras";
import { acharMunicipio, estimarRota, lerMunicipios, pedagioEstimado, type Municipio, type Municipios } from "@/lib/calculadora/rota";
import { porcento, sinalDaFaixa } from "@/lib/frete";
import { dinheiro } from "../financeiro/regras";
import type { DaViagem } from "./consultas";

/* Tela da calculadora: entradas à esquerda; à direita, fixa, a decisão de contratação com os limites em
   reais, o piso, o checklist do CIOT e (admin e financeiro) o resultado do CT-e e as alíquotas. Tudo
   recalcula a cada tecla com lib/calculadora/regras.ts. */

type Props = {
  tabela: Coeficiente[];
  fiscal: ParamFiscais;
  vigenciaFiscal: string | null;
  tiposCarga: Record<TipoCarga, string>;
  /** Admin e financeiro: margem, resultado do CT-e, duplicata e alíquotas. */
  verTudo: boolean;
  viagem: DaViagem | null;
};

type Modo = "por_tonelada" | "total";

type Estado = {
  origem: string;
  destino: string;
  vias: string[];
  /** Km digitado; nulo = usar a estimativa da rota. */
  km: string | null;
  /** Pedágio digitado (Qualp); nulo = estimado. */
  pedagio: string | null;
  tipo: TipoCarga;
  eixos: number;
  retornoVazio: boolean;
  peso: string;
  capacidade: string;
  valorMercadoria: string;
  modo: Modo;
  freteCliente: string;
  freteMotorista: string;
  pf: boolean;
  prazo: string;
  adiantamento: string;
  rntrc: boolean;
  diesel: string;
  consumo: string;
  duplicata: boolean;
};

const EIXOS = [2, 3, 4, 5, 6, 7, 8, 9];
const ORIGEM_PADRAO = "Mandaguari/PR";
const PEDAGIO_PADRAO = 0.08; // R$ por eixo/km sem histórico

const campo = (n: number | null | undefined, casas = 2) => formato.numeroCampo(n, casas);
/** Texto pt-BR → número; vazio ou inválido = 0 (o campo mostra o erro). */
const num = (s: string | null | undefined) => {
  const v = lerNumeroBr(s);
  return v === null || Number.isNaN(v) ? 0 : v;
};
const invalido = (s: string | null | undefined) => Number.isNaN(lerNumeroBr(s) ?? 0);

function inicial(v: DaViagem | null): Estado {
  const base: Estado = {
    origem: ORIGEM_PADRAO,
    destino: "",
    vias: [],
    km: null,
    pedagio: null,
    tipo: "granel_solido",
    eixos: 7,
    retornoVazio: false,
    peso: "",
    capacidade: "",
    valorMercadoria: "",
    modo: "por_tonelada",
    freteCliente: "",
    freteMotorista: "",
    pf: false,
    prazo: "3",
    adiantamento: "70",
    rntrc: false,
    diesel: "6,30",
    consumo: "3",
    duplicata: false,
  };
  if (!v) return base;
  return {
    ...base,
    origem: v.origem,
    destino: v.destino,
    km: v.km !== null ? String(v.km) : null,
    pedagio: v.pedagio !== null ? campo(v.pedagio) : null,
    tipo: v.tipo,
    eixos: v.eixos,
    peso: campo(v.pesoT, 3),
    capacidade: campo(v.pesoT, 3),
    modo: v.freteEmpresaPorT !== null ? "por_tonelada" : "total",
    freteCliente: campo(v.freteEmpresaPorT ?? v.freteEmpresaTotal),
    freteMotorista: v.freteMotorista !== null ? campo(v.freteMotorista) : "",
    pf: v.contratadoPf,
  };
}

/* Alíquotas editáveis (admin e financeiro), em % na tela; não salvam. */
type CampoFiscal = { chave: keyof ParamFiscais; rotulo: string; pct: boolean; casas: number };
const CAMPOS_FISCAIS: CampoFiscal[] = [
  { chave: "pisCofins", rotulo: "PIS e COFINS cumulativos (%)", pct: true, casas: 2 },
  { chave: "irpjCsll", rotulo: "IRPJ e CSLL presumidos (%)", pct: true, casas: 2 },
  { chave: "panCardPct", rotulo: "Taxa Pan Card (%)", pct: true, casas: 2 },
  { chave: "panCardTransferencia", rotulo: "Pan Card por transferência (R$)", pct: false, casas: 2 },
  { chave: "panCardTransferencias", rotulo: "Transferências por viagem", pct: false, casas: 0 },
  { chave: "descontoDuplicata", rotulo: "Desconto de duplicata (%)", pct: true, casas: 2 },
  { chave: "seguroRctrc", rotulo: "Seguro RCTR-C (% da mercadoria)", pct: true, casas: 3 },
  { chave: "seguroRcdc", rotulo: "Seguro RC-DC (% da mercadoria)", pct: true, casas: 3 },
];
const textoFiscal = (p: ParamFiscais) =>
  Object.fromEntries(CAMPOS_FISCAIS.map((c) => [c.chave, campo(c.pct ? p[c.chave] * 100 : p[c.chave], c.casas)])) as Record<keyof ParamFiscais, string>;

export function CalculadoraCliente({ tabela, fiscal, vigenciaFiscal, tiposCarga, verTudo, viagem }: Props) {
  const [e, setE] = useState<Estado>(() => inicial(viagem));
  const [fiscalTxt, setFiscalTxt] = useState(() => textoFiscal(fiscal));
  const [mun, setMun] = useState<Municipios | null>(null);
  const muda = <K extends keyof Estado>(k: K, v: Estado[K]) => setE((s) => ({ ...s, [k]: v }));

  // 5.570 municípios: carregados depois que a tela abre, num pedaço separado do pacote.
  useEffect(() => {
    let vivo = true;
    import("@/lib/calculadora/municipios-dados").then((m) => vivo && setMun(lerMunicipios(m.MUNICIPIOS_RAW)));
    return () => {
      vivo = false;
    };
  }, []);

  const p: ParamFiscais = useMemo(
    () =>
      Object.fromEntries(CAMPOS_FISCAIS.map((c) => [c.chave, c.pct ? num(fiscalTxt[c.chave]) / 100 : num(fiscalTxt[c.chave])])) as ParamFiscais,
    [fiscalTxt],
  );

  /* ---------- rota ---------- */
  const buscas = useMemo(() => {
    if (!mun) return null;
    return { origem: acharMunicipio(mun, e.origem), destino: acharMunicipio(mun, e.destino), vias: e.vias.map((v) => acharMunicipio(mun, v)) };
  }, [mun, e.origem, e.destino, e.vias]);
  const pontos: Municipio[] | null = useMemo(() => {
    if (!buscas?.origem.municipio || !buscas.destino.municipio) return null;
    const vias = buscas.vias.filter((b, i) => e.vias[i].trim() !== "");
    if (vias.some((b) => !b.municipio)) return null;
    return [buscas.origem.municipio, ...vias.map((b) => b.municipio!), buscas.destino.municipio];
  }, [buscas, e.vias]);
  const est = useMemo(() => (pontos ? estimarRota(pontos) : null), [pontos]);
  const km = e.km !== null ? num(e.km) : (est?.km ?? 0);
  const pedEixoKm = est?.pedagioEixoKm ?? PEDAGIO_PADRAO;
  const pedagioAuto = pedagioEstimado(km, e.eixos, pedEixoKm);
  const pedagio = e.pedagio !== null ? num(e.pedagio) : pedagioAuto;
  const ufOrigem = buscas?.origem.municipio?.uf ?? e.origem.slice(-2).toUpperCase();
  const ufDestino = buscas?.destino.municipio?.uf ?? e.destino.slice(-2).toUpperCase();

  /* ---------- cargas e fretes ---------- */
  const peso = num(e.peso);
  const capacidade = num(e.capacidade);
  const freteCliente = e.modo === "por_tonelada" ? num(e.freteCliente) * peso : num(e.freteCliente);
  const freteMotorista = num(e.freteMotorista);
  const coef = coeficientePara(tabela, e.tipo, e.eixos);
  const piso = pisoAntt(coef, km, e.retornoVazio);
  const sugerido = freteSugerido(piso, pedagio);
  const sitContratado = situacaoContratado(freteCliente, piso, sugerido);

  const cte: EntradaCTe = {
    freteEmpresa: freteCliente,
    freteMotorista,
    pedagio,
    origemUF: ufOrigem,
    destinoUF: ufDestino,
    motoristaPF: e.pf,
    descontarDuplicata: verTudo && e.duplicata,
    valorMercadoria: num(e.valorMercadoria),
  };
  const ciot = checklistCiot({
    km,
    piso,
    freteMotorista,
    pedagio,
    prazoSaldoDias: Math.round(num(e.prazo)),
    rntrcConferido: e.rntrc,
    motoristaPF: e.pf,
  });
  const decisao = decidir({ cte, piso, ciot, param: p });
  const resultado = calcularCTe(cte, p);
  const margemDup = margemComDuplicata(cte, p);
  // Frete contratado que fecha a margem mínima com o motorista pelo menos no piso ("Usar o da margem mínima").
  const contratadoMinimo = piso > 0 ? freteEmpresaMinimo({ ...cte, freteMotorista: Math.max(freteMotorista, piso) }, p) : null;

  /* ---------- ações ---------- */
  /** Põe um frete contratado total no campo, no modo da tela (por tonelada divide pelo peso). */
  function usarContratado(total: number) {
    const v = Math.round(total * 100) / 100;
    if (e.modo === "por_tonelada") {
      if (!(peso > 0)) return toast("Informe o peso da carga para usar o frete por tonelada.", "info");
      muda("freteCliente", campo(Math.ceil((v / peso) * 100) / 100));
    } else muda("freteCliente", campo(v));
  }

  function trocarModo(m: Modo) {
    if (m === e.modo) return;
    const v = num(e.freteCliente);
    const novo = peso > 0 && v > 0 ? (m === "total" ? v * peso : v / peso) : v;
    setE((s) => ({ ...s, modo: m, freteCliente: novo ? campo(novo) : s.freteCliente }));
  }

  function limpar() {
    setE(inicial(null));
    setFiscalTxt(textoFiscal(fiscal));
  }

  async function copiar() {
    const linhas = [
      `PRISA · cotação de frete (${new Date().toLocaleDateString("pt-BR")})`,
      `Rota: ${[e.origem, ...e.vias.filter((v) => v.trim()), e.destino].join(" → ")} · ${km.toLocaleString("pt-BR")} km`,
      `${tiposCarga[e.tipo]} · ${e.eixos} eixos${peso ? ` · ${campo(peso, 3)} t` : ""}`,
      `Frete contratado: ${formato.reais(freteCliente)} · motorista: ${formato.reais(freteMotorista)} · pedágio: ${formato.reais(pedagio)}`,
      `Piso ANTT do motorista: ${piso ? formato.reais(piso) : "—"}`,
      `Decisão: ${decisao.titulo}`,
      ...decisao.limites.map((l) => `${l.rotulo}: ${l.valor !== null ? formato.reais(l.valor) : "—"}`),
      ...(verTudo && freteCliente && freteMotorista ? [`Margem líquida: ${porcento(resultado.margemLiquida)} (${resultado.faixa})`] : []),
    ];
    try {
      await navigator.clipboard.writeText(linhas.join("\n"));
      toast("Resumo copiado.");
    } catch {
      toast("Não deu para copiar. Tente de novo.", "alert-circle");
    }
  }

  const datalist = useMemo(
    () =>
      mun ? (
        <datalist id="municipios">
          {mun.lista.map((m) => (
            <option key={m.nome} value={m.nome} />
          ))}
        </datalist>
      ) : null,
    [mun],
  );

  return (
    <>
      <div className="titulo">
        <div>
          <h1>Calcular frete</h1>
          <p className="sub">
            {viagem ? (
              <>
                Preenchido com a <Link href={`/viagens/${viagem.id}`}>viagem #{viagem.numero}</Link>. Mude os valores para simular.
              </>
            ) : (
              "Veja se dá para contratar este frete antes de fechar com o cliente e com o motorista."
            )}
          </p>
        </div>
        <div className="acoes">
          <button type="button" className="btn" onClick={limpar}>
            Limpar
          </button>
          <button type="button" className="btn btn-primario" onClick={copiar}>
            Copiar resumo
          </button>
        </div>
      </div>
      {datalist}

      <div className="calc-grade">
        <div className="calc-entradas">
          <section className="painel" aria-labelledby="calc-rota">
            <CabSecao id="calc-rota" titulo="Rota">
              O km sai da rota já medida pela Prisa ou da distância entre as cidades. Se você mediu no Qualp, digite por cima.
            </CabSecao>
            <div className="campos">
              <CampoCidade
                id="origem"
                rotulo="Carga em"
                valor={e.origem}
                aoMudar={(v) => muda("origem", v)}
                busca={buscas?.origem}
                carregando={!mun}
              />
              <CampoCidade
                id="destino"
                rotulo="Descarga em"
                valor={e.destino}
                aoMudar={(v) => muda("destino", v)}
                busca={buscas?.destino}
                carregando={!mun}
              />
              {e.vias.map((v, i) => (
                <CampoCidade
                  key={i}
                  id={`via-${i}`}
                  rotulo={`Passando por (${i + 1})`}
                  valor={v}
                  aoMudar={(nv) => setE((s) => ({ ...s, vias: s.vias.map((x, j) => (j === i ? nv : x)) }))}
                  busca={buscas?.vias[i]}
                  carregando={!mun}
                  remover={() => setE((s) => ({ ...s, vias: s.vias.filter((_, j) => j !== i) }))}
                />
              ))}
              <div className="f12">
                <button type="button" className="btn btn-texto" onClick={() => setE((s) => ({ ...s, vias: [...s.vias, ""] }))}>
                  <Plus size={16} strokeWidth={1.8} aria-hidden="true" /> Ponto de passagem
                </button>
              </div>
              <CampoNumero
                classe="f4"
                id="km"
                rotulo="Km da rota"
                unidade="km"
                valor={e.km ?? (est ? String(est.km) : "")}
                aoMudar={(v) => muda("km", v)}
                ajuda={
                  e.km !== null ? (
                    <Automatico texto="digitado" voltar={est ? () => muda("km", null) : undefined} />
                  ) : est ? (
                    est.origemKm === "medida" ? (
                      "rota já medida pela Prisa"
                    ) : (
                      `estimado: linha reta × ${est.fator.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${est.trechos > 1 ? ` em ${est.trechos} trechos` : ""}`
                    )
                  ) : (
                    "informe as cidades ou digite o km"
                  )
                }
              />
              <CampoNumero
                classe="f4"
                id="pedagio"
                rotulo="Pedágio (vale-pedágio)"
                unidade="R$"
                valor={e.pedagio ?? (pedagioAuto ? campo(pedagioAuto) : "")}
                aoMudar={(v) => muda("pedagio", v)}
                ajuda={
                  e.pedagio !== null ? (
                    <Automatico texto="digitado" voltar={() => muda("pedagio", null)} />
                  ) : (
                    `estimado: R$ ${pedEixoKm.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} por eixo/km${est ? `, ${est.origemPedagio}` : ""}`
                  )
                }
              />
              <div className="campo f4 calc-chave-campo">
                <label className="chave">
                  <input type="checkbox" checked={e.retornoVazio} onChange={(ev) => muda("retornoVazio", ev.target.checked)} />
                  Retorno vazio obrigatório
                </label>
                <span className="ajuda">soma 92% do trecho ao piso</span>
              </div>
            </div>
          </section>

          <section className="painel" aria-labelledby="calc-carga">
            <CabSecao id="calc-carga" titulo="Caminhão e carga">
              O tipo de carga e os eixos escolhem a coluna da tabela da ANTT.
            </CabSecao>
            <div className="campos">
              <div className="campo f6">
                <label htmlFor="tipo">Tipo de carga (ANTT)</label>
                <select id="tipo" value={e.tipo} onChange={(ev) => muda("tipo", ev.target.value as TipoCarga)}>
                  {(Object.keys(tiposCarga) as TipoCarga[]).map((t) => (
                    <option key={t} value={t}>
                      {tiposCarga[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo f6">
                <span className="rotulo" id="eixos-rot">
                  Eixos do caminhão
                </span>
                <Escolha
                  rotuloId="eixos-rot"
                  opcoes={EIXOS.map((x) => [String(x), String(x)])}
                  valor={String(e.eixos)}
                  aoMudar={(v) => muda("eixos", Number(v))}
                />
                {coef && coef.eixosTabela !== e.eixos && <span className="ajuda">a ANTT não tem {e.eixos} eixos: vale a coluna de {coef.eixosTabela}</span>}
              </div>
              <CampoNumero classe="f4" id="peso" rotulo="Peso da carga" unidade="t" valor={e.peso} aoMudar={(v) => muda("peso", v)} />
              <CampoNumero
                classe="f4"
                id="capacidade"
                rotulo="Capacidade do caminhão"
                unidade="t"
                valor={e.capacidade}
                aoMudar={(v) => muda("capacidade", v)}
                ajuda={<Ocupacao peso={peso} capacidade={capacidade} />}
              />
              <CampoNumero
                classe="f4"
                id="valor-mercadoria"
                rotulo="Valor da mercadoria"
                opcional
                unidade="R$"
                valor={e.valorMercadoria}
                aoMudar={(v) => muda("valorMercadoria", v)}
                ajuda="valor da NF: base do seguro da carga"
              />
            </div>
          </section>

          <section className="painel" aria-labelledby="calc-fretes">
            <CabSecao id="calc-fretes" titulo="Fretes">
              O que o cliente paga à Prisa e o que a Prisa paga ao motorista.
            </CabSecao>
            <div className="campos">
              <div className="campo f6">
                <span className="rotulo" id="modo-rot">
                  O cliente paga
                </span>
                <Escolha
                  rotuloId="modo-rot"
                  opcoes={[
                    ["por_tonelada", "Por tonelada"],
                    ["total", "Valor total"],
                  ]}
                  valor={e.modo}
                  aoMudar={(v) => trocarModo(v as Modo)}
                />
              </div>
              <CampoNumero
                classe="f6"
                id="frete-cliente"
                rotulo={e.modo === "por_tonelada" ? "Frete contratado por tonelada" : "Frete contratado (total)"}
                unidade={e.modo === "por_tonelada" ? "R$/t" : "R$"}
                valor={e.freteCliente}
                aoMudar={(v) => muda("freteCliente", v)}
                ajuda={
                  <>
                    valor negociado com o cliente
                    {e.modo === "por_tonelada"
                      ? peso
                        ? `: ${formato.reais(freteCliente)} no total`
                        : "; informe o peso da carga"
                      : peso && freteCliente
                        ? `: ${formato.reais(freteCliente / peso)} por tonelada`
                        : ""}
                  </>
                }
              />
              <div className="f12 calc-contratado">
                {sitContratado && <Sinal tipo={sitContratado.tipo} texto={sitContratado.texto} />}
                {sugerido > 0 && (
                  <button type="button" className="btn" onClick={() => usarContratado(sugerido)}>
                    Usar o sugerido ({formato.reais(sugerido)})
                  </button>
                )}
                {contratadoMinimo !== null && (
                  <button type="button" className="btn" onClick={() => usarContratado(contratadoMinimo)}>
                    Usar o da margem mínima ({formato.reais(contratadoMinimo)})
                  </button>
                )}
              </div>
              <CampoNumero
                classe="f6"
                id="frete-motorista"
                rotulo="Frete do motorista"
                unidade="R$"
                valor={e.freteMotorista}
                aoMudar={(v) => muda("freteMotorista", v)}
                ajuda="valor total da viagem, sem o pedágio"
              />
              <div className="campo f6">
                <span className="rotulo" id="pf-rot">
                  Contratado
                </span>
                <Escolha
                  rotuloId="pf-rot"
                  opcoes={[
                    ["pj", "Pessoa jurídica"],
                    ["pf", "Pessoa física"],
                  ]}
                  valor={e.pf ? "pf" : "pj"}
                  aoMudar={(v) => muda("pf", v === "pf")}
                />
                <span className="ajuda">{e.pf ? "INSS patronal de 4% e retenções de 13,5% sobre 20% do frete" : "sem INSS nem retenções"}</span>
              </div>
              <CampoNumero
                classe="f4"
                id="prazo"
                rotulo="Saldo em"
                unidade="dias"
                valor={e.prazo}
                aoMudar={(v) => muda("prazo", v)}
                ajuda="dias úteis; a lei permite até 30"
              />
              <CampoNumero
                classe="f4"
                id="adiantamento"
                rotulo="Adiantamento"
                unidade="%"
                valor={e.adiantamento}
                aoMudar={(v) => muda("adiantamento", v)}
                ajuda={freteMotorista ? `${formato.reais((freteMotorista * num(e.adiantamento)) / 100)} na carga` : undefined}
              />
              <div className="campo f4 calc-chave-campo">
                <label className="chave">
                  <input type="checkbox" checked={e.rntrc} onChange={(ev) => muda("rntrc", ev.target.checked)} />
                  RNTRC conferido
                </label>
                <a className="ajuda" href="https://consultapublica.antt.gov.br/Site/ConsultaRNTRC.aspx" target="_blank" rel="noreferrer">
                  consultar na ANTT
                </a>
              </div>
            </div>
          </section>

          <section className="painel" aria-labelledby="calc-viagem">
            <CabSecao id="calc-viagem" titulo="Viagem">
              Referências para a conversa com o motorista.
            </CabSecao>
            <div className="campos">
              <CampoNumero classe="f3" id="diesel" rotulo="Preço do diesel" unidade="R$/l" valor={e.diesel} aoMudar={(v) => muda("diesel", v)} />
              <CampoNumero classe="f3" id="consumo" rotulo="Consumo" unidade="km/l" valor={e.consumo} aoMudar={(v) => muda("consumo", v)} />
            </div>
            <Apoio km={km} freteMotorista={freteMotorista} diesel={num(e.diesel)} consumo={num(e.consumo) || 3} />
          </section>
        </div>

        <aside className="calc-lateral" aria-label="Decisão">
          <BarraDecisao d={decisao} />
          <CartaoDecisao d={decisao} porTonelada={e.modo === "por_tonelada" ? peso : 0} margem={verTudo && freteCliente && freteMotorista ? resultado : null} />

          <section className="painel" aria-labelledby="calc-piso">
            <CabSecao id="calc-piso" titulo="Piso ANTT">
              {coef && km > 0
                ? `${km.toLocaleString("pt-BR")} km × R$ ${coef.ccd.toLocaleString("pt-BR", { minimumFractionDigits: 4 })} + R$ ${coef.cc.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${e.retornoVazio ? " + retorno vazio" : ""}, coluna de ${coef.eixosTabela} eixos. ${coef.portaria}.`
                : coef
                  ? "Informe o km da rota."
                  : "Não há coluna da ANTT para este tipo de carga."}
            </CabSecao>
            <dl className="kv calc-kv">
              <dt>Frete mínimo ANTT</dt>
              <dd>
                {piso ? formato.reais(piso) : "—"}
                <span className="linha2">o mínimo para pagar ao motorista</span>
              </dd>
              <dt>Frete sugerido</dt>
              <dd>
                {sugerido ? formato.reais(sugerido) : "—"}
                <span className="linha2">mínimo + {ACRESCIMO_SUGERIDO * 100}% + pedágio</span>
              </dd>
              <dt>Frete contratado</dt>
              <dd>
                {freteCliente ? formato.reais(freteCliente) : "—"}
                {sitContratado && (
                  <span className="linha2">
                    <Sinal tipo={sitContratado.tipo} texto={sitContratado.texto} />
                  </span>
                )}
              </dd>
              <dt>Frete do motorista</dt>
              <dd>
                {freteMotorista ? formato.reais(freteMotorista) : "—"}
                <span className="linha2">
                  <SituacaoPiso piso={piso} freteMotorista={freteMotorista} />
                </span>
              </dd>
            </dl>
          </section>

          <section className="painel" aria-labelledby="calc-ciot">
            <CabSecao id="calc-ciot" titulo="Antes de emitir o CIOT" />
            <Checklist itens={ciot} />
          </section>

          {verTudo ? (
            <>
              <BlocoCte
                cte={cte}
                r={resultado}
                pesoT={peso}
                duplicata={e.duplicata}
                aoDuplicata={(v) => muda("duplicata", v)}
                margemDup={margemDup}
                taxaDup={p.descontoDuplicata}
              />
              <details className="painel calc-aliquotas">
                <summary>Alíquotas</summary>
                <p className="nota">
                  {vigenciaFiscal ? `Vigentes desde ${formato.data(vigenciaFiscal)}.` : "Sem alíquotas vigentes no banco: valores de partida."} Mudar aqui vale só
                  para esta simulação. Confirme com o contador; o seguro segue a apólice.
                </p>
                <div className="campos">
                  {CAMPOS_FISCAIS.map((c) => (
                    <CampoNumero
                      key={c.chave}
                      classe="f6"
                      id={`fiscal-${c.chave}`}
                      rotulo={c.rotulo}
                      valor={fiscalTxt[c.chave]}
                      aoMudar={(v) => setFiscalTxt((s) => ({ ...s, [c.chave]: v }))}
                    />
                  ))}
                </div>
                <button type="button" className="btn btn-texto" onClick={() => setFiscalTxt(textoFiscal(fiscal))}>
                  <RotateCcw size={16} strokeWidth={1.8} aria-hidden="true" /> Voltar às vigentes
                </button>
              </details>
            </>
          ) : (
            <p className="aviso aviso-info">Impostos, margem e resultado do CT-e aparecem só para admin e financeiro. A decisão já considera a margem mínima.</p>
          )}
        </aside>
      </div>
    </>
  );
}

/* ---------- pedaços ---------- */

function CabSecao({ id, titulo, children }: { id: string; titulo: string; children?: ReactNode }) {
  return (
    <div className="calc-cab">
      <h2 id={id}>{titulo}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}

function CampoNumero({
  id,
  rotulo,
  valor,
  aoMudar,
  unidade,
  ajuda,
  classe,
  opcional,
}: {
  id: string;
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  unidade?: string;
  ajuda?: ReactNode;
  classe: string;
  opcional?: boolean;
}) {
  const ruim = invalido(valor);
  return (
    <div className={`campo ${classe}`} data-invalido={ruim || undefined}>
      <label htmlFor={id}>
        {rotulo}
        {opcional && <span className="opcional"> (opcional)</span>}
      </label>
      <div className={unidade ? "calc-unidade" : undefined}>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={valor}
          onChange={(ev) => aoMudar(ev.target.value)}
          aria-invalid={ruim || undefined}
          aria-describedby={ajuda || ruim ? `${id}-ajuda` : undefined}
        />
        {unidade && <span aria-hidden="true">{unidade}</span>}
      </div>
      {ruim ? (
        <span className="erro" id={`${id}-ajuda`}>
          Número inválido: use vírgula nos centavos, como 1.234,56.
        </span>
      ) : (
        ajuda && (
          <span className="ajuda" id={`${id}-ajuda`}>
            {ajuda}
          </span>
        )
      )}
    </div>
  );
}

function CampoCidade({
  id,
  rotulo,
  valor,
  aoMudar,
  busca,
  carregando,
  remover,
}: {
  id: string;
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  busca: ReturnType<typeof acharMunicipio> | undefined;
  carregando: boolean;
  remover?: () => void;
}) {
  const vazio = valor.trim() === "";
  const problema =
    carregando || vazio || busca?.municipio
      ? null
      : busca && busca.ambiguos > 1
        ? `Há ${busca.ambiguos} cidades com esse nome: escolha a da UF certa na lista.`
        : "Cidade não encontrada: escolha da lista ou digite o km.";
  return (
    <div className="campo f6" data-invalido={problema ? true : undefined}>
      <label htmlFor={id}>{rotulo}</label>
      <div className={remover ? "com-acao" : undefined}>
        <input
          id={id}
          list="municipios"
          autoComplete="off"
          placeholder="Digite a cidade"
          value={valor}
          onChange={(ev) => aoMudar(ev.target.value)}
          aria-describedby={problema ? `${id}-erro` : undefined}
        />
        {remover && (
          <button type="button" className="btn" onClick={remover} aria-label={`Remover ${rotulo.toLowerCase()}`}>
            <X size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        )}
      </div>
      {problema && (
        <span className="erro" id={`${id}-erro`}>
          {problema}
        </span>
      )}
    </div>
  );
}

function Escolha({ rotuloId, opcoes, valor, aoMudar }: { rotuloId: string; opcoes: [string, string][]; valor: string; aoMudar: (v: string) => void }) {
  return (
    <div className="calc-opcoes" role="group" aria-labelledby={rotuloId}>
      {opcoes.map(([v, r]) => (
        <button key={v} type="button" aria-pressed={v === valor} onClick={() => aoMudar(v)}>
          {r}
        </button>
      ))}
    </div>
  );
}

function Automatico({ texto, voltar }: { texto: string; voltar?: () => void }) {
  return (
    <>
      {texto}
      {voltar && (
        <>
          {" · "}
          <button type="button" className="calc-link" onClick={voltar}>
            usar a estimativa
          </button>
        </>
      )}
    </>
  );
}

function Ocupacao({ peso, capacidade }: { peso: number; capacidade: number }) {
  if (!(peso > 0) || !(capacidade > 0)) return null;
  const o = peso / capacidade;
  if (o > 1.0005) return <span className="calc-ruim">{campo(peso - capacidade, 3)} t acima da capacidade: risco de multa por excesso de peso</span>;
  if (o < 0.85) return <>ocupação de {Math.round(o * 100)}%: sobram {campo(capacidade - peso, 3)} t</>;
  return <>ocupação de {Math.round(o * 100)}%</>;
}

function SituacaoPiso({ piso, freteMotorista }: { piso: number; freteMotorista: number }) {
  if (!(piso > 0)) return <Sinal tipo="pendente" texto="Sem piso calculado" />;
  if (!(freteMotorista > 0)) return <Sinal tipo="pendente" texto="Sem frete do motorista" />;
  if (freteMotorista < piso - 0.005) return <Sinal tipo="bloqueado" texto={`Abaixo do piso: faltam ${formato.reais(piso - freteMotorista)}`} />;
  return <Sinal tipo="normal" texto={`${porcento(freteMotorista / piso - 1)} acima do piso`} />;
}

function Checklist({ itens }: { itens: readonly ItemCiot[] }) {
  return (
    <ul className="calc-checklist">
      {itens.map((i) => (
        <li key={i.texto}>
          <span className={`sinal sinal-${i.tipo} calc-forma`} aria-label={ROTULO_ITEM[i.tipo]} role="img" />
          <span>
            {i.texto}
            {i.detalhe && <span className="linha2">{i.detalhe}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
const ROTULO_ITEM: Record<ItemCiot["tipo"], string> = { normal: "ok", pendente: "falta informar", vencendo: "conferir", bloqueado: "impedimento" };

const FORMA: Record<Decisao["veredito"], ReactNode> = {
  contratar: <rect x="4" y="8" width="22" height="14" rx="2" fill="currentColor" />,
  negociar: <rect x="8" y="8" width="14" height="14" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2.5" transform="rotate(45 15 15)" />,
  ajustar: <rect x="8" y="8" width="14" height="14" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2.5" transform="rotate(45 15 15)" />,
  nao_contratar: <circle cx="15" cy="15" r="10" fill="none" stroke="currentColor" strokeWidth="3" />,
  incompleto: <circle cx="15" cy="15" r="4" fill="currentColor" />,
};

/** Celular e tablet: a decisão fica abaixo dos campos, então uma pílula fixa no rodapé mostra o veredito e
   o limite principal enquanto se digita; tocar leva ao cartão. */
function BarraDecisao({ d }: { d: Decisao }) {
  const principal = d.limites.find((l) => l.principal);
  return (
    <a className={`calc-barra calc-${d.veredito}`} href="#calc-decisao" aria-hidden="true" tabIndex={-1}>
      <svg viewBox="0 0 30 30" width="18" height="18">
        {FORMA[d.veredito]}
      </svg>
      <b>{d.titulo}</b>
      {principal && principal.valor !== null && (
        <span>
          {principal.rotulo.toLowerCase()} {formato.reais(principal.valor)}
        </span>
      )}
    </a>
  );
}

function CartaoDecisao({ d, porTonelada, margem }: { d: Decisao; porTonelada: number; margem: ReturnType<typeof calcularCTe> | null }) {
  return (
    <section id="calc-decisao" className={`calc-decisao calc-${d.veredito}`} aria-live="polite" aria-labelledby="calc-veredito">
      <div className="calc-decisao-topo">
        <span>Decisão de contratação</span>
        <svg viewBox="0 0 30 30" width="30" height="30" aria-hidden="true">
          {FORMA[d.veredito]}
        </svg>
      </div>
      <h2 id="calc-veredito">{d.titulo}</h2>
      <p>{d.texto}</p>
      {(d.limites.length > 0 || margem) && (
        <dl className="calc-limites">
          {d.limites.map((l) => (
            <div key={l.rotulo} className={l.principal ? "principal" : undefined}>
              <dt>{l.rotulo}</dt>
              <dd>
                {l.valor !== null ? formato.reais(l.valor) : "—"}
                {l.porTonelada && l.valor !== null && porTonelada > 0 && <span className="linha2">{formato.reais(l.valor / porTonelada)} por tonelada</span>}
              </dd>
            </div>
          ))}
          {margem && (
            <div>
              <dt>Margem líquida</dt>
              <dd>
                {porcento(margem.margemLiquida)}
                <span className="linha2">
                  {margem.faixa}; mínimo {porcento(MARGEM_MINIMA)}
                </span>
              </dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}

function BlocoCte({
  cte,
  r,
  pesoT,
  duplicata,
  aoDuplicata,
  margemDup,
  taxaDup,
}: {
  cte: EntradaCTe;
  r: ReturnType<typeof calcularCTe>;
  pesoT: number;
  duplicata: boolean;
  aoDuplicata: (v: boolean) => void;
  margemDup: number;
  taxaDup: number;
}) {
  const tem = cte.freteEmpresa > 0 && cte.freteMotorista > 0;
  const linhas: { rotulo: string; valor: number; detalhe?: string; total?: boolean }[] = [
    { rotulo: "Frete contratado", valor: cte.freteEmpresa, detalhe: pesoT ? `${campo(pesoT, 3)} t` : undefined },
    { rotulo: `ICMS (${porcento(r.aliquotaIcms)})`, valor: -r.icms, detalhe: `${cte.origemUF} → ${cte.destinoUF}` },
    { rotulo: "PIS e COFINS", valor: -r.impostoFederal },
    { rotulo: "Frete do motorista", valor: -cte.freteMotorista },
    { rotulo: "Pedágio", valor: -cte.pedagio },
    ...(r.inssPatronal ? [{ rotulo: "INSS patronal", valor: -r.inssPatronal, detalhe: "contratado pessoa física" }] : []),
    { rotulo: "Taxa Pan Card", valor: -r.taxaPanCard },
    ...(r.seguroCarga ? [{ rotulo: "Seguro da carga", valor: -r.seguroCarga }] : []),
    ...(r.descontoDuplicata ? [{ rotulo: "Desconto de duplicata", valor: -r.descontoDuplicata }] : []),
    { rotulo: "Resultado", valor: r.resultado, total: true, detalhe: `margem ${porcento(r.margem)}` },
    { rotulo: "IRPJ e CSLL", valor: -r.irpjCsll },
    { rotulo: "Resultado líquido", valor: r.resultadoLiquido, total: true, detalhe: `margem ${porcento(r.margemLiquida)}` },
  ];
  const podeDescontar = margemDup >= MARGEM_DUPLICATA - 1e-9;
  return (
    <section className="painel" aria-labelledby="calc-cte">
      <div className="calc-cab calc-cab-linha">
        <h2 id="calc-cte">Resultado do CT-e</h2>
        {tem && <Sinal tipo={sinalDaFaixa(r.faixa)} texto={r.faixa} />}
      </div>
      {tem ? (
        <>
          <table className="calc-demonstrativo">
            <tbody>
              {linhas.map((l) => (
                <tr key={l.rotulo} className={l.total ? "total" : undefined}>
                  <th scope="row">
                    {l.rotulo}
                    {l.detalhe && <span className="linha2">{l.detalhe}</span>}
                  </th>
                  <td>{dinheiro(l.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {r.retencoesMotorista > 0 && (
            <p className="nota">A Prisa retém e recolhe {dinheiro(r.retencoesMotorista)} do motorista (INSS 11% e SEST/SENAT 2,5% sobre 20% do frete), fora do resultado.</p>
          )}
          <div className="calc-duplicata">
            <label className="chave">
              <input type="checkbox" checked={duplicata} onChange={(ev) => aoDuplicata(ev.target.checked)} />
              Descontar a duplicata ({porcento(taxaDup)})
            </label>
            <Sinal
              tipo={podeDescontar ? "normal" : "bloqueado"}
              texto={podeDescontar ? `Pode descontar: margem de ${porcento(margemDup)}` : `Não descontar: margem cairia para ${porcento(margemDup)}`}
            />
            <span className="nota">Mínimo de {porcento(MARGEM_DUPLICATA)} de margem (antes do IRPJ e CSLL) com o desconto.</span>
          </div>
        </>
      ) : (
        <p className="nota">Informe o frete do cliente e o do motorista para ver o resultado.</p>
      )}
    </section>
  );
}

function Apoio({ km, freteMotorista, diesel, consumo }: { km: number; freteMotorista: number; diesel: number; consumo: number }) {
  const custoDiesel = km > 0 ? (km / consumo) * diesel : 0;
  const itens: [string, string, string][] = [
    ["Tempo de direção", horasTexto(horasDeViagem(km)), "a 80 km/h, com paradas"],
    ["Diesel", km ? formato.reais(custoDiesel) : "—", km ? `${Math.round(km / consumo).toLocaleString("pt-BR")} litros` : ""],
    ["Sobra ao motorista", km && freteMotorista ? dinheiro(freteMotorista - custoDiesel) : "—", "frete − diesel"],
    ["Frete por km", km && freteMotorista ? formato.reais(freteMotorista / km) : "—", "do motorista"],
  ];
  return (
    <dl className="calc-apoio">
      {itens.map(([r, v, s]) => (
        <div key={r}>
          <dt>{r}</dt>
          <dd>
            {v}
            {s && <span className="linha2">{s}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
