import { formato } from "@/lib/formato";

/** Uma peça do desenho: colunas de `veiculo` + `tipo_veiculo` (categoria, configuracao_cavalo, eixos).
   `capacidade_carga_t` só aparece nas carretas (use a capacidade efetiva: informada ou PBT − tara). */
export type PecaEngate = {
  placa: string;
  categoria: "cavalo" | "caminhao" | "carreta" | "dolly" | "outros";
  configuracao_cavalo?: "toco" | "trucado" | null;
  eixos: number;
  capacidade_carga_t?: number | null;
  /** Nome do tipo (`tipo_veiculo.nome`, ex.: "CARRETA BAU - 3 EIXOS"): escolhe a carroceria do modelinho. */
  tipo?: string | null;
};

export type Carroceria = "graneleiro" | "bau" | "sider" | "basculante" | "conteiner";

/** Carroceria do modelinho pelo nome do tipo do cadastro (sem tipo ou desconhecido: graneleiro). */
export function carroceriaDe(tipo: string | null | undefined): Carroceria {
  const t = (tipo ?? "").toUpperCase();
  if (/SIDER/.test(t)) return "sider";
  if (/BASCULANTE/.test(t)) return "basculante";
  if (/CONTEINER|CONTAINER/.test(t)) return "conteiner";
  if (/\bBAU\b|BAÚ|FECHADA|FURG[AÃ]O/.test(t)) return "bau";
  return "graneleiro";
}

/** A carroceria desenhada sobre o chassi da carreta (viewBox 104×30, chassi em y = 23). */
function Carroceria({ tipo }: { tipo: Carroceria }) {
  if (tipo === "bau") {
    return (
      <g>
        <rect x="1" y="2" width="102" height="21" rx="2" className="pm-carroceria" />
        {[21, 41, 61, 81].map((x) => (
          <line key={x} x1={x} y1="4" x2={x} y2="21" className="pm-vinco" />
        ))}
        <line x1="97" y1="4" x2="97" y2="21" className="pm-vinco-forte" />
      </g>
    );
  }
  if (tipo === "sider") {
    return (
      <g>
        <rect x="1" y="2" width="102" height="21" rx="2" className="pm-carroceria pm-lona" />
        {Array.from({ length: 11 }, (_, i) => 7 + i * 9).map((x) => (
          <line key={x} x1={x} y1="5" x2={x} y2="21" className="pm-cinta" />
        ))}
        <rect x="1" y="2" width="102" height="3" rx="1" className="pm-chassi" />
      </g>
    );
  }
  if (tipo === "basculante") {
    return (
      <g>
        <path d="M2 23 L2 9 L88 3 Q101 3 101 11 L95 23 Z" className="pm-carroceria" />
        {[20, 40, 60, 80].map((x) => (
          <line key={x} x1={x} y1={9 - (x / 88) * 6 + 2} x2={x} y2="21" className="pm-vinco" />
        ))}
      </g>
    );
  }
  if (tipo === "conteiner") {
    return (
      <g>
        <rect x="1" y="3" width="102" height="20" rx="1.5" className="pm-carroceria pm-conteiner" />
        {Array.from({ length: 24 }, (_, i) => 5 + i * 4).map((x) => (
          <line key={x} x1={x} y1="5" x2={x} y2="21" className="pm-vinco" />
        ))}
      </g>
    );
  }
  return (
    <g>
      {[8, 22, 36, 50, 64, 78, 92].map((x) => (
        <rect key={x} x={x} y="3" width="1.8" height="6" className="pm-chassi" />
      ))}
      <rect x="1" y="8" width="102" height="15" rx="2" className="pm-carroceria" />
      {[22, 43, 64, 85].map((x) => (
        <line key={x} x1={x} y1="10" x2={x} y2="21" className="pm-vinco" />
      ))}
    </g>
  );
}

const ROT: Record<string, string> = { dolly: "Dolly", carreta: "Carreta", caminhao: "Caminhão", outros: "Outro" };
const NOME_CARROCERIA: Record<Carroceria, string> = { graneleiro: "graneleiro", bau: "baú", sider: "sider", basculante: "basculante", conteiner: "contêiner" };

/** Silhueta da peça em miniatura (vista lateral, frente para a esquerda). As rodas são os `<i>` de
   `.peca-eixos`, posicionados pelo CSS: no cavalo, o primeiro eixo vai para baixo da cabine. */
function Modelo({ categoria, tipo }: { categoria: string; tipo?: string | null }) {
  if (categoria === "cavalo" || categoria === "caminhao") {
    return (
      <svg className="peca-modelo" viewBox="0 0 64 30" width="64" height="30" aria-hidden="true">
        <rect x="2" y="23" width="60" height="4" rx="1" className="pm-chassi" />
        <rect x="46" y="20" width="14" height="3" rx="1" className="pm-chassi" />
        <rect x="32" y="4" width="2.2" height="19" rx="1" className="pm-chassi" />
        <path d="M2 27 L2 12 Q2 4 9 3 L29 2 L30 2 L30 27 Z" className="pm-cabine" />
        <path d="M5 13 L7 7 Q8 5 10 5 L16 5 L16 13 Z" className="pm-vidro" />
        <rect x="19" y="6" width="8" height="7" rx="1.5" className="pm-vidro" />
        <rect x="1" y="21" width="5" height="6" rx="1" className="pm-chassi" />
        <rect x="1.5" y="17.5" width="3" height="2" rx="0.8" className="pm-farol" />
      </svg>
    );
  }
  if (categoria === "dolly") {
    return (
      <svg className="peca-modelo" viewBox="0 0 40 30" width="40" height="30" aria-hidden="true">
        <line x1="1" y1="26" x2="10" y2="24" className="pm-cambao" />
        <rect x="9" y="22" width="30" height="5" rx="1" className="pm-chassi" />
        <rect x="15" y="18.5" width="18" height="3.5" rx="1" className="pm-chassi" />
      </svg>
    );
  }
  // carreta (e "outros"): a carroceria do tipo, o chassi e o pé de apoio
  return (
    <svg className="peca-modelo" viewBox="0 0 104 30" width="104" height="30" aria-hidden="true" data-carroceria={carroceriaDe(tipo)}>
      <Carroceria tipo={carroceriaDe(tipo)} />
      <rect x="3" y="23" width="99" height="4" rx="1" className="pm-chassi" />
      <rect x="30" y="27" width="2" height="3" className="pm-chassi" />
    </svg>
  );
}

type PecaProps = {
  v: PecaEngate;
  atual?: boolean;
  /** Guia tracejada (montador sem cavalo) ou vaga da próxima peça. */
  fantasma?: boolean;
  /** Texto no lugar do nome da peça (ex.: "1. Cavalo"). */
  rotulo?: string;
  /** Linha abaixo no lugar da placa (ex.: "escolha acima"). */
  nota?: string;
};

/** Uma peça do conjunto: modelinho, rodas (uma por eixo), nome e placa. */
export function Peca({ v, atual = false, fantasma = false, rotulo, nota }: PecaProps) {
  const rot =
    rotulo ??
    (v.categoria === "cavalo"
      ? v.configuracao_cavalo === "trucado"
        ? "Cavalo trucado"
        : "Cavalo toco"
      : v.categoria === "carreta" && v.tipo
        ? `Carreta ${NOME_CARROCERIA[carroceriaDe(v.tipo)]}`
        : ROT[v.categoria] || "Veículo");
  return (
    <div className={`peca ${v.categoria}${atual ? " atual" : ""}${fantasma ? " fantasma" : ""}`}>
      <div className="peca-corpo">
        <Modelo categoria={v.categoria} tipo={v.tipo} />
        <span className="peca-rot">
          {rot}
          {!rotulo && v.categoria === "carreta" && (
            <>
              {" "}
              <span className="muted">{formato.t(v.capacidade_carga_t)}</span>
            </>
          )}
        </span>
      </div>
      <span className="peca-eixos" aria-hidden="true">
        {Array.from({ length: v.eixos }, (_, i) => (
          <i key={i} />
        ))}
      </span>
      {nota ? <span className="peca-nota">{nota}</span> : <span className="peca-placa">{v.placa}</span>}
      {atual && <span className="sr-only">(este veículo)</span>}
    </div>
  );
}

export const Acoplamento = () => <span className="acoplamento" aria-hidden="true" />;

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
      <Acoplamento />
      <Peca v={v} atual={atual} />
    </>
  );
}
