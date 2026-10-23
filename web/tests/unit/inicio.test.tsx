import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ErroInicio from "@/app/(app)/(inicio)/error";
import CarregandoInicio from "@/app/(app)/(inicio)/loading";

describe("Início: estados", () => {
  it("carregando mantém a grade e as 5 placas da tela pronta", () => {
    const { container } = render(<CarregandoInicio />);
    expect(screen.getByRole("heading", { level: 1, name: "Início" })).toBeInTheDocument();
    expect(container.querySelectorAll(".advertencia")).toHaveLength(5);
    expect(container.querySelectorAll(".bloco")).toHaveLength(4);
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
