import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { Sinal } from "@/components/Sinal";
import { Placa } from "@/components/Placa";
import { carroceriaDe, Engate } from "@/components/Engate";
import { MarcoKm } from "@/components/MarcoKm";
import { Campo } from "@/components/Campo";
import { Avatar } from "@/components/Avatar";
import { Capacidade } from "@/components/Capacidade";
import { Abas } from "@/components/Abas";
import { Ponto } from "@/components/Ponto";

afterEach(cleanup);

const peca = (placa: string, categoria: "cavalo" | "carreta" | "dolly", eixos = 3) => ({
  placa,
  categoria,
  configuracao_cavalo: categoria === "cavalo" ? ("trucado" as const) : null,
  eixos,
  capacidade_carga_t: categoria === "carreta" ? 30 : null,
});

describe("Sinal", () => {
  it("'pendente' usa a classe sinal-pendente e o rótulo do protótipo", () => {
    const { container } = render(<Sinal situacao="pendente" />);
    const el = container.firstElementChild!;
    expect(el).toHaveClass("sinal", "sinal-pendente");
    expect(el).toHaveTextContent("Pendente");
  });

  it("situação desconhecida vira neutro com o próprio texto; tipo + texto como sinalTipo", () => {
    const { container } = render(
      <>
        <Sinal situacao="outra_coisa" />
        <Sinal tipo="vencendo" texto="CNH vence em 3 dias" />
      </>,
    );
    const [a, b] = Array.from(container.children);
    expect(a).toHaveClass("sinal-neutro");
    expect(a).toHaveTextContent("outra_coisa");
    expect(b).toHaveClass("sinal-vencendo");
    expect(b).toHaveTextContent("CNH vence em 3 dias");
  });
});

describe("Placa", () => {
  it("'ABC1234' (padrão antigo) tem a classe antiga", () => {
    const { container } = render(<Placa placa="ABC1234" />);
    const el = container.firstElementChild!;
    expect(el).toHaveClass("placa", "antiga");
    expect(el).toHaveAttribute("aria-label", "Placa ABC1234");
    expect(el.querySelector("b")).toHaveTextContent("ABC1234");
  });

  it("Mercosul normalizada, sem antiga; grande", () => {
    const { container } = render(<Placa placa="abc-1d23" grande />);
    const el = container.firstElementChild!;
    expect(el).not.toHaveClass("antiga");
    expect(el).toHaveClass("grande");
    expect(el).toHaveAttribute("aria-label", "Placa ABC1D23");
  });
});

describe("Engate", () => {
  it("rodotrem (cavalo + carreta + dolly + carreta) renderiza 4 peças e 3 acoplamentos", () => {
    const { container } = render(
      <Engate
        cavalo={peca("AAA1A11", "cavalo")}
        itens={[peca("BBB2B22", "carreta"), peca("CCC3C33", "dolly", 2), peca("DDD4D44", "carreta")]}
      />,
    );
    const engate = container.querySelector(".engate")!;
    expect(engate).toHaveAttribute("role", "img");
    expect(engate).toHaveAttribute("aria-label", "Conjunto AAA1A11, BBB2B22, CCC3C33, DDD4D44");
    expect(engate.querySelectorAll(".peca")).toHaveLength(4);
    expect(engate.querySelectorAll(".acoplamento")).toHaveLength(3);
    expect(engate.querySelector(".peca.cavalo .peca-corpo")).toHaveTextContent("Cavalo trucado");
    expect(engate.querySelectorAll(".peca.dolly .peca-eixos i")).toHaveLength(2);
    expect(engate.querySelector(".peca.carreta .peca-corpo")).toHaveTextContent("Carreta 30,0 t");
  });

  it("a carroceria do modelinho segue o tipo do cadastro; sem tipo, graneleiro", () => {
    expect(carroceriaDe("CARRETA BAU - 3 EIXOS")).toBe("bau");
    expect(carroceriaDe("CARGA SEMI-REBOQUE FECHADA - 3 EIXOS")).toBe("bau");
    expect(carroceriaDe("CARRETA SIDER - 3 EIXOS")).toBe("sider");
    expect(carroceriaDe("CARRETA BASCULANTE - 3 EIXOS")).toBe("basculante");
    expect(carroceriaDe("CARRETA CONTEINER TRUCADA - 3 EIXOS")).toBe("conteiner");
    expect(carroceriaDe("CARRETA GRANELEIRO SIMPLES - 2 EIXOS")).toBe("graneleiro");
    expect(carroceriaDe(null)).toBe("graneleiro");
    const { container } = render(
      <Engate cavalo={peca("AAA1A11", "cavalo")} itens={[{ ...peca("BBB2B22", "carreta"), tipo: "CARRETA SIDER - 3 EIXOS" }]} />,
    );
    expect(container.querySelector(".peca.carreta .peca-modelo")).toHaveAttribute("data-carroceria", "sider");
    expect(container.querySelector(".peca.carreta .peca-corpo")).toHaveTextContent("Carreta sider 30,0 t");
  });

  it("destacar marca a peça do veículo com 'atual' e texto para leitor de tela", () => {
    const { container } = render(
      <Engate cavalo={peca("AAA1A11", "cavalo")} itens={[peca("BBB2B22", "carreta")]} destacar="BBB2B22" />,
    );
    const atual = container.querySelector(".peca.atual")!;
    expect(atual.querySelector(".peca-placa")).toHaveTextContent("BBB2B22");
    expect(atual.querySelector(".sr-only")).toHaveTextContent("(este veículo)");
  });
});

describe("MarcoKm", () => {
  it("10 dias usa amarelo; 60 dias usa verde", () => {
    const { container: a } = render(<MarcoKm dias={10} />);
    const { container: b } = render(<MarcoKm dias={60} />);
    expect(a.querySelector(".trilho i")!.getAttribute("style")).toContain("var(--amarelo)");
    expect(b.querySelector(".trilho i")!.getAttribute("style")).toContain("var(--verde)");
  });

  it("vencido: classe vencido, largura 100% e sem cor própria", () => {
    const { container } = render(<MarcoKm dias={-3} />);
    const trilho = container.querySelector(".trilho")!;
    expect(trilho).toHaveClass("vencido");
    const estilo = trilho.querySelector("i")!.getAttribute("style")!;
    expect(estilo).toContain("width: 100%");
    expect(estilo).not.toContain("background");
  });
});

describe("Campo", () => {
  it("valida='cpf' mostra a mensagem do protótipo no blur de um CPF errado", () => {
    render(<Campo label="CPF" name="cpf" mascara="cpf" valida="cpf" />);
    const input = screen.getByLabelText("CPF");
    fireEvent.input(input, { target: { value: "52998224700" } });
    expect(input).toHaveValue("529.982.247-00");
    expect(screen.queryByText(/CPF inválido/)).toBeNull();
    fireEvent.blur(input);
    expect(
      screen.getByText("CPF inválido: os dois últimos dígitos não conferem. Copie de novo do documento."),
    ).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.closest(".campo")).toHaveAttribute("data-invalido");
  });

  it("enquanto inválido, revalida ao digitar e limpa quando fica certo", () => {
    render(<Campo label="CPF" name="cpf" mascara="cpf" valida="cpf" />);
    const input = screen.getByLabelText("CPF");
    fireEvent.input(input, { target: { value: "52998224700" } });
    fireEvent.blur(input);
    fireEvent.input(input, { target: { value: "52998224725" } });
    expect(screen.queryByText(/CPF inválido/)).toBeNull();
    expect(input.closest(".campo")).toHaveAttribute("data-valido");
  });

  it("rótulo opcional, ajuda e erro externo (some ao editar); defaultValue mascarado", () => {
    render(
      <Campo label="Telefone" name="tel" mascara="telefone" opcional ajuda="Com DDD." erro="Confira o número." defaultValue="41999998888" />,
    );
    const input = screen.getByLabelText(/Telefone/);
    expect(input).toHaveValue("(41) 99999-8888");
    expect(input).toHaveAttribute("name", "tel");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByText("(opcional)")).toHaveClass("opcional");
    expect(screen.getByText("Com DDD.")).toHaveClass("ajuda");
    expect(screen.getByText("Confira o número.")).toHaveClass("erro");
    fireEvent.input(input, { target: { value: "4199999888" } });
    expect(screen.queryByText("Confira o número.")).toBeNull();
  });
});

describe("Campo (M7)", () => {
  it("form.reset() limpa a validação e volta o valor inicial", () => {
    const { container } = render(
      <form>
        <Campo label="CPF" name="cpf" mascara="cpf" valida="cpf" defaultValue="52998224725" />
      </form>,
    );
    const input = screen.getByLabelText("CPF");
    fireEvent.input(input, { target: { value: "52998224700" } });
    fireEvent.blur(input);
    expect(input.closest(".campo")).toHaveAttribute("data-invalido");
    act(() => (container.querySelector("form") as HTMLFormElement).reset());
    expect(input.closest(".campo")).not.toHaveAttribute("data-invalido");
    expect(screen.queryByText(/CPF inválido/)).toBeNull();
    expect(input).toHaveValue("529.982.247-25");
  });

  it("ajuda e erro entram no aria-describedby (junto com o que vier de fora)", () => {
    render(<Campo id="tel" label="Telefone" ajuda="Com DDD." erro="Confira." aria-describedby="extra" />);
    expect(screen.getByLabelText("Telefone")).toHaveAttribute("aria-describedby", "extra tel-ajuda tel-erro");
    expect(screen.getByText("Com DDD.")).toHaveAttribute("id", "tel-ajuda");
  });

  it("com controle: erro externo some ao mudar o select e reset limpa", () => {
    const { container } = render(
      <form>
        <Campo
          id="uf"
          label="UF"
          erro="Escolha a UF."
          controle={
            <select id="uf" name="uf" defaultValue="">
              <option value="">UF</option>
              <option value="PR">PR</option>
            </select>
          }
        />
      </form>,
    );
    expect(screen.getByText("Escolha a UF.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("UF"), { target: { value: "PR" } });
    expect(screen.queryByText("Escolha a UF.")).toBeNull();
    expect(container.querySelector(".campo")).not.toHaveAttribute("data-invalido");
  });

  it("controle com valida (ou sem id) é erro de uso em desenvolvimento", () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Campo id="x" label="X" valida="cpf" controle={<select id="x" />} />)).toThrow(
      "Campo: `mascara` e `valida` não funcionam com `controle`.",
    );
    expect(() => render(<Campo label="Y" controle={<select />} />)).toThrow("Campo: com `controle`, passe o `id` do controle.");
    erro.mockRestore();
  });

  it("value é descartado: o campo continua não controlado", () => {
    const props = { label: "Nome", name: "nome", value: "fixo" } as unknown as Parameters<typeof Campo>[0];
    render(<Campo {...props} />);
    const input = screen.getByLabelText("Nome");
    fireEvent.input(input, { target: { value: "novo" } });
    expect(input).toHaveValue("novo");
  });
});

describe("Avatar, Capacidade, Abas, Ponto", () => {
  it("Avatar: duas iniciais e cor derivada do nome", () => {
    const html = renderToStaticMarkup(<Avatar nome="matheus prisa silva" />);
    expect(html).toMatch(/^<span class="avatar" style="background:hsl\(\d+ 45% 90%\);color:hsl\(\d+ 40% 28%\)">MP<\/span>$/);
  });

  it("Capacidade acima do CMT mostra a barra de excesso e 'passa X do CMT'", () => {
    const { container } = render(
      <Capacidade c={{ limite_t: 40, capacidade_total_t: 45.5, excede_cmt: true }} />,
    );
    expect(container.querySelector(".trilho .excede")).not.toBeNull();
    expect(container.querySelector(".legenda")).toHaveTextContent("passa 5,5 t do CMT");
  });

  it("Capacidade sem CMT", () => {
    const { container } = render(<Capacidade c={{ limite_t: null, capacidade_total_t: 30, excede_cmt: false }} />);
    expect(container).toHaveTextContent("CMT do cavalo não informado");
  });

  it("Abas: links ?aba= com aria-current na ativa e contagem", () => {
    render(
      <Abas
        rotulo="Partes da ficha"
        abas={[
          { id: "dados", rotulo: "Dados pessoais" },
          { id: "documentos", rotulo: "Documentos", n: 3 },
        ]}
        ativa="documentos"
      />,
    );
    const docs = screen.getByRole("link", { name: /Documentos/ });
    expect(docs).toHaveAttribute("href", "?aba=documentos");
    expect(docs).toHaveAttribute("aria-current", "page");
    expect(docs.querySelector(".n")).toHaveTextContent("3");
    expect(screen.getByRole("link", { name: "Dados pessoais" })).not.toHaveAttribute("aria-current");
  });

  it("Ponto", () => {
    const { container } = render(<Ponto />);
    expect(container.innerHTML).toBe('<span class="ponto">·</span>');
  });
});
