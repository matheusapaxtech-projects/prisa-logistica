import { formato } from "@/lib/formato";

/** Uma peça do desenho: colunas de `veiculo` + `tipo_veiculo` (categoria, configuracao_cavalo, eixos).
   `capacidade_carga_t` só aparece nas carretas (use a capacidade efetiva: informada ou PBT − tara). */
export type PecaEngate = {
  placa: string;
  categoria: "cavalo" | "caminhao" | "carreta" | "dolly" | "outros";
  configuracao_cavalo?: "toco" | "trucado" | null;
  eixos: number;
  capacidade_carga_t?: number | null;
};

const ROT: Record<string, string> = { dolly: "Dolly", carreta: "Carreta", caminhao: "Caminhão", outros: "Outro" };

function Peca({ v, atual }: { v: PecaEngate; atual: boolean }) {
  const rot =
    v.categoria === "cavalo"
      ? v.configuracao_cavalo === "trucado"
        ? "Cavalo trucado"
        : "Cavalo toco"
      : ROT[v.categoria] || "Veículo";
  return (
    <div className={`peca ${v.categoria}${atual ? " atual" : ""}`}>
      <div className="peca-corpo">
        {rot}
        {v.categoria === "carreta" && (
          <>
            {" "}
            <span className="muted" style={{ fontWeight: 500 }}>
              {formato.t(v.capacidade_carga_t)}
            </span>
          </>
        )}
      </div>
      <span className="peca-eixos" aria-hidden="true">
        {Array.from({ length: v.eixos }, (_, i) => (
          <i key={i} />
        ))}
      </span>
      <span className="peca-placa">{v.placa}</span>
      {atual && <span className="sr-only">(este veículo)</span>}
    </div>
  );
}

/* Conjunto engatado (`N.desenhar.engate`): cavalo + peças na ordem de engate.
   `destacar` = placa da peça que é "este veículo" (ficha do veículo). */
export function Engate({ cavalo, itens, destacar }: { cavalo: PecaEngate; itens: PecaEngate[]; destacar?: string }) {
  const desc = [cavalo.placa, ...itens.map((v) => v.placa)].join(", ");
  return (
    <div className="engate" role="img" aria-label={`Conjunto ${desc}`}>
      <Peca v={cavalo} atual={destacar === cavalo.placa} />
      {itens.map((v, i) => (
        <PecaComAcoplamento key={`${v.placa}-${i}`} v={v} atual={destacar === v.placa} />
      ))}
    </div>
  );
}

function PecaComAcoplamento({ v, atual }: { v: PecaEngate; atual: boolean }) {
  return (
    <>
      <span className="acoplamento" aria-hidden="true" />
      <Peca v={v} atual={atual} />
    </>
  );
}
