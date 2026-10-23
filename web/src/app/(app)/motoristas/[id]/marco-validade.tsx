/* Marco de quilômetro da validade (marcoValidade de prototipo/motorista.html): placa com os dias,
   régua de um ano com o corte de 30 dias e, à direita, o resumo. Sem estado. */
import type { ReactNode } from "react";
import { Ponto } from "@/components/Ponto";
import { estadoValidade } from "@/lib/datas";
import { formato } from "@/lib/formato";

const JANELA = 365;

export function MarcoValidade({ iso, titulo, fim }: { iso: string | null; titulo: string; fim: ReactNode }) {
  if (!iso)
    return (
      <div className="bloco marco-validade">
        <span className="placa-km">
          <span>validade</span>
          <b>—</b>
        </span>
        <div className="regua">
          <b>{titulo}</b>
          <span className="muted">Sem validade informada. Preencha a data abaixo.</span>
        </div>
        <div className="fim">{fim}</div>
      </div>
    );
  const e = estadoValidade(iso);
  const dias = e.dias ?? 0;
  const texto = formato.dias(dias);
  const pct = dias < 0 ? 100 : Math.max(2, Math.min(100, (dias / JANELA) * 100));
  const num = Math.abs(dias);
  const topo = dias < 0 ? "venceu há" : dias === 0 ? "vence" : "faltam";
  const valor = dias === 0 ? "hoje" : num.toLocaleString("pt-BR");
  return (
    <div className="bloco marco-validade">
      <span className={`placa-km ${e.cls}`} aria-hidden="true">
        <span>{topo}</span>
        <b>{valor}</b>
        <span>{dias === 0 ? "" : num === 1 ? "dia" : "dias"}</span>
      </span>
      <div className="regua">
        <span>
          <b>{titulo}</b>{" "}
          <span className="muted">
            <Ponto />
            {dias < 0 ? "validade" : "válida até"} {formato.data(iso)}
            <Ponto />
            {texto}
          </span>
        </span>
        <div className={`trilho${dias < 0 ? " vencido" : e.cls === "normal" ? " ok" : ""}`} role="img" aria-label={texto}>
          <i style={{ width: `${pct}%` }} />
          <span className="corte" style={{ left: `${(30 / JANELA) * 100}%` }} aria-hidden="true" />
        </div>
        <div className="escala" aria-hidden="true">
          <span style={{ left: 0 }}>hoje</span>
          <span className="meio trinta" style={{ left: `${(30 / JANELA) * 100}%` }}>
            30 dias
          </span>
          <span className="meio" style={{ left: `${(182 / JANELA) * 100}%` }}>
            6 meses
          </span>
          <span style={{ right: 0 }}>1 ano ou mais</span>
        </div>
      </div>
      <div className="fim">{fim}</div>
    </div>
  );
}
