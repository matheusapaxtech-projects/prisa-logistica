import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BlocoParcelas } from "@/app/(app)/viagens/[id]/parcelas";
import type { ParcelaViagem } from "@/app/(app)/viagens/parcelas";

/* Bloco "Pagamento ao motorista" da ficha da viagem: a retenção do autônomo à vista. Dados fictícios. */

afterEach(cleanup);

const parcela = (extra: Partial<ParcelaViagem> = {}): ParcelaViagem => ({
  origem: "frete_saldo",
  numero: 502,
  valor: 2230,
  partePedagio: 0,
  parteRetencao: 0,
  vencimento: "2999-01-01",
  situacao: "falta_aprovar",
  pagoEm: null,
  antecipacaoLiberada: false,
  ...extra,
});

describe("BlocoParcelas", () => {
  it("saldo com retenção: diz quanto já foi descontado", () => {
    render(<BlocoParcelas parcelas={[parcela({ parteRetencao: 270 })]} verFinanceiro />);
    expect(screen.getByText(/Já descontadas as retenções do autônomo \(INSS, SEST e SENAT\): R\$\s270,00/)).toBeInTheDocument();
  });

  it("sem retenção não diz nada sobre retenção", () => {
    render(<BlocoParcelas parcelas={[parcela()]} verFinanceiro />);
    expect(screen.queryByText(/retenções/)).not.toBeInTheDocument();
  });

  it("falta aprovar e já venceu: o selo diz também que venceu", () => {
    render(<BlocoParcelas parcelas={[parcela({ vencimento: "2000-01-01" })]} verFinanceiro={false} />);
    expect(screen.getByText(/^Falta aprovar · venceu há \d+ dias$/)).toBeInTheDocument();
  });
});
