"use client";

import type { ReactNode } from "react";
import { Campo } from "@/components/Campo";
import { num } from "../rotulos";

/* Peças de formulário da ficha: seção, campos de texto/número/data, select, radios e textarea.
   Todos não controlados (`name` + `defaultValue`), lidos com `FormData` pela Server Action. */

export type Erros = Record<string, string>;

export function Secao({ id, titulo, texto, children }: { id: string; titulo: string; texto: ReactNode; children: ReactNode }) {
  return (
    <section className="secao" aria-labelledby={id}>
      <div className="secao-rotulo">
        <h2 id={id}>{titulo}</h2>
        {texto}
      </div>
      <div className="campos">{children}</div>
    </section>
  );
}

type TextoProps = {
  nome: string;
  classe: string;
  rotulo: string;
  valor: string | number | null | undefined;
  erros: Erros;
  opcional?: boolean;
  ajuda?: ReactNode;
  /** Classe do input (`cod` para códigos, `num` para números). */
  entrada?: string;
  maxLength?: number;
  inputMode?: "numeric" | "decimal" | "text";
  tipo?: "text" | "date";
  mascara?: "placa";
  valida?: "placa";
};

/** Campo de uma linha (texto, código, número ou data). */
export function CampoTexto({ nome, classe, rotulo, valor, erros, opcional, ajuda, entrada, maxLength, inputMode, tipo, mascara, valida }: TextoProps) {
  return (
    <Campo
      id={nome}
      name={nome}
      classe={classe}
      label={rotulo}
      opcional={opcional}
      ajuda={ajuda}
      erro={erros[nome]}
      defaultValue={valor == null ? "" : String(valor)}
      className={entrada}
      maxLength={maxLength}
      inputMode={inputMode}
      type={tipo}
      mascara={mascara}
      valida={valida}
      autoComplete="off"
    />
  );
}

/** Número com vírgula (`numero` do protótipo): `casas` fixas, teclado decimal. */
export function CampoNumero({ casas = 1, valor, ...p }: Omit<TextoProps, "valor" | "entrada" | "inputMode"> & { casas?: number; valor: number | null | undefined }) {
  return <CampoTexto {...p} valor={num(valor, casas)} entrada="num" inputMode="decimal" />;
}

type SelectProps = {
  nome: string;
  classe: string;
  rotulo: string;
  /** [valor, rótulo] ou grupos `{ grupo, itens }`. */
  opcoes: [string | number, string][] | { grupo: string; itens: [string | number, string][] }[];
  valor: string | number | null | undefined;
  erros: Erros;
  /** Texto da opção vazia; sem ele a lista não tem opção em branco. */
  vazio?: string;
  opcional?: boolean;
  ajuda?: ReactNode;
  desabilitado?: boolean;
};

export function CampoSelect({ nome, classe, rotulo, opcoes, valor, erros, vazio, opcional, ajuda, desabilitado }: SelectProps) {
  const ajudaId = ajuda ? `${nome}-ajuda` : undefined;
  const erroId = erros[nome] ? `${nome}-erro` : undefined;
  const opcao = ([k, r]: [string | number, string]) => (
    <option key={k} value={k}>
      {r}
    </option>
  );
  return (
    <Campo
      id={nome}
      classe={classe}
      label={rotulo}
      opcional={opcional}
      ajuda={ajuda}
      erro={erros[nome]}
      controle={
        <select
          id={nome}
          name={nome}
          defaultValue={valor == null ? "" : String(valor)}
          disabled={desabilitado}
          aria-describedby={[ajudaId, erroId].filter(Boolean).join(" ") || undefined}
          aria-invalid={erros[nome] ? true : undefined}
        >
          {vazio != null && <option value="">{vazio}</option>}
          {opcoes.map((o) =>
            "grupo" in o ? (
              <optgroup key={o.grupo} label={o.grupo}>
                {o.itens.map(opcao)}
              </optgroup>
            ) : (
              opcao(o)
            ),
          )}
        </select>
      }
    />
  );
}

/** Texto longo (observação). */
export function CampoLongo({ nome, rotulo, valor, erros, opcional }: { nome: string; rotulo: string; valor: string | null | undefined; erros: Erros; opcional?: boolean }) {
  return (
    <Campo
      id={nome}
      classe="f12"
      label={rotulo}
      opcional={opcional}
      erro={erros[nome]}
      controle={<textarea id={nome} name={nome} defaultValue={valor ?? ""} aria-invalid={erros[nome] ? true : undefined} />}
    />
  );
}

/** Escolha entre poucas opções (`radios` do protótipo). */
export function Radios({
  nome,
  rotulo,
  opcoes,
  valor,
  erros,
}: {
  nome: string;
  rotulo: string;
  opcoes: [string, string][];
  valor: string;
  erros: Erros;
}) {
  return (
    <div className="campo f12" role="radiogroup" aria-label={rotulo} data-invalido={erros[nome] ? "" : undefined}>
      <span className="rotulo">{rotulo}</span>
      <div className="opcoes">
        {opcoes.map(([k, r]) => (
          <label className="opcao" key={k}>
            <input type="radio" name={nome} value={k} defaultChecked={k === valor} />
            <span>{r}</span>
          </label>
        ))}
      </div>
      {erros[nome] && <span className="erro">{erros[nome]}</span>}
    </div>
  );
}
