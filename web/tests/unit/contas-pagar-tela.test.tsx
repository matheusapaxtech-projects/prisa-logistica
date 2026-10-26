import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hojeISO } from "@/lib/datas";

/* Tela de contas a pagar (Task 6): o que cada linha oferece conforme quem está logado, o agrupamento com subtotal, o
   total sem as canceladas, o diálogo de uma conta gerada pelo NILT (campos travados) e o de pagamento (data no futuro
   não vai ao banco). As ações do servidor são trocadas por falsos. */

const aprovar = vi.fn();
const pagar = vi.fn();
const editarConta = vi.fn();
vi.mock("@/app/(app)/financeiro/pagar/actions", () => ({
  aprovar: (...a: unknown[]) => aprovar(...a),
  desaprovar: vi.fn(),
  desfazerPagamento: vi.fn(),
  pagar: (...a: unknown[]) => pagar(...a),
  editarConta: (...a: unknown[]) => editarConta(...a),
  lancarConta: vi.fn(),
  cancelar: vi.fn(),
  liberarAntecipacao: vi.fn(),
  lancarTaxaCartao: vi.fn(),
}));

import { TabelaPagar } from "@/app/(app)/financeiro/pagar/tabela-pagar";
import { DialogoPagar } from "@/app/(app)/financeiro/pagar/dialogo-pagar";
import type { ContaPagar } from "@/app/(app)/financeiro/pagar/consultas";
import { Toaster } from "@/components/Toast";

beforeAll(() => {
  // jsdom não tem o popover do navegador (o menu da linha usa hidePopover ao escolher um item).
  (HTMLElement.prototype as { hidePopover?: () => void }).hidePopover ??= () => {};
  // jsdom não abre <dialog> modal: o suficiente para o <Dialogo> funcionar no teste.
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & { showModal: () => void; close: () => void };
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  proto.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
afterAll(() => vi.restoreAllMocks());
beforeEach(() => {
  aprovar.mockReset();
  pagar.mockReset();
  editarConta.mockReset();
});
afterEach(cleanup);

const HOJE = hojeISO();
const BANCO = "00000000-0000-4000-8000-000000000902";
const EU = "u-eu";

function conta(c: Partial<ContaPagar> = {}): ContaPagar {
  return {
    id: "c1",
    numero: 1,
    origem: "manual",
    descricao: "Troca de pneus",
    favorecidoNome: "Borracharia Fictícia",
    planoId: 1,
    planoNome: "Pneus",
    planoGrupo: "despesa_operacional",
    centroId: 1,
    centroCodigo: "03.08",
    centroNome: "Manutenção",
    forma: "pix",
    vencimento: "2999-01-01",
    valor: 100,
    observacao: null,
    viagemId: null,
    viagemNumero: null,
    lancadoPor: "u-outro",
    editadoPor: null,
    aprovadoPor: null,
    aprovadoEm: null,
    pagoEm: null,
    pagoPor: null,
    antecipacaoLiberadaEm: null,
    antecipacaoMotivo: null,
    canceladoEm: null,
    cancelamentoMotivo: null,
    lancadoPorNome: "Ana",
    aprovadoPorNome: null,
    pagoPorNome: null,
    ...c,
  };
}

function tabela(contas: ContaPagar[], extra: Partial<React.ComponentProps<typeof TabelaPagar>> = {}) {
  return render(
    <>
      <TabelaPagar
        contas={contas}
        agrupar="nenhum"
        hoje={HOJE}
        usuario={{ userId: EU, admin: false }}
        contasBancarias={[{ id: BANCO, banco: "341", agencia: "1234", numero: "5678", apelido: "Conta movimento (fictícia)" }]}
        tipos={[{ id: 1, grupo: "despesa_operacional", nome: "Pneus" }]}
        centros={[{ id: 1, codigo: "03.08", nome: "Manutenção" }]}
        vazio="Nenhuma conta."
        {...extra}
      />
      <Toaster />
    </>,
  );
}

describe("linha da conta a pagar", () => {
  it("falta aprovar: outra pessoa lançou, então o botão Aprovar aparece e chama o banco", async () => {
    aprovar.mockResolvedValue({ ok: true, dados: undefined });
    tabela([conta()]);
    expect(screen.getByText("Falta aprovar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    await waitFor(() => expect(aprovar).toHaveBeenCalledWith("c1"));
    expect(await screen.findByText("Conta aprovada.")).toBeInTheDocument();
  });

  it("mostra o motivo do banco quando recusa a aprovação", async () => {
    aprovar.mockResolvedValue({ ok: false, erro: "Você alterou esta conta: outra pessoa precisa aprová-la." });
    tabela([conta()]);
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    expect(await screen.findByText("Você alterou esta conta: outra pessoa precisa aprová-la.")).toBeInTheDocument();
  });

  it("quem lançou a conta não vê Aprovar: vê a dica 'Outra pessoa aprova'", () => {
    tabela([conta({ lancadoPor: EU })]);
    expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
    expect(screen.getByText("Outra pessoa aprova")).toBeInTheDocument();
  });

  it("aprovada: aparece Pagar e some Aprovar; quem aprovou vê 'aprovada por'", () => {
    tabela([conta({ aprovadoEm: "2026-10-20T10:00:00Z", aprovadoPor: "u-x", aprovadoPorNome: "Bia" })]);
    expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pagar" })).toBeInTheDocument();
    expect(screen.getByText(/aprovada por Bia/)).toBeInTheDocument();
    expect(screen.getByText("Aprovada")).toBeInTheDocument();
  });

  it("vencida mostra o sinal de bloqueio com os dias; vencendo em até 7 dias mostra o de advertência", () => {
    tabela([
      conta({ id: "a", vencimento: "2000-01-01" }),
      conta({ id: "b", vencimento: HOJE }),
    ]);
    expect(document.querySelectorAll(".sinal-bloqueado")).toHaveLength(1);
    expect(screen.getByText("vence hoje")).toHaveClass("sinal-vencendo");
  });

  it("paga: mostra quando e por quem, sem ação de aprovar nem pagar", () => {
    tabela([conta({ aprovadoEm: "2026-10-20T10:00:00Z", pagoEm: "2026-10-25", pagoPorNome: "Caio" })]);
    expect(screen.getByText(/Paga em 25\/10 por Caio/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pagar" })).not.toBeInTheDocument();
  });

  it("conta gerada pelo NILT mostra a origem e o link da viagem", () => {
    tabela([conta({ origem: "frete_saldo", viagemId: "v1", viagemNumero: 42, antecipacaoLiberadaEm: "2026-10-22T10:00:00Z" })]);
    expect(screen.getByText(/Saldo do frete \(30%\)/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Viagem 42" })).toHaveAttribute("href", "/viagens/v1");
    expect(screen.getByText("Antecipação liberada")).toBeInTheDocument();
  });
});

describe("agrupamento e total", () => {
  const lista = [
    conta({ id: "1", valor: 100, centroCodigo: "03.08", centroNome: "Manutenção" }),
    conta({ id: "2", valor: 50, centroCodigo: "01.01", centroNome: "Frete" }),
    conta({ id: "3", valor: 25, centroCodigo: "03.08", centroNome: "Manutenção" }),
  ];

  it("por centro: uma linha de cabeçalho por grupo, com o subtotal, e o total no pé", () => {
    tabela(lista, { agrupar: "centro" });
    const cabecalhos = screen.getAllByRole("rowheader").map((c) => c.textContent);
    expect(cabecalhos[0]).toContain("01.01 · Frete");
    expect(cabecalhos[1]).toContain("03.08 · Manutenção");
    const grupo = screen.getByText(/03\.08 · Manutenção/).closest("tr")!;
    expect(within(grupo).getByText("R$ 125,00")).toBeInTheDocument();
    const pe = document.querySelector("tfoot")!;
    expect(within(pe).getByText("R$ 175,00")).toBeInTheDocument();
  });

  it("sem agrupar: não há cabeçalhos de grupo", () => {
    tabela(lista, { agrupar: "nenhum" });
    expect(document.querySelectorAll(".contas-grupo")).toHaveLength(0);
  });

  it("conta cancelada aparece na lista (com o motivo) mas não entra no total", () => {
    tabela([...lista, conta({ id: "4", valor: 1000, canceladoEm: "2026-10-21T10:00:00Z", cancelamentoMotivo: "Fornecedor trocado" })]);
    expect(screen.getByText(/Fornecedor trocado/)).toBeInTheDocument();
    const pe = document.querySelector("tfoot")!;
    expect(within(pe).getByText("R$ 175,00")).toBeInTheDocument();
    expect(within(pe).getByText(/sem as canceladas/)).toBeInTheDocument();
  });

  it("lista vazia mostra a frase e não mostra o total", () => {
    tabela([]);
    expect(screen.getByText("Nenhuma conta.")).toBeInTheDocument();
    expect(document.querySelector("tfoot")).toBeNull();
  });
});

describe("menu e diálogos", () => {
  it("o menu da linha oferece Editar e Cancelar à conta que falta aprovar", () => {
    tabela([conta()]);
    const menu = screen.getByRole("button", { name: "Mais ações da conta 1" });
    expect(menu).toHaveAttribute("popovertarget");
    const itens = Array.from(document.querySelectorAll(".contas-menu button")).map((b) => b.textContent);
    expect(itens).toEqual(["Editar", "Cancelar a conta"]);
  });

  it("parcela do frete: o financeiro não vê Cancelar; o administrador vê Liberar antecipação no saldo", () => {
    const saldo = conta({ origem: "frete_saldo", viagemId: "v1", viagemNumero: 7, lancadoPor: null });
    const { unmount } = tabela([saldo]);
    expect(Array.from(document.querySelectorAll(".contas-menu button")).map((b) => b.textContent)).toEqual(["Editar"]);
    unmount();
    tabela([saldo], { usuario: { userId: EU, admin: true } });
    expect(Array.from(document.querySelectorAll(".contas-menu button")).map((b) => b.textContent)).toEqual([
      "Editar",
      "Liberar antecipação",
      "Cancelar a conta",
    ]);
  });

  it("editar uma conta gerada trava descrição, favorecido, tipo, vencimento e valor", () => {
    tabela([conta({ origem: "frete_adiantamento", viagemId: "v1", viagemNumero: 7, lancadoPor: null })]);
    fireEvent.click(document.querySelector<HTMLButtonElement>(".contas-menu button")!);
    expect(screen.getByText(/gerada pelo NILT/)).toBeInTheDocument();
    for (const rotulo of ["Descrição", "Favorecido", "Tipo de despesa", "Vencimento", "Valor (R$)"]) {
      expect(screen.getByLabelText(rotulo)).toBeDisabled();
    }
    expect(screen.getByLabelText("Centro de custo")).toBeEnabled();
    expect(screen.getByLabelText("Forma de pagamento")).toBeEnabled();
  });

  it("editar uma conta à mão valida antes de enviar: valor zero não vai ao servidor", async () => {
    tabela([conta()]);
    fireEvent.click(document.querySelector<HTMLButtonElement>(".contas-menu button")!);
    fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Informe um valor maior que zero.")).toBeInTheDocument();
    expect(editarConta).not.toHaveBeenCalled();
  });
});

describe("DialogoPagar", () => {
  const bancarias = [{ id: BANCO, banco: "341", agencia: "1234", numero: "5678", apelido: "Conta movimento (fictícia)" }];
  const abrir = (c: ContaPagar) => render(<><DialogoPagar conta={c} contas={bancarias} aoFechar={vi.fn()} /><Toaster /></>);

  it("avisa que o saldo do frete só é pago com a entrega conferida", () => {
    abrir(conta({ origem: "frete_saldo", viagemId: "v1", viagemNumero: 7 }));
    expect(screen.getByText(/O saldo só é pago com a entrega conferida/)).toBeInTheDocument();
  });

  it("conta comum não leva o aviso do saldo; a conta bancária é opcional e a forma vem da conta", () => {
    abrir(conta({ forma: "boleto" }));
    expect(screen.queryByText(/O saldo só é pago/)).not.toBeInTheDocument();
    const conta_ = screen.getByLabelText(/Conta bancária/) as HTMLSelectElement;
    expect(conta_.options[0].textContent).toBe("Sem conta bancária (cartão-frete ou dinheiro)");
    expect(conta_.value).toBe("");
    expect((screen.getByLabelText("Forma de pagamento") as HTMLSelectElement).value).toBe("boleto");
    expect((screen.getByLabelText("Data do pagamento") as HTMLInputElement).value).toBe(HOJE);
  });

  it("data no futuro não vai ao servidor", async () => {
    abrir(conta());
    fireEvent.change(screen.getByLabelText("Data do pagamento"), { target: { value: "2999-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar o pagamento" }));
    expect(await screen.findByText("A data do pagamento não pode ser depois de hoje.")).toBeInTheDocument();
    expect(pagar).not.toHaveBeenCalled();
  });

  it("paga com a data, a conta e a forma escolhidas e avisa", async () => {
    pagar.mockResolvedValue({ ok: true, dados: undefined });
    const aoFechar = vi.fn();
    render(<><DialogoPagar conta={conta()} contas={bancarias} aoFechar={aoFechar} /><Toaster /></>);
    fireEvent.change(screen.getByLabelText(/Conta bancária/), { target: { value: BANCO } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar o pagamento" }));
    await waitFor(() => expect(pagar).toHaveBeenCalledTimes(1));
    const [id, form] = pagar.mock.calls[0] as [string, FormData];
    expect(id).toBe("c1");
    expect(form.get("data")).toBe(HOJE);
    expect(form.get("conta")).toBe(BANCO);
    expect(form.get("forma")).toBe("pix");
    expect(await screen.findByText("Pagamento registrado.")).toBeInTheDocument();
    expect(aoFechar).toHaveBeenCalled();
  });

  it("mostra a frase do banco quando recusa o pagamento", async () => {
    pagar.mockResolvedValue({ ok: false, erro: "Sem aprovação o pagamento é recusado: outra pessoa precisa aprovar esta conta antes." });
    abrir(conta());
    fireEvent.click(screen.getByRole("button", { name: "Registrar o pagamento" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem aprovação o pagamento é recusado");
  });
});
