import { formato } from "@/lib/formato";

/** Colunas de `v_conjunto_capacidade` (ou `capacidade()` de lib/conjunto.ts): `limite_t` = CMT − tara total. */
export type DadosCapacidade = {
  limite_t: number | null;
  capacidade_total_t: number;
  excede_cmt: boolean;
};

/* Barra de capacidade do conjunto (`N.desenhar.capacidade`): carga das carretas contra o limite do CMT. */
export function Capacidade({ c }: { c: DadosCapacidade }) {
  if (c.limite_t == null)
    return (
      <div className="capacidade">
        <span className="small muted">CMT do cavalo não informado</span>
      </div>
    );
  const escala = Math.max(c.limite_t, c.capacidade_total_t);
  const pct = (Math.min(c.capacidade_total_t, c.limite_t) / escala) * 100;
  const passa = +(c.capacidade_total_t - c.limite_t).toFixed(1);
  return (
    <div className="capacidade">
      <div className="trilho">
        <i style={{ width: `${pct}%` }} />
        {c.excede_cmt && (
          <i
            className="excede"
            style={{ left: `${pct}%`, width: `${((c.capacidade_total_t - c.limite_t) / escala) * 100}%` }}
          />
        )}
      </div>
      <div className="legenda">
        <span>
          <b>{formato.t(c.capacidade_total_t)}</b> de carga
        </span>
        <span>
          {c.excede_cmt ? (
            <>
              <b style={{ color: "var(--vermelho-tinta)" }}>passa {formato.t(passa)}</b> do CMT
            </>
          ) : (
            `limite ${formato.t(c.limite_t)}`
          )}
        </span>
      </div>
    </div>
  );
}
