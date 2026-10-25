"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, CircleX, Link2, Plus, Unlink, X } from "lucide-react";
import { Acoplamento, Peca, type PecaEngate } from "@/components/Engate";
import { Placa } from "@/components/Placa";
import { toast } from "@/components/Toast";
import { capacidade, MENSAGENS_CONJUNTO, podeSerBase } from "@/lib/conjunto";
import { formato, mascaras } from "@/lib/formato";
import { validacao } from "@/lib/validacao";
import { salvarConjunto } from "./actions";
import { avisosMotorista, ContaCapacidade } from "./avisos";
import type { BaseMontador } from "./consultas";
import { DialogoEncerrar, type ConjuntoEncerrar } from "./dialogo-encerrar";
import { diaSP, Partes } from "./partes";
import {
  abertoCom,
  errosPorPeca,
  MAX_PECAS,
  nomeConjunto,
  rotuloLivre,
  tipoTxt,
  type AbertoConjunto,
  type LocalErro,
  type VeiculoConjunto,
} from "./regras";

/** Conjunto aberto em edição ("Trocar peças"). */
export type EdicaoConjunto = {
  conjuntoId: string;
  cavaloId: string;
  itens: string[];
  motoristaId: string | null;
  /** Nome do motorista atual (pode não estar entre os de cadastro normal). */
  motoristaNome: string | null;
};

type Props = {
  base: BaseMontador;
  editar: EdicaoConjunto | null;
  /** `?cavalo=` (ficha do veículo → "Montar conjunto"): cavalo já escolhido. */
  cavaloInicial: string | null;
};

type ErroBanco = { mensagem: string; local: LocalErro | null };

const erroMsg = (msg: string, chave: string | number) => (
  <span className="erro-msg" key={chave}>
    <CircleX size={14} strokeWidth={1.6} aria-hidden="true" />
    <span>{msg}</span>
  </span>
);

/** A peça do montador como `<Peca>` do Engate (modelinho + rodas + nome + placa). */
const comoPeca = (v: VeiculoConjunto): PecaEngate => ({
  placa: v.placa,
  categoria: v.categoria as PecaEngate["categoria"],
  configuracao_cavalo: v.configuracao_cavalo,
  eixos: v.eixos,
  tipo: v.tipo,
  capacidade_carga_t: v.capacidade_carga_t ?? (v.pbt_t != null && v.tara_t != null ? Math.round((v.pbt_t - v.tara_t) * 100) / 100 : null),
});

/** Mesmo desenho de `<Engate>` (components/Engate.tsx), com a guia tracejada e a vaga da próxima peça. */
function Previa({ cavalo, itens }: { cavalo: VeiculoConjunto | null; itens: VeiculoConjunto[] }) {
  if (!cavalo) {
    const g = (categoria: PecaEngate["categoria"], rotulo: string, eixos: number, nota: string) => (
      <Peca v={{ placa: "", categoria, eixos }} fantasma rotulo={rotulo} nota={nota} />
    );
    return (
      <div className="engate fantasma" role="img" aria-label="Ordem de engate: cavalo, carreta da posição 1, dolly opcional, carreta da posição 2">
        {g("cavalo", "1. Cavalo", 3, "escolha abaixo")}
        <Acoplamento />
        {g("carreta", "2. Carreta", 3, "engata no cavalo")}
        <Acoplamento />
        {g("dolly", "3. Dolly", 2, "opcional")}
        <Acoplamento />
        {g("carreta", "4. Carreta", 3, "rodotrem")}
      </div>
    );
  }
  const n = itens.length;
  return (
    <div className="engate" role="img" aria-label={`Conjunto ${[cavalo, ...itens].map((v) => v.placa).join(", ")}`}>
      <Peca v={comoPeca(cavalo)} />
      {itens.map((v, i) => (
        <Fragment key={`${v.id}-${i}`}>
          <Acoplamento />
          <Peca v={comoPeca(v)} />
        </Fragment>
      ))}
      {n < MAX_PECAS && cavalo.categoria !== "caminhao" && (
        <>
          <Acoplamento />
          <Peca v={{ placa: "", categoria: "carreta", eixos: 3 }} fantasma rotulo={n ? "próxima peça" : "carreta da posição 1"} nota="adicione abaixo" />
        </>
      )}
    </div>
  );
}

const descricao = (v: VeiculoConjunto) => `${v.marca ?? ""} ${v.modelo ?? ""}`.trim();

/* Montador do conjunto (`renderMontador` de prototipo/conjunto.html): `/conjuntos/novo` e
   "Trocar peças" (`/conjuntos/<id>?editar=1`). Valida ao vivo com lib/conjunto (mesmas mensagens do
   banco) e salva com uma chamada de `salvar_conjunto`: se o banco ainda recusar, a mensagem dele
   aparece junto da peça (ou do cavalo) e nada fica gravado pela metade. */
export function Montador({ base, editar, cavaloInicial }: Props) {
  const router = useRouter();
  const V = useMemo(() => new Map(base.veiculos.map((v) => [v.id, v])), [base.veiculos]);
  const normais = useMemo(() => new Map(base.motoristas.map((m) => [m.pessoa_id, m])), [base.motoristas]);
  const conjuntoId = editar?.conjuntoId ?? null;

  const inicialCavalo =
    editar?.cavaloId ?? (cavaloInicial && podeSerBase(V.get(cavaloInicial)?.categoria ?? "outros") ? cavaloInicial : null);
  const ultimoDe = (cid: string | null) => {
    const u = cid ? V.get(cid)?.ultimo_motorista_id : null;
    return u && normais.has(u) ? u : null;
  };

  const [cavaloId, setCavaloId] = useState<string | null>(inicialCavalo);
  const [itens, setItens] = useState<string[]>(editar?.itens ?? []);
  const [motoristaId, setMotoristaId] = useState<string>(editar ? (editar.motoristaId ?? "") : (ultimoDe(inicialCavalo) ?? ""));
  const [ajudaMot, setAjudaMot] = useState(!editar && ultimoDe(inicialCavalo) ? "Último motorista deste cavalo. Troque se for outro." : "");
  const [buscaCav, setBuscaCav] = useState("");
  const [placaAdd, setPlacaAdd] = useState("");
  const [erroAdd, setErroAdd] = useState<ReactNode>(null);
  const [erroBanco, setErroBanco] = useState<ErroBanco | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const [encerrar, setEncerrar] = useState<ConjuntoEncerrar | null>(null);
  const [salvando, iniciar] = useTransition();
  const foco = useRef<string | null>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  // foco depois de redesenhar (adicionar, mover, remover), como o protótipo
  useEffect(() => {
    if (!foco.current) return;
    document.querySelector<HTMLElement>(foco.current)?.focus();
    foco.current = null;
  });

  const anunciar = (t: string) => {
    setAnuncio("");
    setTimeout(() => setAnuncio(t), 40);
  };

  /** Mudou a composição: a recusa do banco era desta montagem, não vale mais. */
  const compor = (fn: (atual: string[]) => string[]) => {
    setItens(fn);
    setErroBanco(null);
  };

  const outros: AbertoConjunto[] = base.abertos.filter((c) => c.id !== conjuntoId);
  const placaDe = (id: string) => V.get(id)?.placa ?? "—";
  const nomeDe = (c: AbertoConjunto) => nomeConjunto([c.cavalo_id, ...c.item_ids].map(placaDe));
  const cavalo = cavaloId ? (V.get(cavaloId) ?? null) : null;
  const pecasV = itens.flatMap((id) => V.get(id) ?? []);
  const r = errosPorPeca(cavalo, pecasV, outros);
  const outroCavalo = cavalo && r.cavalo.length ? abertoCom(cavalo.id, outros) : undefined;

  // a recusa do banco entra junto da peça (ou do cavalo) que ela acusa, sem repetir a validação ao vivo
  const errosCavalo = [...r.cavalo];
  const errosItens = r.itens.map((e) => [...e]);
  if (erroBanco?.local?.alvo === "cavalo" && !errosCavalo.includes(erroBanco.mensagem)) errosCavalo.push(erroBanco.mensagem);
  if (erroBanco?.local?.alvo === "peca") {
    const e = errosItens[erroBanco.local.posicao - 1];
    if (e && !e.includes(erroBanco.mensagem)) e.push(erroBanco.mensagem);
  }

  const n = itens.length;
  const truck = cavalo?.categoria === "caminhao";
  const nErros = errosCavalo.length + errosItens.reduce((s, e) => s + e.length, 0);
  const nomeAtual = cavalo ? nomeConjunto([cavalo.placa, ...pecasV.map((v) => v.placa)]) : "";
  const nomeEditado = editar ? nomeConjunto([editar.cavaloId, ...editar.itens].map(placaDe)) : "";
  const voltar = editar ? `/conjuntos/${editar.conjuntoId}` : "/conjuntos";

  /* ----- motivo do salvar ----- */
  let motivo: ReactNode;
  if (erroBanco && !erroBanco.local) motivo = <>Não foi salvo: <b>{erroBanco.mensagem}</b></>;
  else if (!cavaloId) motivo = "Para salvar, escolha o cavalo ou o truck.";
  else if (!n && !truck && !errosCavalo.length) motivo = "Para salvar, adicione pelo menos uma carreta.";
  else if (nErros) {
    const iPos = errosItens.findIndex((e) => e.length);
    const primeira = errosCavalo[0] ?? errosItens[iPos][0];
    motivo = (
      <>
        {erroBanco ? "Não foi salvo" : "Salvar desligado"}: {nErros === 1 ? "1 problema" : `${nErros} problemas`}. <b>{primeira}</b> (
        {errosCavalo.length ? (truck ? "no truck" : "no cavalo") : `posição ${iPos + 1}`}).
      </>
    );
  } else if (cavalo) {
    motivo = truck
      ? "Pronto para salvar: truck roda sozinho, sem carreta."
      : capacidade(cavalo, pecasV).excede_cmt ? "Pronto para salvar, com aviso: passa do CMT do cavalo." : "Pronto para salvar.";
  }
  // recusa de composição (com lugar na peça/cavalo) desliga até a montagem mudar; erro geral
  // (sessão, falha de rede, conjunto encerrado…) deixa tentar de novo
  const desligado = !cavaloId || (!n && !truck) || nErros > 0 || !!erroBanco?.local || salvando;

  /* ----- ações ----- */
  function escolherCavalo(id: string) {
    setCavaloId(id);
    setErroBanco(null);
    const u = ultimoDe(id);
    if (!motoristaId && u) {
      setMotoristaId(u);
      setAjudaMot("Último motorista deste cavalo. Troque se for outro.");
    }
    anunciar(`Cavalo ${placaDe(id)} escolhido`);
  }

  function adicionar(id: string) {
    compor((atual) => [...atual, id]);
    anunciar(`${placaDe(id)} adicionada na posição ${n + 1}`);
  }

  function adicionarDigitada() {
    const pl = validacao.normalizarPlaca(placaAdd);
    const falha = (msg: ReactNode) => {
      setErroAdd(msg);
      foco.current = "#add-placa";
    };
    if (!pl) return falha("Digite a placa da carreta ou do dolly.");
    const v = base.veiculos.find((x) => x.placa === pl);
    if (!v)
      return falha(
        <>
          Nenhum veículo com a placa {pl}. Confira a placa ou <Link href="/veiculos/novo">cadastre o veículo</Link> antes.
        </>,
      );
    if (v.id === cavaloId) return falha(`${pl} é o cavalo deste conjunto.`);
    const ja = itens.indexOf(v.id);
    if (ja >= 0) return falha(`${pl} já está na posição ${ja + 1}.`);
    setErroAdd(null);
    setPlacaAdd("");
    adicionar(v.id);
    foco.current = "#add-placa";
  }

  function mover(id: string, acao: "subir" | "descer" | "remover") {
    const i = itens.indexOf(id);
    const placa = placaDe(id);
    if (acao === "remover") {
      const resto = itens.filter((x) => x !== id);
      compor(() => resto);
      anunciar(`${placa} removida do conjunto`);
      const prox = resto[Math.min(i, resto.length - 1)];
      foco.current = prox ? `[data-acao="remover"][data-vid="${prox}"]` : "#add-placa";
      return;
    }
    const j = acao === "subir" ? i - 1 : i + 1;
    if (j < 0 || j >= n) return;
    const novo = [...itens];
    [novo[i], novo[j]] = [novo[j], novo[i]];
    compor(() => novo);
    anunciar(`${placa} agora na posição ${j + 1} de ${n}`);
    const oposto = acao === "subir" ? "descer" : "subir";
    const ficaDesligado = acao === "subir" ? j === 0 : j === n - 1;
    foco.current = `[data-acao="${ficaDesligado ? oposto : acao}"][data-vid="${id}"]`;
  }

  function salvar() {
    if (desligado || !cavaloId) return;
    const nome = nomeAtual;
    setErroBanco(null);
    iniciar(async () => {
      const res = await salvarConjunto({
        conjuntoId,
        cavaloId,
        motoristaId: motoristaId || null,
        itens,
      });
      if (res.ok) {
        toast(editar ? `Peças do conjunto ${nome} salvas` : `Conjunto ${nome} montado`);
        router.push(`/conjuntos/${res.dados}`);
        return;
      }
      setErroBanco({ mensagem: res.erro, local: "local" in res ? res.local : null });
      anunciar(`Não foi salvo: ${res.erro}`);
      // os dados da tela podem estar velhos (outra pessoa engatou a peça): busca de novo
      router.refresh();
    });
  }

  /* ----- cavalo ----- */
  const termo = validacao.normalizarPlaca(buscaCav);
  const cavalos = base.veiculos.filter((v) => podeSerBase(v.categoria));
  const visiveis = cavalos.filter((v) => !termo || v.placa.includes(termo) || v.id === cavaloId);
  const digitado = termo.length === 7 ? base.veiculos.find((v) => v.placa === termo) : undefined;

  let areaCavalo: ReactNode;
  if (editar && cavalo) {
    areaCavalo = (
      <>
        <div className="lista-op">
          <div className="op-linha" style={{ cursor: "default", gridTemplateColumns: "100px minmax(0,1fr) 96px" }}>
            <Placa placa={cavalo.placa} />
            <span className="desc">
              <b>{tipoTxt(cavalo.tipo)}</b>
              <span>{descricao(cavalo)}</span>
            </span>
            <span className="num">
              {formato.t(cavalo.cmt_t)}
              <span>CMT</span>
            </span>
          </div>
        </div>
        {errosCavalo.length > 0 && <div className="erros-peca">{errosCavalo.map(erroMsg)}</div>}
        <p className="ajuda" style={{ marginTop: 8 }}>
          O cavalo define o conjunto. Para trocar o cavalo, encerre este conjunto e monte outro.
        </p>
      </>
    );
  } else {
    areaCavalo = (
      <>
        <div className="campo" style={{ maxWidth: 280, marginBottom: 12 }}>
          <label htmlFor="busca-cav">Buscar placa do cavalo ou do truck</label>
          <input
            id="busca-cav"
            autoComplete="off"
            placeholder="Ex.: ABC1D23"
            aria-describedby="erro-cav"
            value={buscaCav}
            onChange={(e) => setBuscaCav(mascaras.placa(e.target.value))}
          />
        </div>
        <div className="lista-op" id="lista-cav" role="radiogroup" aria-label="Cavalos e trucks">
          {visiveis.length ? (
            visiveis.map((v) => {
              const o = abertoCom(v.id, base.abertos);
              const mot = o?.motorista_id ? base.nomes[o.motorista_id] : null;
              const estado = o
                ? `Em conjunto aberto${mot ? ` com ${mot}` : ""}`
                : v.situacao_operacional === "parado"
                  ? "Livre, parado"
                  : "Livre";
              return (
                <label className="op-linha" key={v.id}>
                  <input
                    type="radio"
                    name="cavalo"
                    value={v.id}
                    checked={v.id === cavaloId}
                    onChange={() => escolherCavalo(v.id)}
                    aria-label={`${v.placa}, ${tipoTxt(v.tipo)}`}
                  />
                  <Placa placa={v.placa} />
                  <span className="desc">
                    <b>{tipoTxt(v.tipo)}</b>
                    <span>
                      <Partes itens={[descricao(v), v.dono]} />
                    </span>
                  </span>
                  <span className="num">
                    {formato.t(v.cmt_t)}
                    <span>CMT</span>
                  </span>
                  <span className="estado">{estado}</span>
                </label>
              );
            })
          ) : (
            <div className="vazio-bloco" style={{ border: 0 }}>
              Nenhum cavalo ou truck com “{termo}” na placa.
            </div>
          )}
        </div>
        <div id="erro-cav" style={{ marginTop: 12 }}>
          {digitado && !podeSerBase(digitado.categoria) && (
            <>
              <div className="erros-peca">{erroMsg(MENSAGENS_CONJUNTO.cavaloInvalido, "dig")}</div>
              <p className="ajuda" style={{ marginTop: 4 }}>
                {digitado.placa} é {tipoTxt(digitado.tipo).toLowerCase()}. Escolha um cavalo ou um truck.
              </p>
            </>
          )}
          {errosCavalo.length > 0 && <div className="erros-peca">{errosCavalo.map(erroMsg)}</div>}
          {outroCavalo && cavalo && (
            <div className="aviso aviso-pendente" style={{ marginTop: 8 }}>
              <Link2 size={18} strokeWidth={1.6} aria-hidden="true" />
              <div>
                <b>
                  {cavalo.placa} está no conjunto aberto {nomeDe(outroCavalo)}
                </b>
                {outroCavalo.motorista_id && base.nomes[outroCavalo.motorista_id] ? `, com ${base.nomes[outroCavalo.motorista_id]}` : ""}, desde{" "}
                {formato.data(diaSP(outroCavalo.inicio))}. Encerre aquele conjunto para montar um novo com este cavalo, ou troque as peças dele.
                <div className="opcoes" style={{ marginTop: 10 }}>
                  <button
                    className="btn btn-perigo"
                    type="button"
                    id="btn-encerrar-outro"
                    onClick={() =>
                      setEncerrar({
                        id: outroCavalo.id,
                        nome: nomeDe(outroCavalo),
                        motorista: outroCavalo.motorista_id ? (base.nomes[outroCavalo.motorista_id] ?? null) : null,
                      })
                    }
                  >
                    <Unlink size={16} strokeWidth={1.6} aria-hidden="true" />
                    Encerrar {nomeDe(outroCavalo)}
                  </button>
                  <Link className="btn" href={`/conjuntos/${outroCavalo.id}?editar=1`}>
                    Trocar peças dele
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  /* ----- peças ----- */
  const ultima = n ? V.get(itens[n - 1]) : null;
  const ajudaAdd =
    n >= MAX_PECAS
      ? `O conjunto já tem ${MAX_PECAS} peças, o máximo.`
      : !n
        ? "Posição 1: a carreta que engata no cavalo."
        : ultima?.categoria === "dolly"
          ? `Posição ${n + 1}: a carreta que engata no dolly.`
          : `Posição ${n + 1}: um dolly, para engatar outra carreta atrás.`;
  const pecasFrota = base.veiculos.filter((v) => v.categoria === "carreta" || v.categoria === "dolly");
  const livres = pecasFrota.filter((v) => !itens.includes(v.id) && !abertoCom(v.id, outros));

  /* ----- motorista ----- */
  const opcoesMot = [...base.motoristas];
  const motSel = motoristaId ? normais.get(motoristaId) : undefined;
  const outroDoMotorista = motoristaId ? base.abertos.find((c) => c.id !== conjuntoId && c.motorista_id === motoristaId) : undefined;
  const avisosMot = motSel
    ? avisosMotorista(motSel, outroDoMotorista ? { id: outroDoMotorista.id, nome: nomeDe(outroDoMotorista) } : null)
    : [];

  return (
    <>
      <div className="titulo">
        <div>
          <div className="migalha">
            <Link href="/conjuntos">Conjuntos</Link>
            <span className="sep">/</span>
            {editar && (
              <>
                <Link href={voltar} id="mig-voltar">
                  {nomeEditado}
                </Link>
                <span className="sep">/</span>
              </>
            )}
            <h1 id="h1" tabIndex={-1} ref={tituloRef}>
              {editar ? "Trocar peças" : "Montar conjunto"}
            </h1>
          </div>
          <p className="sub">Monte na ordem física de engate, do cavalo para trás. As regras do banco são conferidas enquanto você monta.</p>
        </div>
      </div>
      <p className="sr-only" aria-live="polite" id="anuncio">
        {anuncio}
      </p>

      <div className="previa engate-grande" id="previa" style={{ marginBottom: 8 }}>
        <Previa cavalo={cavalo} itens={pecasV} />
      </div>
      <p className="conta-formula" id="previa-legenda" style={{ marginBottom: 24 }}>
        {cavalo ? (
          <Partes
            itens={[
              nomeAtual,
              `${cavalo.eixos + pecasV.reduce((s, v) => s + v.eixos, 0)} eixos`,
              truck ? "truck, sem carreta" : `${n} ${n === 1 ? "peça" : "peças"} atrás do cavalo`,
            ]}
          />
        ) : (
          "O desenho acompanha a montagem."
        )}
      </p>

      <form
        className="montador"
        id="montador"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <section className="secao" aria-labelledby="s-cav">
          <div className="secao-rotulo">
            <h2 id="s-cav">Cavalo ou truck</h2>
            <p>A peça que traciona. Aparecem cavalos e trucks; o truck roda sozinho, sem carreta.</p>
          </div>
          <div id="cavalo-area">{areaCavalo}</div>
        </section>

        {/* truck roda sozinho: sem a seção de peças (volta se houver peça a remover) */}
        {(!truck || n > 0) && (
        <section className="secao" aria-labelledby="s-pecas">
          <div className="secao-rotulo">
            <h2 id="s-pecas">Peças em ordem de engate</h2>
            <p>Posição 1 é a carreta que engata no cavalo; depois o dolly; depois a carreta de trás.</p>
            <p>Até 3 carretas e {MAX_PECAS} peças. Use as setas para mudar a ordem.</p>
          </div>
          <div>
            <ol className={n ? "pecas" : undefined} id="pecas" aria-label="Peças em ordem de engate" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {n ? (
                itens.map((id, i) => {
                  const v = V.get(id);
                  if (!v) return null;
                  const e = errosItens[i];
                  const o = abertoCom(id, outros);
                  return (
                    <li className={`peca-linha${e.length ? " com-erro" : ""}`} key={id} data-vid={id}>
                      <span className="pos">
                        <span className="sr-only">Posição </span>
                        {i + 1}
                      </span>
                      <Placa placa={v.placa} />
                      <div className="desc">
                        <b>{tipoTxt(v.tipo)}</b>
                        <span>
                          <Partes itens={[descricao(v), v.dono]} />
                        </span>
                        {e.length > 0 && (
                          <div className="erros-peca">
                            {e.map(erroMsg)}
                            {o && (
                              <span className="ajuda">
                                Está em <Link href={`/conjuntos/${o.id}`}>{nomeDe(o)}</Link>.
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="num">
                        tara <b>{formato.t(v.tara_t)}</b>
                        {v.categoria === "carreta" && (
                          <>
                            <br />
                            carga <b>{formato.t(v.capacidade_carga_t ?? (v.pbt_t != null && v.tara_t != null ? +(v.pbt_t - v.tara_t).toFixed(2) : null))}</b>
                          </>
                        )}
                      </div>
                      <div className="botoes">
                        <button
                          className="btn btn-icone"
                          type="button"
                          data-acao="subir"
                          data-vid={id}
                          disabled={i === 0}
                          aria-label={`Subir ${v.placa} para a posição ${i}`}
                          title="Subir"
                          onClick={() => mover(id, "subir")}
                        >
                          <ArrowUp size={16} strokeWidth={1.6} aria-hidden="true" />
                        </button>
                        <button
                          className="btn btn-icone"
                          type="button"
                          data-acao="descer"
                          data-vid={id}
                          disabled={i === n - 1}
                          aria-label={`Descer ${v.placa} para a posição ${i + 2}`}
                          title="Descer"
                          onClick={() => mover(id, "descer")}
                        >
                          <ArrowDown size={16} strokeWidth={1.6} aria-hidden="true" />
                        </button>
                        <button
                          className="btn btn-icone"
                          type="button"
                          data-acao="remover"
                          data-vid={id}
                          aria-label={`Remover ${v.placa} do conjunto`}
                          title="Remover"
                          onClick={() => mover(id, "remover")}
                        >
                          <X size={16} strokeWidth={1.6} aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })
              ) : (
                <li className="pecas-vazio">Nenhuma peça ainda. Adicione a carreta que engata no cavalo.</li>
              )}
            </ol>
            <div className="adicionar">
              <div className="linha-add">
                <div className="campo" id="campo-add" data-invalido={erroAdd ? "" : undefined}>
                  <label htmlFor="add-placa">Placa da próxima peça</label>
                  <div className="com-acao">
                    <input
                      id="add-placa"
                      list="placas-pecas"
                      autoComplete="off"
                      placeholder="Ex.: ABC1D23"
                      aria-describedby="ajuda-add"
                      aria-invalid={erroAdd ? true : undefined}
                      disabled={n >= MAX_PECAS}
                      value={placaAdd}
                      onChange={(e) => {
                        setPlacaAdd(mascaras.placa(e.target.value));
                        if (erroAdd) setErroAdd(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          adicionarDigitada();
                        }
                      }}
                    />
                    <button className="btn" type="button" id="btn-add" disabled={n >= MAX_PECAS} onClick={adicionarDigitada}>
                      <Plus size={16} strokeWidth={1.6} aria-hidden="true" />
                      Adicionar
                    </button>
                  </div>
                  <span className="erro" id="erro-add" hidden={!erroAdd}>
                    {erroAdd}
                  </span>
                  <span className="ajuda" id="ajuda-add">
                    {ajudaAdd}
                  </span>
                </div>
              </div>
              <div className="livres" id="livres">
                {n >= MAX_PECAS ? null : livres.length ? (
                  <>
                    <span className="livres-rot">Livres:</span>
                    {livres.map((v) => (
                      <button
                        className="btn"
                        type="button"
                        key={v.id}
                        data-add={v.id}
                        aria-label={`Adicionar ${v.placa}, ${tipoTxt(v.tipo)}`}
                        onClick={() => {
                          adicionar(v.id);
                          foco.current = `#livres [data-add]:not([data-add="${v.id}"]), #add-placa`;
                        }}
                      >
                        <Plus size={16} strokeWidth={1.6} aria-hidden="true" />
                        <span className="cod">{v.placa}</span>
                        {rotuloLivre(v)}
                      </button>
                    ))}
                  </>
                ) : (
                  <span className="livres-rot">Nenhuma carreta ou dolly livre: as outras estão em conjuntos abertos.</span>
                )}
              </div>
              <datalist id="placas-pecas">
                {pecasFrota
                  .filter((v) => !itens.includes(v.id))
                  .map((v) => (
                    <option key={v.id} value={v.placa}>
                      {tipoTxt(v.tipo)}
                      {abertoCom(v.id, outros) ? ", em outro conjunto" : ""}
                    </option>
                  ))}
              </datalist>
            </div>
          </div>
        </section>
        )}

        <section className="secao" aria-labelledby="s-cap">
          <div className="secao-rotulo">
            <h2 id="s-cap">Capacidade</h2>
            <p>Limite de carga = CMT do cavalo − taras de todas as peças. Passar do limite é um aviso: dá para salvar.</p>
          </div>
          <div id="cap-area">
            {cavalo ? <ContaCapacidade cavalo={cavalo} itens={pecasV} /> : <div className="vazio-bloco">Escolha o cavalo para ver o limite de carga.</div>}
          </div>
        </section>

        <section className="secao" aria-labelledby="s-mot">
          <div className="secao-rotulo">
            <h2 id="s-mot">
              Motorista <span className="opcional">(opcional)</span>
            </h2>
            <p>Só motoristas com cadastro normal. CNH e consulta de risco vencidas aparecem como aviso.</p>
          </div>
          <div>
            <div className="campo">
              <label htmlFor="sel-mot">Motorista</label>
              <select
                id="sel-mot"
                value={motoristaId}
                onChange={(e) => {
                  setMotoristaId(e.target.value);
                  setAjudaMot("");
                }}
              >
                <option value="">Sem motorista por enquanto</option>
                {editar?.motoristaId && !normais.has(editar.motoristaId) && (
                  <option value={editar.motoristaId}>{editar.motoristaNome ?? "Motorista atual"}</option>
                )}
                {opcoesMot.map((m) => (
                  <option key={m.pessoa_id} value={m.pessoa_id}>
                    {m.nome}, CNH {(m.cnh_categoria ?? "—").toUpperCase()} até {formato.data(m.cnh_validade)}
                  </option>
                ))}
              </select>
              <span className="ajuda" id="ajuda-mot">
                {ajudaMot}
              </span>
            </div>
            <div className="avisos" id="mot-avisos" style={{ marginTop: 12 }}>
              {avisosMot}
            </div>
          </div>
        </section>

        <div className="barra-salvar" id="barra">
          <span className="motivo" id="motivo" aria-live="polite">
            {motivo}
          </span>
          <div className="acoes-barra">
            <Link className="btn btn-texto" href={voltar} id="btn-cancelar">
              Cancelar
            </Link>
            <button className="btn btn-primario" type="submit" id="salvar" aria-describedby="motivo" disabled={desligado}>
              <Check size={16} strokeWidth={1.6} aria-hidden="true" />
              {editar ? "Salvar peças" : "Salvar conjunto"}
            </button>
          </div>
        </div>
      </form>

      <DialogoEncerrar
        conjunto={encerrar}
        aoFechar={() => setEncerrar(null)}
        aoEncerrar={() => {
          setEncerrar(null);
          setErroBanco(null);
          anunciar("Conjunto anterior encerrado. O cavalo está livre.");
          foco.current = "#busca-cav";
          router.refresh();
        }}
      />
    </>
  );
}
