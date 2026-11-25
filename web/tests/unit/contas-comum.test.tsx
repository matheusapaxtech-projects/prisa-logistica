import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DialogoMotivo, type TextosMotivo } from "@/app/(app)/financeiro/contas-comum/dialogo-motivo";
import { dataReal, ehIdConta, inteiro, lerMotivo, texto } from "@/app/(app)/financeiro/contas-comum/leitura";
import { Toaster } from "@/components/Toast";

/* Peças comuns das telas de contas a pagar e a receber: leitura de formulário e o diálogo genérico de motivo. */

beforeAll(() => {
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
afterEach(cleanup);

describe("leitura de formulário comum", () => {
  it("dataReal, inteiro, texto e ehIdConta", () => {
    expect(dataReal("2026-02-28")).toBe(true);
    expect(dataReal("2026-02-30")).toBe(false);
    expect(dataReal("26/10/2026")).toBe(false);
    expect(inteiro("12")).toBe(12);
    expect(inteiro("0")).toBeNull();
    expect(inteiro("1a")).toBeNull();
    const f = new FormData();
    f.set("a", "  oi ");
    expect(texto(f, "a")).toBe("oi");
    expect(texto(f, "nada")).toBe("");
    expect(ehIdConta("00000000-0000-4000-8000-000000000901")).toBe(true);
    expect(ehIdConta("abc")).toBe(false);
    expect(ehIdConta(null)).toBe(false);
  });

  it("lerMotivo: de 3 a 300 caracteres, sem as pontas em branco", () => {
    expect(lerMotivo("  ok! ", "cancelamento")).toEqual({ ok: true, motivo: "ok!" });
    expect(lerMotivo("ab", "liberação")).toEqual({ ok: false, erro: "Diga o motivo da liberação." });
    expect(lerMotivo("a".repeat(301), "cancelamento")).toEqual({ ok: false, erro: "Use até 300 caracteres." });
  });
});

describe("DialogoMotivo (genérico)", () => {
  const textos: TextosMotivo = {
    titulo: "Cancelar a coisa",
    explica: "Explicação da coisa.",
    rotulo: "Motivo do cancelamento",
    voltar: "Voltar",
    enviar: "Cancelar a coisa",
    sucesso: "Coisa cancelada.",
    para: "cancelamento",
    perigo: true,
  };
  const abrir = (acao = vi.fn(), aoFechar = vi.fn()) =>
    render(
      <>
        <DialogoMotivo textos={textos} resumo={<p>Resumo da coisa</p>} acao={acao} aoFechar={aoFechar} />
        <Toaster />
      </>,
    );

  it("mostra o resumo, a explicação e o botão de perigo", () => {
    abrir();
    expect(screen.getByText("Resumo da coisa")).toBeInTheDocument();
    expect(screen.getByText("Explicação da coisa.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar a coisa" })).toHaveClass("btn-perigo");
  });

  it("motivo curto não chama a ação", async () => {
    const acao = vi.fn();
    abrir(acao);
    fireEvent.change(screen.getByLabelText("Motivo do cancelamento"), { target: { value: "ab" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar a coisa" }));
    expect(await screen.findByText("Diga o motivo do cancelamento.")).toBeInTheDocument();
    expect(acao).not.toHaveBeenCalled();
  });

  it("chama a ação com o motivo sem as pontas, avisa e fecha", async () => {
    const acao = vi.fn().mockResolvedValue({ ok: true, dados: undefined });
    const aoFechar = vi.fn();
    abrir(acao, aoFechar);
    fireEvent.change(screen.getByLabelText("Motivo do cancelamento"), { target: { value: "  Cliente desistiu " } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar a coisa" }));
    await waitFor(() => expect(acao).toHaveBeenCalledWith("Cliente desistiu"));
    expect(await screen.findByText("Coisa cancelada.")).toBeInTheDocument();
    expect(aoFechar).toHaveBeenCalled();
  });

  it("mostra a frase do banco quando recusa e não fecha", async () => {
    const acao = vi.fn().mockResolvedValue({ ok: false, erro: "Este título já foi recebido." });
    const aoFechar = vi.fn();
    abrir(acao, aoFechar);
    fireEvent.change(screen.getByLabelText("Motivo do cancelamento"), { target: { value: "Erro de lançamento" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar a coisa" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Este título já foi recebido.");
    expect(aoFechar).not.toHaveBeenCalled();
  });
});
