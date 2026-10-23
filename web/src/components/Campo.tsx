"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { mascaras } from "@/lib/formato";
import { mensagensValidacao, validacao } from "@/lib/validacao";

export type Mascara = keyof typeof mascaras;
export type Valida = keyof typeof mensagensValidacao;

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "children"> & {
  label: ReactNode;
  /** Mostra " (opcional)" depois do rótulo. */
  opcional?: boolean;
  /** Texto de ajuda abaixo do campo (`.ajuda`). */
  ajuda?: ReactNode;
  /** Erro vindo de fora (ex.: resposta da Server Action). Some quando a pessoa edita o campo. */
  erro?: string | null;
  /** Máscara ao digitar: cpf, cnpj, telefone, cep, placa, digitos. */
  mascara?: Mascara;
  /** Validação ao sair do campo: cpf, cnpj, placa (mensagens do protótipo). */
  valida?: Valida;
  /** Classe de largura na grade `.campos` (f2, f3, f4, f6, f8, f12...). */
  classe?: string;
  /** Troca o `<input>` por outro controle (select, textarea): só rótulo, ajuda e erro são do Campo.
     Dê ao controle o `id` passado em `id` (obrigatório nesse caso). */
  controle?: ReactNode;
};

/* Campo de formulário do protótipo (`.campo`): rótulo acima, máscara (`data-mascara`) e validação
   ao vivo (`data-valida`, `montarValidacao` do nilt.js): valida no blur; enquanto inválido, revalida
   a cada tecla; vazio limpa o estado. Funciona sem estado controlado (`defaultValue`) e repassa
   `name` e as demais props ao `<input>`, para o formulário ler tudo com `FormData`. */
export function Campo({
  label,
  opcional,
  ajuda,
  erro,
  mascara,
  valida,
  classe,
  controle,
  id,
  defaultValue,
  onBlur,
  onChange,
  inputMode,
  ...resto
}: Props) {
  const gerado = useId();
  const idCampo = id ?? gerado;
  const ref = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<"neutro" | "valido" | "invalido">("neutro");
  const [erroExterno, setErroExterno] = useState(erro ?? null);
  const [erroAnterior, setErroAnterior] = useState(erro);
  if (erro !== erroAnterior) {
    setErroAnterior(erro);
    setErroExterno(erro ?? null);
  }

  // Descartar (form.reset()) volta o campo ao estado inicial, como o "Descartar" do protótipo.
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const aoResetar = () => {
      setEstado("neutro");
      setErroExterno(null);
    };
    form.addEventListener("reset", aoResetar);
    return () => form.removeEventListener("reset", aoResetar);
  }, []);

  function checar(v: string) {
    if (!valida) return;
    const vazio = valida === "placa" ? !v : !validacao.soDigitos(v);
    if (vazio) return setEstado("neutro");
    setEstado(validacao[valida](v) ? "valido" : "invalido");
  }

  function aoDigitar(e: ChangeEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    if (mascara) el.value = mascara === "placa" ? mascaras.placa(el.value) : validacao.soDigitos(el.value) ? mascaras[mascara](el.value) : "";
    if (erroExterno) setErroExterno(null);
    if (estado === "invalido") checar(el.value);
    onChange?.(e);
  }

  function aoSair(e: FocusEvent<HTMLInputElement>) {
    checar(e.currentTarget.value);
    onBlur?.(e);
  }

  const inicial =
    mascara && typeof defaultValue === "string" && defaultValue
      ? mascara === "placa"
        ? mascaras.placa(defaultValue)
        : mascaras[mascara](defaultValue)
      : defaultValue;

  const msg = estado === "invalido" && valida ? mensagensValidacao[valida] : erroExterno;
  const idErro = `${idCampo}-erro`;

  return (
    <div
      className={`campo${classe ? ` ${classe}` : ""}`}
      data-invalido={estado === "invalido" || erroExterno ? "" : undefined}
      data-valido={estado === "valido" ? "" : undefined}
    >
      <label htmlFor={idCampo}>
        {label}
        {opcional && (
          <>
            {" "}
            <span className="opcional">(opcional)</span>
          </>
        )}
      </label>
      {controle ?? (
        <input
          ref={ref}
          id={idCampo}
          defaultValue={inicial}
          inputMode={inputMode ?? (mascara ? (mascara === "placa" ? "text" : "numeric") : undefined)}
          aria-invalid={estado === "invalido" || erroExterno ? true : estado === "valido" ? false : undefined}
          aria-describedby={msg ? idErro : undefined}
          onChange={aoDigitar}
          onBlur={aoSair}
          {...resto}
        />
      )}
      {ajuda && <span className="ajuda">{ajuda}</span>}
      {msg && (
        <span className="erro" id={idErro}>
          {msg}
        </span>
      )}
    </div>
  );
}
