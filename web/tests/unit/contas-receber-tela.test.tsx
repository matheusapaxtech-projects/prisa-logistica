import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hojeISO } from "@/lib/datas";

/* Tela de contas a receber (Task 7): quem pode ser marcado para antecipar, o simulador (seleção → totais, taxa e tarifa
   editáveis, limpar), o que cada linha oferece, o diálogo de recebimento e o de lançamento. As ações do servidor são
   trocadas por falsos. */

const receberTitulo = vi.fn();
const desfazerRecebimento = vi.fn();
const lancarTitulo = vi.fn();
vi.mock("@/app/(app)/financeiro/receber/actions", () => ({
  receberTitulo: (...a: unknown[]) => receberTitulo(...a),
  desfazerRecebimento: (...a: unknown[]) => desfazerRecebimento(...a),
  lancarTitulo: (...a: unknown[]) => lancarTitulo(...a),
  editarTitulo: vi.fn(),
  cancelarReceber: vi.fn(),
}));

import { DialogoTitulo } from "@/app/(app)/financeiro/receber/dialogo-conta";
import { DialogoReceber } from "@/app/(app)/financeiro/receber/dialogo-receber";
import { TabelaReceber } from "@/app/(app)/financeiro/receber/tabela-receber";
import type { TituloReceber } from "@/app/(app)/financeiro/receber/consultas";
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
  receberTitulo.mockReset();
  desfazerRecebimento.mockReset();
  lancarTitulo.mockReset();
});
afterEach(cleanup);

const HOJE = hojeISO();
const BANCO = "00000000-0000-4000-8000-000000000902";
const CLIENTE = "00000000-0000-4000-8000-000000000a01";

/** Hoje + n dias, "aaaa-mm-dd". */
function emDias(n: number): string {
  const d = new Date(`${HOJE}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function titulo(t: Partial<TituloReceber> = {}): TituloReceber {
  return {
    id: "t1",
    numero: 1,
    clienteId: CLIENTE,
    clienteNome: "Cliente Fictício S.A.",
    titulo: "CT-e 1001",
    planoId: 1,
    planoNome: "Frete (CT-e)",
    centroId: 1,
    centroCodigo: "01.03",
    centroNome: "Frete de terceiros",
    forma: "boleto",
    vencimento: emDias(30),
    valor: 1000,
    observacao: null,
    viagemId: null,
    viagemNumero: null,
    situacao: "a_vencer",
    recebidoEm: null,
    recebidoPor: null,
    canceladoEm: null,
    cancelamentoMotivo: null,
    recebidoPorNome: null,
    ...t,
  };
}

const bancarias = [{ id: BANCO, banco: "341", agencia: "1234", numero: "5678", apelido: "Conta movimento (fictícia)" }];
const clientes = [{ id: CLIENTE, rotulo: "Cliente Fictício · 00.000.000/0001-00" }];
const tipos = [
  { id: 1, grupo: "receita" as const, nome: "Frete (CT-e)" },
  { id: 2, grupo: "receita" as const, nome: "Outras receitas" },
];
const centros = [
  { id: 1, codigo: "01.03", nome: "Frete de terceiros" },
  { id: 2, codigo: "01.01", nome: "Frete" },
];

function tabela(titulos: TituloReceber[]) {
  return render(
    <>
      <TabelaReceber titulos={titulos} hoje={HOJE} contasBancarias={bancarias} clientes={clientes} tipos={tipos} centros={centros} vazio="Nenhuma conta." />
      <Toaster />
    </>,
  );
}

const caixa = (nome: string) => screen.getByRole("checkbox", { name: `Antecipar ${nome}` });
const itensDoMenu = () => Array.from(document.querySelectorAll(".contas-menu button")).map((b) => b.textContent);

describe("coluna Antecipar", () => {
  it("só título em aberto e a vencer pode ser marcado; vencido, recebido e cancelado ficam travados", () => {
    tabela([
      titulo({ id: "a", titulo: "A vencer" }),
      titulo({ id: "b", titulo: "Vencido", vencimento: emDias(-3), situacao: "vencida" }),
      titulo({ id: "c", titulo: "Vence hoje", vencimento: HOJE }),
      titulo({ id: "d", titulo: "Recebido", recebidoEm: emDias(-1), situacao: "recebida" }),
      titulo({ id: "e", titulo: "Cancelado", canceladoEm: "2026-10-21T10:00:00Z", cancelamentoMotivo: "Erro de lançamento", situacao: "cancelada" }),
    ]);
    expect(caixa("A vencer")).toBeEnabled();
    for (const n of ["Vencido", "Vence hoje", "Recebido", "Cancelado"]) expect(caixa(n)).toBeDisabled();
  });

  it("sem marcação não há simulador", () => {
    tabela([titulo()]);
    expect(screen.queryByRole("region", { name: "Simulador de antecipação" })).not.toBeInTheDocument();
  });
});

describe("simulador de antecipação", () => {
  const dois = () => [
    titulo({ id: "a", titulo: "CT-e 1001", valor: 1000, vencimento: emDias(30) }),
    titulo({ id: "b", numero: 2, titulo: "CT-e 1002", valor: 500, vencimento: emDias(60) }),
  ];
  const painel = () => screen.getByRole("region", { name: "Simulador de antecipação" });
  const total = (rotulo: string) => within(painel()).getByText(rotulo, { selector: "dt" }).nextElementSibling as HTMLElement;

  it("marcar um título mostra a simulação com a taxa de 2,0% e a tarifa de R$ 5,00", () => {
    tabela(dois());
    fireEvent.click(caixa("CT-e 1001"));
    expect(painel()).toBeInTheDocument();
    expect(screen.getByLabelText("Taxa ao mês (%)")).toHaveValue("2,0");
    expect(screen.getByLabelText("Tarifa por título (R$)")).toHaveValue("5,00");
    expect(within(painel()).getByText("1 título marcado")).toBeInTheDocument();
    expect(total("Bruto")).toHaveTextContent("R$ 1.000,00");
    expect(total("Deságio")).toHaveTextContent("R$ 20,00");
    expect(total("Tarifas")).toHaveTextContent("R$ 5,00");
    expect(total("Líquido")).toHaveTextContent("R$ 975,00");
    expect(total("Prazo médio")).toHaveTextContent("30 dias");
    expect(total("Custo efetivo ao mês")).toHaveTextContent("2,56%");
    expect(within(painel()).getByText(/Só simula: registrar a antecipação no fomento chega na próxima etapa\./)).toBeInTheDocument();
  });

  it("dois títulos: soma os valores, as tarifas (uma por título) e pondera o prazo pelo valor", () => {
    tabela(dois());
    fireEvent.click(caixa("CT-e 1001"));
    fireEvent.click(caixa("CT-e 1002"));
    expect(within(painel()).getByText("2 títulos marcados")).toBeInTheDocument();
    expect(total("Bruto")).toHaveTextContent("R$ 1.500,00");
    expect(total("Deságio")).toHaveTextContent("R$ 40,00");
    expect(total("Tarifas")).toHaveTextContent("R$ 10,00");
    expect(total("Líquido")).toHaveTextContent("R$ 1.450,00");
    // (1000 × 30 + 500 × 60) / 1500 = 40 dias
    expect(total("Prazo médio")).toHaveTextContent("40 dias");
    const linhas = within(painel()).getAllByRole("row");
    expect(linhas).toHaveLength(3); // cabeçalho + 2 títulos
    expect(within(linhas[2]).getByText("R$ 475,00")).toBeInTheDocument();
  });

  it("mudar a taxa e a tarifa recalcula na hora", () => {
    tabela(dois());
    fireEvent.click(caixa("CT-e 1001"));
    fireEvent.change(screen.getByLabelText("Taxa ao mês (%)"), { target: { value: "3,0" } });
    fireEvent.change(screen.getByLabelText("Tarifa por título (R$)"), { target: { value: "10,00" } });
    expect(total("Deságio")).toHaveTextContent("R$ 30,00");
    expect(total("Tarifas")).toHaveTextContent("R$ 10,00");
    expect(total("Líquido")).toHaveTextContent("R$ 960,00");
  });

  it("taxa mal escrita mostra o erro e esconde os números até corrigir", () => {
    tabela(dois());
    fireEvent.click(caixa("CT-e 1001"));
    fireEvent.change(screen.getByLabelText("Taxa ao mês (%)"), { target: { value: "2.5" } });
    expect(within(painel()).getByRole("alert")).toHaveTextContent("Taxa inválida");
    expect(within(painel()).queryByText("Bruto")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Taxa ao mês (%)"), { target: { value: "2,5" } });
    expect(total("Bruto")).toHaveTextContent("R$ 1.000,00");
  });

  it("desmarcar o último título fecha o simulador; Limpar seleção desmarca tudo", () => {
    tabela(dois());
    fireEvent.click(caixa("CT-e 1001"));
    fireEvent.click(caixa("CT-e 1001"));
    expect(screen.queryByRole("region", { name: "Simulador de antecipação" })).not.toBeInTheDocument();

    fireEvent.click(caixa("CT-e 1001"));
    fireEvent.click(caixa("CT-e 1002"));
    fireEvent.click(screen.getByRole("button", { name: "Limpar seleção" }));
    expect(screen.queryByRole("region", { name: "Simulador de antecipação" })).not.toBeInTheDocument();
    expect(caixa("CT-e 1001")).not.toBeChecked();
    expect(caixa("CT-e 1002")).not.toBeChecked();
  });

  it("taxa e tarifa digitadas continuam quando o último título é desmarcado e outro é marcado", () => {
    tabela(dois());
    fireEvent.click(caixa("CT-e 1001"));
    fireEvent.change(screen.getByLabelText("Taxa ao mês (%)"), { target: { value: "3,0" } });
    fireEvent.change(screen.getByLabelText("Tarifa por título (R$)"), { target: { value: "10,00" } });
    fireEvent.click(caixa("CT-e 1001"));
    expect(screen.queryByRole("region", { name: "Simulador de antecipação" })).not.toBeInTheDocument();
    fireEvent.click(caixa("CT-e 1002"));
    expect(screen.getByLabelText("Taxa ao mês (%)")).toHaveValue("3,0");
    expect(screen.getByLabelText("Tarifa por título (R$)")).toHaveValue("10,00");
  });

  it("título marcado que some da lista (recarga) sai da simulação", () => {
    const { rerender } = tabela(dois());
    fireEvent.click(caixa("CT-e 1001"));
    fireEvent.click(caixa("CT-e 1002"));
    rerender(
      <TabelaReceber titulos={[dois()[1]]} hoje={HOJE} contasBancarias={bancarias} clientes={clientes} tipos={tipos} centros={centros} vazio="Nenhuma conta." />,
    );
    expect(within(painel()).getByText("1 título marcado")).toBeInTheDocument();
    expect(total("Bruto")).toHaveTextContent("R$ 500,00");
  });
});

describe("linha da conta a receber", () => {
  it("em aberto: botão Receber e menu com Editar e Cancelar a conta", () => {
    tabela([titulo()]);
    expect(screen.getAllByText("A vencer", { selector: ".sinal" })[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Receber" })).toBeInTheDocument();
    expect(itensDoMenu()).toEqual(["Editar", "Cancelar a conta"]);
  });

  it("vencida: sinal de bloqueio com os dias", () => {
    tabela([titulo({ vencimento: emDias(-3), situacao: "vencida" })]);
    expect(screen.getAllByText("Vencido", { selector: ".sinal" })[0]).toBeInTheDocument();
    expect(screen.getByText("venceu há 3 dias")).toHaveClass("sinal-bloqueado");
  });

  it("recebida: mostra quando e por quem; sem Receber; o menu só oferece Desfazer recebimento", () => {
    tabela([titulo({ recebidoEm: "2026-10-20", recebidoPorNome: "Caio", situacao: "recebida" })]);
    expect(screen.getByText(/Recebido em 20\/10 por Caio/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Receber" })).not.toBeInTheDocument();
    expect(itensDoMenu()).toEqual(["Desfazer recebimento"]);
  });

  it("cancelada: sem ações, com o motivo, e fora do total", () => {
    tabela([
      titulo({ id: "a", valor: 100 }),
      titulo({ id: "b", valor: 1000, canceladoEm: "2026-10-21T10:00:00Z", cancelamentoMotivo: "Cliente desistiu", situacao: "cancelada" }),
    ]);
    expect(screen.getByText(/Cliente desistiu/)).toBeInTheDocument();
    const pe = document.querySelector("tfoot")!;
    expect(within(pe).getByText("R$ 100,00")).toBeInTheDocument();
    expect(within(pe).getAllByText(/sem os cancelados/)[0]).toBeInTheDocument();
  });

  it("mostra o link da viagem quando o título veio de uma viagem", () => {
    tabela([titulo({ viagemId: "v1", viagemNumero: 42 })]);
    expect(screen.getByRole("link", { name: "Viagem 42" })).toHaveAttribute("href", "/viagens/v1");
  });

  it("lista vazia mostra a frase e não mostra o total", () => {
    tabela([]);
    expect(screen.getByText("Nenhuma conta.")).toBeInTheDocument();
    expect(document.querySelector("tfoot")).toBeNull();
  });

  it("Desfazer recebimento pede confirmação antes de chamar o banco", async () => {
    desfazerRecebimento.mockResolvedValue({ ok: true, dados: undefined });
    tabela([titulo({ recebidoEm: "2026-10-20", situacao: "recebida" })]);
    fireEvent.click(document.querySelector<HTMLButtonElement>(".contas-menu button")!);
    expect(desfazerRecebimento).not.toHaveBeenCalled();
    expect(screen.getByText(/será apagado e a conta volta para em aberto/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Desfazer o recebimento" }));
    await waitFor(() => expect(desfazerRecebimento).toHaveBeenCalledWith("t1"));
    expect(await screen.findByText("Recebimento desfeito.")).toBeInTheDocument();
  });
});

describe("DialogoReceber", () => {
  const abrir = (aoFechar = vi.fn()) => render(<><DialogoReceber titulo={titulo()} contas={bancarias} aoFechar={aoFechar} /><Toaster /></>);

  it("data de hoje, conta opcional com a opção de dinheiro primeiro", () => {
    abrir();
    expect((screen.getByLabelText("Data do recebimento") as HTMLInputElement).value).toBe(HOJE);
    const conta = screen.getByLabelText(/Conta bancária/) as HTMLSelectElement;
    expect(conta.options[0].textContent).toBe("Sem conta bancária (dinheiro)");
    expect(conta.value).toBe("");
  });

  it("data no futuro não vai ao servidor", async () => {
    abrir();
    fireEvent.change(screen.getByLabelText("Data do recebimento"), { target: { value: "2999-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar o recebimento" }));
    expect(await screen.findByText("A data do recebimento não pode ser depois de hoje.")).toBeInTheDocument();
    expect(receberTitulo).not.toHaveBeenCalled();
  });

  it("registra com a data e a conta escolhidas e avisa", async () => {
    receberTitulo.mockResolvedValue({ ok: true, dados: undefined });
    const aoFechar = vi.fn();
    abrir(aoFechar);
    fireEvent.change(screen.getByLabelText(/Conta bancária/), { target: { value: BANCO } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar o recebimento" }));
    await waitFor(() => expect(receberTitulo).toHaveBeenCalledTimes(1));
    const [id, form] = receberTitulo.mock.calls[0] as [string, FormData];
    expect(id).toBe("t1");
    expect(form.get("data")).toBe(HOJE);
    expect(form.get("conta")).toBe(BANCO);
    expect(await screen.findByText("Recebimento registrado.")).toBeInTheDocument();
    expect(aoFechar).toHaveBeenCalled();
  });

  it("mostra a frase do banco quando recusa", async () => {
    receberTitulo.mockResolvedValue({ ok: false, erro: "Este título já foi recebido." });
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Registrar o recebimento" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Este título já foi recebido.");
  });
});

describe("DialogoTitulo (lançar)", () => {
  const abrir = () => render(<><DialogoTitulo titulo={null} clientes={clientes} tipos={tipos} centros={centros} aoFechar={vi.fn()} /><Toaster /></>);

  it("começa com Frete (CT-e), centro 01.03 e boleto; só tipos de receita", () => {
    abrir();
    expect((screen.getByLabelText("Tipo de receita") as HTMLSelectElement).value).toBe("1");
    expect((screen.getByLabelText("Centro de custo") as HTMLSelectElement).value).toBe("1");
    expect((screen.getByLabelText("Forma") as HTMLSelectElement).value).toBe("boleto");
    expect((screen.getByLabelText("Cliente") as HTMLSelectElement).value).toBe("");
    expect(document.querySelectorAll("optgroup")).toHaveLength(1);
  });

  it("sem cliente, com valor zero: mostra os erros e não chama o servidor", async () => {
    abrir();
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "CT-e 1234" } });
    fireEvent.change(screen.getByLabelText("Vencimento"), { target: { value: emDias(10) } });
    fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Lançar" }));
    expect(await screen.findByText("Escolha o cliente.")).toBeInTheDocument();
    expect(screen.getByText("Informe um valor maior que zero.")).toBeInTheDocument();
    expect(lancarTitulo).not.toHaveBeenCalled();
  });

  it("formulário completo vai ao servidor", async () => {
    lancarTitulo.mockResolvedValue({ ok: true, dados: "novo" });
    abrir();
    fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: CLIENTE } });
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "CT-e 1234" } });
    fireEvent.change(screen.getByLabelText("Vencimento"), { target: { value: emDias(10) } });
    fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "1.234,56" } });
    fireEvent.click(screen.getByRole("button", { name: "Lançar" }));
    await waitFor(() => expect(lancarTitulo).toHaveBeenCalledTimes(1));
    const form = lancarTitulo.mock.calls[0][0] as FormData;
    expect(form.get("cliente")).toBe(CLIENTE);
    expect(form.get("titulo")).toBe("CT-e 1234");
    expect(form.get("valor")).toBe("1.234,56");
    expect(await screen.findByText("Conta a receber lançada.")).toBeInTheDocument();
  });
});
