import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { Sinal } from "@/components/Sinal";
import { Placa } from "@/components/Placa";
import { Engate } from "@/components/Engate";
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
