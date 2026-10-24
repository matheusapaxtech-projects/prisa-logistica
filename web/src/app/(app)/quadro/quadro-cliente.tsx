"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { RotateCw, Route } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { Abas } from "@/components/Abas";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Numero } from "@/components/Numero";
import { Sinal, type TipoSinal } from "@/components/Sinal";
import { toast } from "@/components/Toast";
import { tipado, type Banco } from "@/lib/banco";
import { proximoEstado, textoConexao, type EstadoConexao } from "@/lib/conexao";
import { pode, type Perfil } from "@/lib/papeis";
import {
  agruparPorColuna,
  colunaAnterior,
  COLUNAS,
  destinosPermitidos,
  filtrarCartoes,
  formularioDaPassagem,
  rotuloDe,
  type Cartao,
  type StatusCampo,
} from "@/lib/quadro";
import { createBrowserClient } from "@/lib/supabase/client";
import { confirmarPagamentoSaida } from "../viagens/actions";
import { enviarCanhotoDoNavegador } from "../viagens/envio";
import { moverViagem } from "./actions";
import { CartaoQuadro } from "./cartao";
import { Coluna } from "./coluna";
import { carregarQuadro, type DadosQuadro, type Limite } from "./consultas";
import { DialogoPagamento, DialogoPassagem, MenuMover, type EnviarCanhoto, type Passagem } from "./dialogos-passagem";
import { FichaRapida } from "./ficha-rapida";
import { FiltrosQuadro } from "./filtros";
import { TemposLimite } from "./tempos-limite";
import { buscaDe, foiAtualizado, nivelDoCartao, opcoesDe, paraFiltros, type EstadoFiltros } from "./regras";

/* Quadro da operação em tempo real (Client Component): estado dos cartões, tempo real, filtros,
   arrastar e "Mover". O banco é a autoridade: a tela só mostra e chama `mover_viagem`.

   Tempo real (Ruling R9): canal `postgres_changes` só na tabela `viagem`. Contrato com `proximoEstado`:
   canal SUBSCRIBED → `inscrito` → recarrega `v_quadro` → `recarregou` (só aí "Ao vivo"); CHANNEL_ERROR /
   TIMED_OUT → `erro`; CLOSED → `fechado`. Cada mudança recarrega o quadro (agrupando em 300 ms); também
   recarrega ao voltar o foco da janela e depois de cada ação do próprio usuário (canhoto e ocorrência
   lançados por outra pessoa aparecem na próxima recarga). Sem rede (evento `offline`), o quadro marca
   "Desatualizado" na hora e, com a rede de volta, assina de novo. */

export type OuvinteQuadro = {
  /** Algo mudou na tabela `viagem`. */
  mudou: () => void;
  /** Estado do canal de tempo real. */
  estado: (s: "inscrito" | "erro" | "fechado") => void;
};

/** De onde o quadro lê e de onde ouve as mudanças (o teste troca por uma fonte falsa). */
export type FonteQuadro = {
  carregar: () => Promise<DadosQuadro>;
  /** Assina o tempo real; devolve a função que desassina. */
  assinar: (ouvinte: OuvinteQuadro) => () => void;
};

/** Fonte de verdade no navegador: `v_quadro` pelo cliente do navegador e o canal do Supabase Realtime. */
export function fonteDoNavegador(): FonteQuadro {
  let cliente: Banco | null = null;
  const db = () => (cliente ??= tipado(createBrowserClient()));
  return {
    carregar: () => carregarQuadro(db()),
    assinar: (ouvinte) => {
      const sb = db();
      const canal = sb
        .channel(`quadro-viagem-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "viagem" }, () => ouvinte.mudou())
        .subscribe((status) => {
          if (status === "SUBSCRIBED") ouvinte.estado("inscrito");
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") ouvinte.estado("erro");
          else if (status === "CLOSED") ouvinte.estado("fechado");
        });
      return () => {
        void sb.removeChannel(canal);
      };
    },
  };
}

/* ---------- colunas estreitadas (lembradas no navegador) ---------- */

const CHAVE_ESTREITAS = "nilt.quadro.estreitas";
const ESPERA: readonly string[] = COLUNAS.filter((c) => c.espera).map((c) => c.status);
const SEM_ESTREITAS: StatusCampo[] = [];
const ouvintesEstreitas = new Set<() => void>();
let estreitasEmMemoria: { bruto: string | null; lista: StatusCampo[] } = { bruto: null, lista: SEM_ESTREITAS };

function lerEstreitas(): StatusCampo[] {
  let bruto: string | null;
  try {
    bruto = localStorage.getItem(CHAVE_ESTREITAS);
  } catch {
    return estreitasEmMemoria.lista; // sem armazenamento: vale o que foi escolhido nesta aba
  }
  if (bruto !== estreitasEmMemoria.bruto) {
    let lista: StatusCampo[] = SEM_ESTREITAS;
    try {
      const v: unknown = JSON.parse(bruto ?? "[]");
      if (Array.isArray(v)) lista = v.filter((s): s is StatusCampo => typeof s === "string" && ESPERA.includes(s));
    } catch {
      /* valor estragado: nenhuma estreita */
    }
    estreitasEmMemoria = { bruto, lista };
  }
  return estreitasEmMemoria.lista;
}

function gravarEstreitas(lista: StatusCampo[]) {
  const bruto = JSON.stringify(lista);
  estreitasEmMemoria = { bruto, lista };
  try {
    localStorage.setItem(CHAVE_ESTREITAS, bruto);
  } catch {
    /* sem armazenamento: fica só nesta aba */
  }
  ouvintesEstreitas.forEach((f) => f());
}

function assinarEstreitas(f: () => void) {
  ouvintesEstreitas.add(f);
  window.addEventListener("storage", f);
  return () => {
    ouvintesEstreitas.delete(f);
    window.removeEventListener("storage", f);
  };
}

/* ---------- tela ---------- */

const SINAL_CONEXAO: Record<EstadoConexao["tipo"], TipoSinal> = { ao_vivo: "normal", conectando: "neutro", desatualizado: "vencendo" };
const MSG_SEM_REDE = "Sem conexão: a viagem não foi movida. Tente de novo quando a conexão voltar.";

const semChave = (p: Record<string, StatusCampo>, id: string) => {
  const { [id]: _fora, ...resto } = p;
  void _fora;
  return resto;
};

type Props = {
  inicial: DadosQuadro;
  /** Quando os dados de `inicial` foram lidos (ISO). */
  carregadoEm: string;
  /** "Agora" do servidor (ms), para o tempo na coluna sair igual no servidor e no navegador. */
  agoraInicial: number;
  perfil: Pick<Perfil, "userId" | "papel" | "ativo">;
  unidades: { id: number; nome: string }[];
  filtrosIniciais: EstadoFiltros;
  /** Coluna mostrada no celular (`?aba=`). */
  abaInicial?: StatusCampo | null;
  /** Só o teste passa: o padrão é o Supabase do navegador. */
  fonte?: FonteQuadro;
};

export function QuadroCliente({ inicial, carregadoEm, agoraInicial, perfil, unidades, filtrosIniciais, abaInicial = null, fonte: fonteDada }: Props) {
  const [fonte] = useState(() => fonteDada ?? fonteDoNavegador());
  const [dados, setDados] = useState(inicial);
  const [agora, setAgora] = useState(agoraInicial);
  const [conexao, despachar] = useReducer(proximoEstado, { tipo: "conectando" } as EstadoConexao);
  const [filtros, setFiltros] = useState(filtrosIniciais);
  const [aba, setAba] = useState<StatusCampo | null>(abaInicial);
  const [pendentes, setPendentes] = useState<Record<string, StatusCampo>>({});
  const [arrastando, setArrastando] = useState<Cartao | null>(null);
  const [menu, setMenu] = useState<Cartao | null>(null);
  const [resumo, setResumo] = useState<Cartao | null>(null);
  const [passagem, setPassagem] = useState<Passagem | null>(null);
  const [pagando, setPagando] = useState<Cartao | null>(null);
  const estreitas = useSyncExternalStore(assinarEstreitas, lerEstreitas, () => SEM_ESTREITAS);

  const seq = useRef(0);
  const ultimaRecarga = useRef<Promise<void>>(Promise.resolve());
  const ultimaCarga = useRef(new Date(carregadoEm));
  const reconectar = useRef<() => void>(() => {});

  const podeMover = pode(perfil, "editar");
  const podePagar = pode(perfil, "editarFinanceiro");
  const ehAdmin = pode(perfil, "admin");

  /** Lê o quadro de novo. Só a recarga mais recente vale (uma resposta atrasada não apaga outra mais nova).
     A promessa só se cumpre quando a mais recente terminar: quem espera (o mover, que depois tira o cartão
     de "pendente") nunca vê o quadro de antes por ter sido passado para trás por uma recarga do tempo real. */
  const recarregar = useCallback((): Promise<void> => {
    const minha = ++seq.current;
    const lida = (async (): Promise<boolean> => {
      try {
        const d = await fonte.carregar();
        if (minha !== seq.current) return false;
        const em = new Date();
        ultimaCarga.current = em;
        setDados(d);
        setAgora(em.getTime());
        despachar({ tipo: "recarregou", em });
      } catch (e) {
        // Sem rede ou banco fora do ar: o quadro continua com o que tinha; o canal diz se está desatualizado.
        console.error("Falha ao recarregar o Quadro:", e);
      }
      return minha === seq.current;
    })();
    // Passada para trás: espera a mais nova (que foi chamada depois desta, então nunca é esta mesma).
    const pronta = lida.then((valeu) => (valeu ? undefined : ultimaRecarga.current));
    ultimaRecarga.current = pronta;
    return pronta;
  }, [fonte]);

  // Tempo na coluna: "há 2 h 15 min", atualizado a cada minuto.
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Tempo real, foco da janela e rede.
  useEffect(() => {
    let espera: ReturnType<typeof setTimeout> | undefined;
    let parar = () => {};
    const conectar = () => {
      let ativo = true; // respostas atrasadas de um canal já desligado não contam
      const desligar = fonte.assinar({
        mudou: () => {
          if (!ativo) return;
          clearTimeout(espera);
          espera = setTimeout(() => void recarregar(), 300);
        },
        estado: (s) => {
          if (!ativo) return;
          if (s === "inscrito") {
            despachar({ tipo: "inscrito", em: new Date() });
            void recarregar();
          } else despachar({ tipo: s, em: ultimaCarga.current });
        },
      });
      parar = () => {
        ativo = false;
        desligar();
      };
    };
    const assinarDeNovo = () => {
      parar();
      conectar();
    };
    const aoFocar = () => void recarregar();
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "visible") void recarregar();
    };
    const semRede = () => {
      despachar({ tipo: "erro", em: ultimaCarga.current });
      parar();
      parar = () => {};
    };

    conectar();
    reconectar.current = assinarDeNovo;
    window.addEventListener("focus", aoFocar);
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    window.addEventListener("offline", semRede);
    window.addEventListener("online", assinarDeNovo);
    return () => {
      clearTimeout(espera);
      parar();
      reconectar.current = () => {};
      window.removeEventListener("focus", aoFocar);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      window.removeEventListener("offline", semRede);
      window.removeEventListener("online", assinarDeNovo);
    };
  }, [fonte, recarregar]);

  /* ---------- o que aparece ---------- */

  const limites = useMemo(() => new Map<string, Limite>(dados.limites.map((l) => [l.chave, l])), [dados.limites]);
  const cartoes = useMemo(
    () => dados.cartoes.map((c) => (c.viagem_id && pendentes[c.viagem_id] ? { ...c, status_campo: pendentes[c.viagem_id] } : c)),
    [dados.cartoes, pendentes],
  );
  const nivelDe = useCallback((c: Cartao) => nivelDoCartao(c, limites, agora), [limites, agora]);
  const visiveis = useMemo(() => filtrarCartoes(cartoes, paraFiltros(filtros, perfil.userId), nivelDe), [cartoes, filtros, perfil.userId, nivelDe]);
  const grupos = useMemo(() => agruparPorColuna(visiveis), [visiveis]);
  const porNivel = useMemo(() => {
    const n = { normal: 0, ambar: 0, vermelho: 0 };
    for (const c of visiveis) n[nivelDe(c)]++;
    return n;
  }, [visiveis, nivelDe]);
  const clientes = useMemo(() => opcoesDe(dados.cartoes.map((c) => c.cliente_nome)), [dados.cartoes]);
  const motoristas = useMemo(() => opcoesDe(dados.cartoes.map((c) => c.motorista_nome)), [dados.cartoes]);
  const abaAtiva: StatusCampo = aba ?? COLUNAS.find((c) => grupos[c.status].length > 0)?.status ?? "transito";

  const destinosDe = (c: Cartao): StatusCampo[] =>
    c.status_campo ? destinosPermitidos(c.status_campo, c.viagem_id ? dados.origensDaPausa[c.viagem_id] : undefined) : [];

  /* ---------- URL (filtros e aba) ---------- */

  function atualizarUrl(f: EstadoFiltros, a: StatusCampo | null) {
    window.history.replaceState(null, "", `${window.location.pathname}${buscaDe(f, a)}`);
  }
  function mudarFiltros(f: EstadoFiltros) {
    setFiltros(f);
    atualizarUrl(f, aba);
  }
  function escolherAba(id: string) {
    const a = id as StatusCampo;
    setAba(a);
    atualizarUrl(filtros, a);
  }
  function alternarEstreita(s: StatusCampo) {
    gravarEstreitas(estreitas.includes(s) ? estreitas.filter((e) => e !== s) : [...estreitas, s]);
  }

  /* ---------- mover ---------- */

  /** Grava a passagem. Devolve a frase da recusa, ou `null` quando terminou (gravou, ou o quadro estava
     atrasado: aí avisa e recarrega). Enquanto grava, o cartão já aparece na coluna de destino. */
  async function executar(c: Cartao, de: StatusCampo, para: StatusCampo, dadosPassagem: Record<string, unknown>): Promise<string | null> {
    const id = c.viagem_id ?? "";
    setPendentes((p) => ({ ...p, [id]: para }));
    const r = await moverViagem(id, de, para, dadosPassagem).catch(() => ({ ok: false as const, erro: MSG_SEM_REDE }));
    if (!r.ok) {
      setPendentes((p) => semChave(p, id)); // o cartão volta
      if (foiAtualizado(r.erro)) {
        toast(r.erro, "alert-circle");
        await recarregar();
        return null;
      }
      return r.erro;
    }
    toast(`Viagem #${c.numero}: ${rotuloDe(para)}.`, "check");
    await recarregar();
    setPendentes((p) => semChave(p, id));
    return null;
  }

  function escolherDestino(c: Cartao, para: StatusCampo) {
    const de = c.status_campo;
    setMenu(null);
    if (!de) return;
    const formulario = formularioDaPassagem(de, para);
    if (formulario) return setPassagem({ cartao: c, de, para, formulario });
    void executar(c, de, para, {}).then((erro) => {
      if (erro) toast(erro, "alert-circle");
    });
  }

  const enviarCanhoto: EnviarCanhoto = async (viagemId, arquivo) => {
    const r = await enviarCanhotoDoNavegador(viagemId, arquivo);
    return r.ok ? { ok: true } : r;
  };

  async function confirmarPagamento(c: Cartao): Promise<string | null> {
    const r = await confirmarPagamentoSaida(c.viagem_id ?? "").catch(() => ({ ok: false as const, erro: MSG_SEM_REDE }));
    if (!r.ok) {
      void recarregar();
      return r.erro;
    }
    setPagando(null);
    toast("Adiantamento e vale-pedágio confirmados.", "check");
    await recarregar();
    return null;
  }

  const fecharResumo = useCallback(() => setResumo(null), []);

  /* ---------- desenho ---------- */

  const deArrasto = arrastando?.status_campo ?? null;
  const permitidas = arrastando ? destinosDe(arrastando) : [];
  const total = cartoes.length;

  return (
    <>
      <div className="titulo titulo-inicio">
        <div>
          <h1>Quadro da operação</h1>
          <p className="sub">Onde está cada carga, qual está parada e há quanto tempo.</p>
        </div>
          <div className="kpis">
            <span className="kpi">
              <span className="kpi-icone" aria-hidden="true">
                <Route size={18} strokeWidth={1.7} />
              </span>
              <span>
                <b className="kpi-valor">
                  <Numero valor={visiveis.length} />
                </b>
                <span className="kpi-rot">Viagens na tela</span>
              </span>
            </span>
            <span className="kpi">
              <span className="kpi-icone" aria-hidden="true">
                <span className="adv-forma forma-losango" style={{ color: "var(--amarelo)", margin: 0 }} />
              </span>
              <span>
                <b className="kpi-valor">
                  <Numero valor={porNivel.ambar} />
                </b>
                <span className="kpi-rot">Perto do tempo-limite</span>
              </span>
            </span>
            <span className="kpi">
              <span className="kpi-icone" aria-hidden="true">
                <span className="adv-forma forma-circulo" style={{ color: "var(--vermelho)", margin: 0 }} />
              </span>
              <span>
                <b className="kpi-valor">
                  <Numero valor={porNivel.vermelho} />
                </b>
                <span className="kpi-rot">Passaram do tempo-limite</span>
              </span>
            </span>
          </div>
        <div className="acoes quadro-conexao">
          {ehAdmin && <TemposLimite limites={dados.limites} aoSalvar={recarregar} />}
          <p role="status">
            <Sinal tipo={SINAL_CONEXAO[conexao.tipo]} texto={textoConexao(conexao)} />
          </p>
          {conexao.tipo === "desatualizado" && (
            <button className="btn btn-texto" type="button" onClick={() => reconectar.current()}>
              <RotateCw size={16} strokeWidth={1.6} aria-hidden="true" />
              Reconectar
            </button>
          )}
        </div>
      </div>

      <FiltrosQuadro
        filtros={filtros}
        aoMudar={mudarFiltros}
        clientes={clientes}
        motoristas={motoristas}
        unidades={unidades}
        visiveis={visiveis.length}
        total={total}
      />

      {total === 0 && (
        <EstadoVazio style={{ marginBottom: 16 }}>
          Nenhuma viagem no quadro. A viagem entra em “Trânsito” quando é iniciada na ficha (Viagens → Planejadas).
        </EstadoVazio>
      )}

      <div className="quadro-abas">
        <Abas
          rotulo="Colunas do quadro"
          ativa={abaAtiva}
          abas={COLUNAS.map((c) => ({ id: c.status, rotulo: c.rotulo, n: grupos[c.status].length }))}
          hrefDe={(id) => buscaDe(filtros, id as StatusCampo)}
          aoEscolher={escolherAba}
        />
      </div>

      <div className={`quadro${arrastando ? " arrastando" : ""}`}>
        {COLUNAS.map((col) => {
          const lista = grupos[col.status];
          const arraste = !arrastando || deArrasto === col.status ? null : permitidas.includes(col.status) ? "permitida" : "proibida";
          return (
            <Coluna
              key={col.status}
              rotulo={col.rotulo}
              quantidade={lista.length}
              espera={col.espera}
              estreita={estreitas.includes(col.status)}
              aoAlternarEstreita={() => alternarEstreita(col.status)}
              arraste={arraste}
              aoSoltar={() => {
                const c = arrastando;
                setArrastando(null);
                if (c) escolherDestino(c, col.status);
              }}
              ativa={abaAtiva === col.status}
            >
              {lista.length === 0 ? (
                <EstadoVazio>Nenhuma viagem.</EstadoVazio>
              ) : (
                lista.map((c) => {
                  const temPassagem = destinosDe(c).length > 0 || (c.status_campo ? colunaAnterior(c.status_campo) !== null : false);
                  return (
                    <CartaoQuadro
                      key={c.viagem_id}
                      cartao={c}
                      nivel={nivelDe(c)}
                      agora={agora}
                      podeMover={podeMover && temPassagem}
                      podePagar={podePagar && c.status_campo === "aguardando_nf_pagamento" && !c.pagamento_saida}
                      movendo={Boolean(c.viagem_id && pendentes[c.viagem_id])}
                      aoMover={() => setMenu(c)}
                      aoPagar={() => setPagando(c)}
                      aoArrastar={(sim) => setArrastando(sim ? c : null)}
                      aoAbrir={() => setResumo(c)}
                    />
                  );
                })
              )}
            </Coluna>
          );
        })}
      </div>

      <AnimatePresence>
        {resumo && (
          <FichaRapida
            key={resumo.viagem_id}
            cartao={cartoes.find((x) => x.viagem_id === resumo.viagem_id) ?? resumo}
            nivel={nivelDe(cartoes.find((x) => x.viagem_id === resumo.viagem_id) ?? resumo)}
            agora={agora}
            podeMover={podeMover && (destinosDe(resumo).length > 0 || (resumo.status_campo ? colunaAnterior(resumo.status_campo) !== null : false))}
            aoFechar={fecharResumo}
            aoMover={() => {
              const c = resumo;
              setResumo(null);
              setMenu(c);
            }}
          />
        )}
      </AnimatePresence>
      {menu?.status_campo && (
        <MenuMover
          cartao={menu}
          de={menu.status_campo}
          destinos={destinosDe(menu)}
          anterior={colunaAnterior(menu.status_campo)}
          aoEscolher={(para) => escolherDestino(menu, para)}
          aoFechar={() => setMenu(null)}
        />
      )}
      {passagem && (
        <DialogoPassagem
          key={`${passagem.cartao.viagem_id}-${passagem.para}`}
          passagem={passagem}
          enviarCanhoto={enviarCanhoto}
          executar={async (para, d) => {
            const erro = await executar(passagem.cartao, passagem.de, para, d);
            if (erro === null) setPassagem(null);
            return erro;
          }}
          aoFechar={() => setPassagem(null)}
        />
      )}
      {pagando && <DialogoPagamento cartao={pagando} confirmar={() => confirmarPagamento(pagando)} aoFechar={() => setPagando(null)} />}
    </>
  );
}
