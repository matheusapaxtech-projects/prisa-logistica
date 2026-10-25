"use client";

/* Pedaços da calculadora usados pela carga única e pelo lote: leitura de números digitados, campos com
   unidade, cidade com a lista de municípios, escolhas em pílula e a forma do veredito. */
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { formato, lerNumeroBr } from "@/lib/formato";
import type { acharMunicipio } from "@/lib/calculadora/rota";

export const campo = (n: number | null | undefined, casas = 2) => formato.numeroCampo(n, casas);
/** Texto pt-BR → número; vazio ou inválido = 0 (o campo mostra o erro). */
export const num = (s: string | null | undefined) => {
  const v = lerNumeroBr(s);
  return v === null || Number.isNaN(v) ? 0 : v;
};
export const invalido = (s: string | null | undefined) => Number.isNaN(lerNumeroBr(s) ?? 0);

export function CabSecao({ id, titulo, children }: { id: string; titulo: string; children?: ReactNode }) {
  return (
    <div className="calc-cab">
      <h2 id={id}>{titulo}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}

export function CampoNumero({
  id,
  rotulo,
  valor,
  aoMudar,
  unidade,
  ajuda,
  classe,
  opcional,
  placeholder,
}: {
  id: string;
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  unidade?: string;
  ajuda?: ReactNode;
  classe: string;
  opcional?: boolean;
  placeholder?: string;
}) {
  const ruim = invalido(valor);
  return (
    <div className={`campo ${classe}`} data-invalido={ruim || undefined}>
      <label htmlFor={id}>
        {rotulo}
        {opcional && <span className="opcional"> (opcional)</span>}
      </label>
      <div className={unidade ? "calc-unidade" : undefined}>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          value={valor}
          onChange={(ev) => aoMudar(ev.target.value)}
          aria-invalid={ruim || undefined}
          aria-describedby={ajuda || ruim ? `${id}-ajuda` : undefined}
        />
        {unidade && <span aria-hidden="true">{unidade}</span>}
      </div>
      {ruim ? (
        <span className="erro" id={`${id}-ajuda`}>
          Número inválido: use vírgula nos centavos, como 1.234,56.
        </span>
      ) : (
        ajuda && (
          <span className="ajuda" id={`${id}-ajuda`}>
            {ajuda}
          </span>
        )
      )}
    </div>
  );
}

export function CampoCidade({
  id,
  rotulo,
  valor,
  aoMudar,
  busca,
  carregando,
  remover,
}: {
  id: string;
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  busca: ReturnType<typeof acharMunicipio> | undefined;
  carregando: boolean;
  remover?: () => void;
}) {
  const vazio = valor.trim() === "";
  const problema =
    carregando || vazio || busca?.municipio
      ? null
      : busca && busca.ambiguos > 1
        ? `Há ${busca.ambiguos} cidades com esse nome: escolha a da UF certa na lista.`
        : "Cidade não encontrada: escolha da lista ou digite o km.";
  return (
    <div className="campo f6" data-invalido={problema ? true : undefined}>
      <label htmlFor={id}>{rotulo}</label>
      <div className={remover ? "com-acao" : undefined}>
        <input
          id={id}
          list="municipios"
          autoComplete="off"
          placeholder="Digite a cidade"
          value={valor}
          onChange={(ev) => aoMudar(ev.target.value)}
          aria-describedby={problema ? `${id}-erro` : undefined}
        />
        {remover && (
          <button type="button" className="btn" onClick={remover} aria-label={`Remover ${rotulo.toLowerCase()}`}>
            <X size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        )}
      </div>
      {problema && (
        <span className="erro" id={`${id}-erro`}>
          {problema}
        </span>
      )}
    </div>
  );
}

export function Escolha({ rotuloId, opcoes, valor, aoMudar }: { rotuloId: string; opcoes: [string, string][]; valor: string; aoMudar: (v: string) => void }) {
  return (
    <div className="calc-opcoes" role="group" aria-labelledby={rotuloId}>
      {opcoes.map(([v, r]) => (
        <button key={v} type="button" aria-pressed={v === valor} onClick={() => aoMudar(v)}>
          {r}
        </button>
      ))}
    </div>
  );
}

/** Forma do veredito (Regra Forma + Cor): retângulo, losango, círculo vazado; ponto quando faltam dados. */
export const FORMA: Record<"contratar" | "negociar" | "ajustar" | "nao_contratar" | "incompleto", ReactNode> = {
  contratar: <rect x="4" y="8" width="22" height="14" rx="2" fill="currentColor" />,
  negociar: <rect x="8" y="8" width="14" height="14" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2.5" transform="rotate(45 15 15)" />,
  ajustar: <rect x="8" y="8" width="14" height="14" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2.5" transform="rotate(45 15 15)" />,
  nao_contratar: <circle cx="15" cy="15" r="10" fill="none" stroke="currentColor" strokeWidth="3" />,
  incompleto: <circle cx="15" cy="15" r="4" fill="currentColor" />,
};

