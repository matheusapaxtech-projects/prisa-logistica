import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ErroInicio from "@/app/(app)/(inicio)/error";
import CarregandoInicio from "@/app/(app)/(inicio)/loading";
import type { Banco } from "@/lib/banco";
import type { Cartao } from "@/lib/quadro";

const operacaoDoTeste = { pedidosAPlanejar: 3, planejadasAptas: 2, planejadasComTrava: 0, cartoesVermelhos: 1, pausasNaoProgramadas: 1 };

vi.mock("@/lib/permissoes", async (original) => ({
  ...(await original<typeof import("@/lib/permissoes")>()),
  getPerfil: vi.fn(async () => ({ userId: "u1", nome: "Operação", papel: "operacao", ativo: true })),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock("@/app/(app)/(inicio)/consultas", async (original) => ({
  ...(await original<typeof import("@/app/(app)/(inicio)/consultas")>()),
  carregarInicio: vi.fn(async () => ({
    placas: { vencidos: 0, arrendadoSemContrato: 0, acimaCmt: 0, semCnh: 0, semComprovante: 0 },
    vencimentos: [],
    cadastros: {
      motoristas: { total: 0, normal: 0, pendente: 0, cancelado: 0 },
      proprietarios: { total: 0, pf: 0, pj: 0 },
      veiculos: { total: 0, cavalo: 0, carreta: 0, dolly: 0, caminhao: 0, arrendados: 0 },
      conjuntos: { total: 0, comMaisDeUmaCarreta: 0, acimaCmt: 0 },
      documentos: { total: 0, conferidos: 0, restritos: 0 },
    },
    conjuntos: [],
  })),
  resumoOperacao: vi.fn(async () => operacaoDoTeste),
  carregarPainel: vi.fn(async () => ({
    quadro: { cartoes: [], limites: [], origensDaPausa: {} },
    meses: Array.from({ length: 12 }, (_, i) => ({ mes: `2026-${String(i + 1).padStart(2, "0")}`, rotulo: `m${i + 1}`, toneladas: i * 10 })),
  })),
}));

import Inicio from "@/app/(app)/(inicio)/page";

afterEach(cleanup);

describe("Início: estados", () => {
  it("carregando mantém a grade e as 10 placas da tela pronta", () => {
    const { container } = render(<CarregandoInicio />);
    expect(screen.getByRole("heading", { level: 1, name: "Início" })).toBeInTheDocument();
    // Operação (5 placas) + Pendências (5 placas); 5 blocos com Vencimentos, Cadastros e Conjuntos.
    expect(container.querySelectorAll(".advertencia")).toHaveLength(10);
    expect(container.querySelectorAll(".bloco")).toHaveLength(5);
    expect(container.querySelectorAll(".marco-conjunto").length).toBeGreaterThan(0);
  });

  it("erro mostra a frase e 'Tentar de novo' refaz a busca", () => {
    const retry = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErroInicio error={new Error("x")} retry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Não conseguimos buscar as pendências agora");
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

/* ---------- resumoOperacao (conta com o cliente do Supabase trocado por um falso) ---------- */

/** 14:32 em Brasília. */
const AGORA = Date.parse("2026-10-23T17:32:00Z");
const atras = (min: number) => new Date(AGORA - min * 60000).toISOString();

function cartao(extra: Partial<Cartao>): Cartao {
  return { viagem_id: "v", numero: 1, status_campo: "transito", status_desde: atras(1), pausa_programada: null, divergencia: null, ocorrencias_abertas: 0, ...extra } as Cartao;
}

/** Cada `from(tabela)` devolve uma consulta encadeável que, ao ser esperada, entrega a resposta da tabela. */
function bancoFalso(respostas: Record<string, { data?: unknown; count?: number; error?: unknown }>) {
  const chamadas: { tabela: string; metodo: string; args: unknown[] }[] = [];
  const from = (tabela: string) => {
    const r = respostas[tabela] ?? { data: [] };
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "gt", "is", "order", "neq", "abortSignal"]) {
      q[m] = (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: m, args });
        return q;
      };
    }
    q.then = (ok: (v: unknown) => unknown, falha: (e: unknown) => unknown) =>
      Promise.resolve({ data: r.data ?? null, count: r.count ?? null, error: r.error ?? null }).then(ok, falha);
    return q;
  };
  return { banco: { from } as unknown as Banco, chamadas };
}

const LIMITES = [
  { chave: "aguardando_carregamento", minutos_ambar: 120, minutos_vermelho: 240 },
  { chave: "pausa_nao_programada", minutos_ambar: 30, minutos_vermelho: 60 },
];

describe("resumoOperacao", () => {
  it("conta as filas: dois cartões no vermelho, uma pausa não programada, aptas e com trava", async () => {
    const { resumoOperacao } = await vi.importActual<typeof import("@/app/(app)/(inicio)/consultas")>("@/app/(app)/(inicio)/consultas");
    const { banco, chamadas } = bancoFalso({
      v_pedido_saldo: { count: 4 },
      v_viagem_planejada: { data: [{ travas: 0 }, { travas: 0 }, { travas: 2 }, { travas: null }] },
      v_quadro: {
        data: [
          cartao({ status_campo: "aguardando_carregamento", status_desde: atras(300) }), // vermelho
          cartao({ status_campo: "pausa", pausa_programada: false, status_desde: atras(90) }), // vermelho, não programada
          cartao({ status_campo: "aguardando_carregamento", status_desde: atras(150) }), // âmbar
          cartao({ status_campo: "pausa", pausa_programada: true, status_desde: atras(500) }), // sem limite
          cartao({ status_campo: "em_rota", status_desde: atras(1000) }), // sem limite
        ],
      },
      quadro_limite: { data: LIMITES },
      viagem_pausa: { data: [] },
    });
    const r = await resumoOperacao(banco, AGORA);
    expect(r).toEqual({ pedidosAPlanejar: 4, planejadasAptas: 3, planejadasComTrava: 1, cartoesVermelhos: 2, pausasNaoProgramadas: 1 });
    // pedido a planejar = aberto com saldo a carregar (a mesma regra da aba da lista)
    const pedidos = chamadas.filter((c) => c.tabela === "v_pedido_saldo");
    expect(pedidos.some((c) => c.metodo === "eq" && c.args[0] === "situacao" && c.args[1] === "aberto")).toBe(true);
    expect(pedidos.some((c) => c.metodo === "gt" && c.args[0] === "saldo_kg" && c.args[1] === 0)).toBe(true);
    // as consultas do quadro (carregarQuadro) têm tempo máximo: uma consulta pendurada vira erro
    for (const t of ["v_quadro", "quadro_limite", "viagem_pausa"])
      expect(chamadas.some((c) => c.tabela === t && c.metodo === "abortSignal" && c.args[0] instanceof AbortSignal)).toBe(true);
  });

  it("erro de banco sobe (a tela mostra o error boundary)", async () => {
    const { resumoOperacao } = await vi.importActual<typeof import("@/app/(app)/(inicio)/consultas")>("@/app/(app)/(inicio)/consultas");
    const { banco } = bancoFalso({ v_pedido_saldo: { error: new Error("falhou") } });
    await expect(resumoOperacao(banco, AGORA)).rejects.toThrow("falhou");
  });
});

describe("Início: bloco Operação", () => {
  it("mostra 'Pedidos a planejar' com o número e o link para a aba", async () => {
    render(await Inicio());
    expect(screen.getByRole("heading", { level: 2, name: "Operação" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "3 Pedidos a planejar" })).toHaveAttribute("href", "/pedidos?aba=a_planejar");
    expect(screen.getByRole("link", { name: "2 Planejadas aptas" })).toHaveAttribute("href", "/viagens?aba=planejadas");
    expect(screen.getByRole("link", { name: "0 Planejadas com trava" })).toHaveAttribute("href", "/viagens?aba=planejadas&trava=1");
    expect(screen.getByRole("link", { name: "1 Cartões no vermelho" })).toHaveAttribute("href", "/quadro?problema=1");
    expect(screen.getByRole("link", { name: "1 Pausas não programadas" })).toHaveAttribute("href", "/quadro?problema=1");
  });

  it("valor zero aparece apagado, como as placas de pendências, e o bloco vem antes das pendências", async () => {
    const { container } = render(await Inicio());
    expect(screen.getByRole("link", { name: "0 Planejadas com trava" }).querySelector(".vazio")).not.toBeNull();
    expect(screen.getByRole("link", { name: "3 Pedidos a planejar" }).querySelector(".vazio")).toBeNull();
    expect(container.querySelectorAll("#operacao .advertencia")).toHaveLength(5);
    const titulos = [...container.querySelectorAll(".bloco-cab h2")].map((h) => h.textContent);
    expect(titulos.indexOf("Operação")).toBeLessThan(titulos.indexOf("Pendências"));
  });
});
