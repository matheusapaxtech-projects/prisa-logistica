import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Cartao } from "@/lib/quadro";

/* Tela do Quadro (Task 10): colunas, cor do cartão, "Mover" (alternativa sem arrastar), permissões,
   recusa do banco por quadro atrasado e o texto da conexão. A ação de mover, o envio do canhoto e o
   tempo real são trocados por falsos; o cliente do Supabase do navegador nunca é criado aqui. */

const moverViagem = vi.fn();
const enviarCanhotoDoNavegador = vi.fn();
const salvarLimites = vi.fn();
vi.mock("@/app/(app)/quadro/actions", () => ({
  moverViagem: (...a: unknown[]) => moverViagem(...a),
  salvarLimites: (...a: unknown[]) => salvarLimites(...a),
}));
vi.mock("@/app/(app)/viagens/actions", () => ({ confirmarPagamentoSaida: vi.fn(async () => ({ ok: true, dados: undefined })) }));
vi.mock("@/app/(app)/viagens/envio", () => ({ enviarCanhotoDoNavegador: (...a: unknown[]) => enviarCanhotoDoNavegador(...a) }));
vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: () => {
    throw new Error("o teste não usa o Supabase do navegador");
  },
}));

import { QuadroCliente, type FonteQuadro, type OuvinteQuadro } from "@/app/(app)/quadro/quadro-cliente";
import type { DadosQuadro } from "@/app/(app)/quadro/consultas";
import { Toaster } from "@/components/Toast";

beforeAll(() => {
  // jsdom não abre <dialog> modal: o suficiente para o <Dialogo> funcionar no teste.
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & { showModal: () => void; close: () => void };
  if (!proto.showModal || !String(proto.showModal).includes("open")) {
    proto.showModal = function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    proto.close = function (this: HTMLDialogElement) {
      if (!this.hasAttribute("open")) return;
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  }
});

beforeEach(() => {
  moverViagem.mockReset();
  enviarCanhotoDoNavegador.mockReset();
  salvarLimites.mockReset();
  try {
    localStorage.clear();
  } catch {
    /* sem armazenamento */
  }
});
afterEach(cleanup);

/** 14:32 em Brasília (17:32 UTC). */
const AGORA = Date.parse("2026-10-23T17:32:00Z");
const minutosAtras = (m: number) => new Date(AGORA - m * 60000).toISOString();

let seq = 0;
function cartao(extra: Partial<Cartao> = {}): Cartao {
  seq += 1;
  return {
    viagem_id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    numero: 100 + seq,
    status_campo: "transito",
    status_desde: minutosAtras(10),
    cavalo_placa: `TST${String(seq % 10000).padStart(4, "0")}`,
    motorista_nome: "Cláudio",
    cliente_nome: "Cliente Fictício",
    origem_cidade: "Apucarana",
    origem_uf: "PR",
    destino_cidade: "Santos",
    destino_uf: "SP",
    unidade_operacional_id: 1,
    iniciada_por: "u-operacao",
    pausa_tipo: null,
    pausa_programada: null,
    pausa_inicio: null,
    tem_chaves: false,
    pagamento_saida: false,
    tem_canhoto: false,
    divergencia: null,
    ocorrencias_abertas: 0,
    ...extra,
  };
}

const LIMITES = [
  { chave: "aguardando_carregamento", minutos_ambar: 120, minutos_vermelho: 240 },
  { chave: "pausa_nao_programada", minutos_ambar: 30, minutos_vermelho: 60 },
];

function fonteFalsa(dados?: DadosQuadro) {
  let ouvinte: OuvinteQuadro | null = null;
  const fonte: FonteQuadro & { carregar: ReturnType<typeof vi.fn> } = {
    carregar: vi.fn(async () => dados ?? { cartoes: [], limites: LIMITES, origensDaPausa: {} }),
    assinar: (o) => {
      ouvinte = o;
      return () => {
        ouvinte = null;
      };
    },
  };
  return { fonte, ouvinte: () => ouvinte };
}

type Papel = "admin" | "operacao" | "financeiro" | "leitura";

function montar(cartoes: Cartao[], opcoes: { papel?: Papel; fonte?: FonteQuadro; limites?: DadosQuadro["limites"] } = {}) {
  const inicial: DadosQuadro = { cartoes, limites: opcoes.limites ?? LIMITES, origensDaPausa: {} };
  const fonte = opcoes.fonte ?? fonteFalsa(inicial).fonte;
  return render(
    <>
      <QuadroCliente
        inicial={inicial}
        carregadoEm={new Date(AGORA).toISOString()}
        agoraInicial={AGORA}
        perfil={{ userId: "u-operacao", papel: opcoes.papel ?? "operacao", ativo: true }}
        unidades={[{ id: 1, nome: "Terceirização" }]}
        filtrosIniciais={{ problema: false, minhas: false }}
        fonte={fonte}
      />
      <Toaster />
    </>,
  );
}

const ROTULOS = [
  "Trânsito",
  "Aguardando carregamento",
  "Em carregamento",
  "Aguardando NF e pagamento",
  "Em rota",
  "Pausa",
  "Aguardando descarga",
  "Aguardando contagem de divergência",
  "Resolução de divergência na carga",
  "Frete finalizado",
];

describe("Quadro da operação: tela", () => {
  it("renderiza as 10 colunas com os rótulos exatos, na ordem, e o contador de cada uma", () => {
    montar([cartao({ status_campo: "em_rota" }), cartao({ status_campo: "em_rota" }), cartao({ status_campo: "transito" })]);
    const colunas = screen.getAllByRole("region");
    expect(colunas.map((c) => within(c).getByRole("heading", { level: 2 }).textContent)).toEqual(ROTULOS);
    const contador = (rotulo: string) => within(screen.getByRole("region", { name: rotulo })).getByTestId("contador").textContent;
    expect(contador("Em rota")).toBe("2");
    expect(contador("Trânsito")).toBe("1");
    expect(contador("Pausa")).toBe("0");
  });

  it("cartão fica vermelho quando status_desde passou do limite vermelho da coluna", () => {
    montar([
      cartao({ numero: 501, status_campo: "aguardando_carregamento", status_desde: minutosAtras(5 * 60) }),
      cartao({ numero: 502, status_campo: "aguardando_carregamento", status_desde: minutosAtras(150) }),
      cartao({ numero: 503, status_campo: "aguardando_carregamento", status_desde: minutosAtras(20) }),
    ]);
    const cartaoDe = (n: number) => screen.getByRole("article", { name: new RegExp(`Viagem #${n}\\b`) });
    expect(cartaoDe(501)).toHaveAttribute("data-nivel", "vermelho");
    expect(cartaoDe(501)).toHaveTextContent("há 5 h");
    expect(cartaoDe(502)).toHaveAttribute("data-nivel", "ambar");
    expect(cartaoDe(503)).toHaveAttribute("data-nivel", "normal");
  });

  it("“Mover” de um cartão em Em rota lista só Pausa e Aguardando descarga", () => {
    montar([cartao({ numero: 77, status_campo: "em_rota" })]);
    fireEvent.click(screen.getByRole("button", { name: "Mover a viagem #77" }));
    const dlg = screen.getByRole("dialog", { name: /Mover a viagem #77/ });
    const destinos = within(within(dlg).getByRole("list", { name: "Destinos" })).getAllByRole("button");
    expect(destinos.map((b) => b.textContent)).toEqual(["Pausa", "Aguardando descarga"]);
    expect(within(dlg).queryByRole("button", { name: /Voltar para/ })).toBeNull();
  });

  it("“Mover” de Aguardando carregamento oferece “Voltar para Trânsito”, que pede o motivo", async () => {
    moverViagem.mockResolvedValue({ ok: true, dados: undefined });
    montar([cartao({ numero: 78, status_campo: "aguardando_carregamento" })]);
    fireEvent.click(screen.getByRole("button", { name: "Mover a viagem #78" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar para Trânsito" }));
    const dlg = screen.getByRole("dialog", { name: /Voltar a viagem #78/ });
    fireEvent.click(within(dlg).getByRole("button", { name: "Voltar a viagem" }));
    expect(within(dlg).getByRole("alert")).toHaveTextContent("Informe o motivo");
    expect(moverViagem).not.toHaveBeenCalled();
    fireEvent.change(within(dlg).getByLabelText("Motivo"), { target: { value: "cliquei errado" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Voltar a viagem" }));
    await waitFor(() => expect(moverViagem).toHaveBeenCalledTimes(1));
    expect(moverViagem.mock.calls[0].slice(1)).toEqual(["aguardando_carregamento", "transito", { motivo: "cliquei errado" }]);
  });

  it("perfil leitura vê o quadro mas não vê “Mover” nem arrasta", () => {
    montar([cartao({ numero: 79, status_campo: "em_rota" })], { papel: "leitura" });
    expect(screen.getByRole("article", { name: /Viagem #79/ })).toHaveAttribute("draggable", "false");
    expect(screen.queryByRole("button", { name: /Mover/ })).toBeNull();
  });

  it("financeiro não move, mas vê “Confirmar pagamento de saída” em Aguardando NF e pagamento", () => {
    montar([cartao({ numero: 80, status_campo: "aguardando_nf_pagamento" })], { papel: "financeiro" });
    expect(screen.queryByRole("button", { name: /Mover/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Confirmar pagamento de saída/ })).toBeInTheDocument();
  });

  it("recarrega quando o banco recusa por origem desatualizada", async () => {
    const recusa = 'a viagem já está em "Pausa"; o quadro foi atualizado';
    moverViagem.mockResolvedValue({ ok: false, erro: recusa });
    const { fonte } = fonteFalsa();
    montar([cartao({ numero: 81, status_campo: "em_rota" })], { fonte });
    fireEvent.click(screen.getByRole("button", { name: "Mover a viagem #81" }));
    fireEvent.click(screen.getByRole("button", { name: "Aguardando descarga" }));
    await waitFor(() => expect(fonte.carregar).toHaveBeenCalledTimes(1));
    expect(moverViagem).toHaveBeenCalledTimes(1);
    expect(moverViagem.mock.calls[0].slice(1)).toEqual(["em_rota", "aguardando_descarga", {}]);
    expect(await screen.findByText(recusa)).toBeInTheDocument();
    // o cartão some do quadro antigo quando a recarga chega (a fonte falsa devolve o quadro vazio)
    await waitFor(() => expect(screen.queryByRole("article", { name: /Viagem #81/ })).toBeNull());
  });

  it("recusa comum não recarrega: o cartão volta para a coluna e a mensagem aparece", async () => {
    moverViagem.mockResolvedValue({ ok: false, erro: "falta o canhoto" });
    const { fonte } = fonteFalsa();
    montar([cartao({ numero: 82, status_campo: "em_rota" })], { fonte });
    fireEvent.click(screen.getByRole("button", { name: "Mover a viagem #82" }));
    fireEvent.click(screen.getByRole("button", { name: "Aguardando descarga" }));
    expect(await screen.findByText("falta o canhoto")).toBeInTheDocument();
    expect(fonte.carregar).not.toHaveBeenCalled();
    expect(within(screen.getByRole("region", { name: "Em rota" })).getByRole("article", { name: /Viagem #82/ })).toBeInTheDocument();
  });

  it("peso de saída digitado em pt-BR vai ao banco como número", async () => {
    moverViagem.mockResolvedValue({ ok: true, dados: undefined });
    montar([cartao({ numero: 83, status_campo: "em_carregamento" })]);
    fireEvent.click(screen.getByRole("button", { name: "Mover a viagem #83" }));
    fireEvent.click(screen.getByRole("button", { name: "Aguardando NF e pagamento" }));
    const dlg = screen.getByRole("dialog", { name: /Peso de saída/ });
    fireEvent.change(within(dlg).getByLabelText(/Peso de saída/), { target: { value: "37.000,5" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Mover" }));
    await waitFor(() => expect(moverViagem).toHaveBeenCalledTimes(1));
    expect(moverViagem.mock.calls[0][3]).toEqual({ peso_saida_kg: 37000.5 });
  });

  it("pausa manda o tipo e “programada” como booleano", async () => {
    moverViagem.mockResolvedValue({ ok: true, dados: undefined });
    montar([cartao({ numero: 84, status_campo: "em_rota" })]);
    fireEvent.click(screen.getByRole("button", { name: "Mover a viagem #84" }));
    fireEvent.click(screen.getByRole("button", { name: "Pausa" }));
    const dlg = screen.getByRole("dialog", { name: /Pausa/ });
    fireEvent.change(within(dlg).getByLabelText("Tipo da pausa"), { target: { value: "almoco" } });
    fireEvent.click(within(dlg).getByLabelText("Não programada"));
    fireEvent.click(within(dlg).getByRole("button", { name: "Mover" }));
    await waitFor(() => expect(moverViagem).toHaveBeenCalledTimes(1));
    expect(moverViagem.mock.calls[0][3]).toEqual({ pausa_tipo: "almoco", pausa_programada: false });
  });

  it("chegada: envia o canhoto antes de mover e manda o peso de chegada como número", async () => {
    const ordem: string[] = [];
    enviarCanhotoDoNavegador.mockImplementation(async () => {
      ordem.push("canhoto");
      return { ok: true, dados: "viagem/x/y-canhoto.pdf" };
    });
    moverViagem.mockImplementation(async () => {
      ordem.push("mover");
      return { ok: true, dados: undefined };
    });
    montar([cartao({ numero: 85, status_campo: "aguardando_descarga" })]);
    fireEvent.click(screen.getByRole("button", { name: "Mover a viagem #85" }));
    fireEvent.click(screen.getByRole("button", { name: "Aguardando contagem de divergência" }));
    const dlg = screen.getByRole("dialog", { name: /Chegada/ });
    fireEvent.change(within(dlg).getByLabelText(/Peso de chegada/), { target: { value: "36.950" } });
    const arquivo = new File(["%PDF"], "canhoto.pdf", { type: "application/pdf" });
    fireEvent.change(within(dlg).getByLabelText(/Canhoto/), { target: { files: [arquivo] } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Mover" }));
    await waitFor(() => expect(moverViagem).toHaveBeenCalledTimes(1));
    expect(ordem).toEqual(["canhoto", "mover"]);
    expect(enviarCanhotoDoNavegador.mock.calls[0][1]).toBe(arquivo);
    expect(moverViagem.mock.calls[0][3]).toEqual({ peso_chegada_kg: 36950 });
  });

  it("chaves erradas não chegam ao banco: o diálogo diz qual chave", async () => {
    montar([cartao({ numero: 86, status_campo: "aguardando_nf_pagamento", pagamento_saida: true })]);
    fireEvent.click(screen.getByRole("button", { name: "Mover a viagem #86" }));
    fireEvent.click(screen.getByRole("button", { name: "Em rota" }));
    const dlg = screen.getByRole("dialog", { name: /CT-e e MDF-e/ });
    fireEvent.change(within(dlg).getByLabelText("Chave do CT-e"), { target: { value: "1234" } });
    fireEvent.change(within(dlg).getByLabelText("Chave do MDF-e"), { target: { value: "5678" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Mover" }));
    expect(await within(dlg).findByText(/Chave do CT-e inválida/)).toBeInTheDocument();
    expect(moverViagem).not.toHaveBeenCalled();
  });

  it("texto “Desatualizado desde 14:32” quando o canal reporta erro; volta a “Ao vivo” depois de inscrito e recarregado", async () => {
    const f = fonteFalsa();
    montar([cartao()], { fonte: f.fonte });
    expect(screen.getByRole("status")).toHaveTextContent("Conectando…");
    act(() => f.ouvinte()!.estado("erro"));
    expect(screen.getByRole("status")).toHaveTextContent("Desatualizado desde 14:32");
    await act(async () => f.ouvinte()!.estado("inscrito"));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Ao vivo"));
    expect(f.fonte.carregar).toHaveBeenCalledTimes(1);
  });

  describe("Tempos-limite (só administrador)", () => {
    const TODOS = [
      { chave: "aguardando_carregamento", minutos_ambar: 120, minutos_vermelho: 240 },
      { chave: "em_carregamento", minutos_ambar: 60, minutos_vermelho: 120 },
      { chave: "aguardando_nf_pagamento", minutos_ambar: 60, minutos_vermelho: 120 },
      { chave: "aguardando_descarga", minutos_ambar: 120, minutos_vermelho: 240 },
      { chave: "aguardando_contagem", minutos_ambar: 60, minutos_vermelho: 120 },
      { chave: "resolucao_divergencia", minutos_ambar: 240, minutos_vermelho: 480 },
      { chave: "pausa_programada", minutos_ambar: 480, minutos_vermelho: 720 },
      { chave: "pausa_nao_programada", minutos_ambar: 30, minutos_vermelho: 60 },
    ];

    it("operação, financeiro e leitura não veem o botão “Tempos-limite”", () => {
      for (const papel of ["operacao", "financeiro", "leitura"] as const) {
        const { unmount } = montar([cartao()], { papel, limites: TODOS });
        expect(screen.queryByRole("button", { name: "Tempos-limite" })).toBeNull();
        unmount();
      }
    });

    it("administrador abre o diálogo com uma linha por chave, pausa em duas linhas", () => {
      montar([cartao()], { papel: "admin", limites: TODOS });
      fireEvent.click(screen.getByRole("button", { name: "Tempos-limite" }));
      const dlg = screen.getByRole("dialog", { name: "Tempos-limite" });
      const linhas = within(dlg).getAllByRole("row").slice(1);
      expect(linhas.map((l) => within(l).getByRole("rowheader").textContent)).toEqual([
        "Aguardando carregamento",
        "Em carregamento",
        "Aguardando NF e pagamento",
        "Pausa programada",
        "Pausa não programada",
        "Aguardando descarga",
        "Aguardando contagem de divergência",
        "Resolução de divergência na carga",
      ]);
      expect(within(dlg).getByLabelText("Aguardando carregamento: âmbar")).toHaveValue("120");
      expect(within(dlg).getByLabelText("Pausa não programada: vermelho")).toHaveValue("60");
    });

    it("vermelho menor ou igual ao âmbar é recusado na tela, sem chamar o servidor", () => {
      montar([cartao()], { papel: "admin", limites: TODOS });
      fireEvent.click(screen.getByRole("button", { name: "Tempos-limite" }));
      const dlg = screen.getByRole("dialog", { name: "Tempos-limite" });
      fireEvent.change(within(dlg).getByLabelText("Em carregamento: vermelho"), { target: { value: "60" } });
      fireEvent.click(within(dlg).getByRole("button", { name: "Salvar" }));
      expect(within(dlg).getByText("O vermelho precisa ser maior que o âmbar.")).toBeInTheDocument();
      expect(salvarLimites).not.toHaveBeenCalled();
    });

    it("salva com os minutos digitados e recarrega o quadro", async () => {
      salvarLimites.mockResolvedValue({ ok: true, dados: undefined });
      const { fonte } = fonteFalsa();
      montar([cartao()], { papel: "admin", limites: TODOS, fonte });
      fireEvent.click(screen.getByRole("button", { name: "Tempos-limite" }));
      const dlg = screen.getByRole("dialog", { name: "Tempos-limite" });
      fireEvent.change(within(dlg).getByLabelText("Aguardando carregamento: âmbar"), { target: { value: "90" } });
      fireEvent.change(within(dlg).getByLabelText("Aguardando carregamento: vermelho"), { target: { value: "180" } });
      fireEvent.click(within(dlg).getByRole("button", { name: "Salvar" }));
      await waitFor(() => expect(salvarLimites).toHaveBeenCalledTimes(1));
      const form = salvarLimites.mock.calls[0][1] as FormData;
      expect(form.get("ambar_aguardando_carregamento")).toBe("90");
      expect(form.get("vermelho_aguardando_carregamento")).toBe("180");
      expect(form.get("vermelho_pausa_nao_programada")).toBe("60");
      await waitFor(() => expect(fonte.carregar).toHaveBeenCalled());
    });

    it("recusa do servidor aparece no diálogo, que continua aberto", async () => {
      salvarLimites.mockResolvedValue({ ok: false, erro: "Só o administrador pode fazer isso." });
      montar([cartao()], { papel: "admin", limites: TODOS });
      fireEvent.click(screen.getByRole("button", { name: "Tempos-limite" }));
      const dlg = screen.getByRole("dialog", { name: "Tempos-limite" });
      fireEvent.click(within(dlg).getByRole("button", { name: "Salvar" }));
      expect(await within(dlg).findByRole("alert")).toHaveTextContent("Só o administrador pode fazer isso.");
    });
  });
});
