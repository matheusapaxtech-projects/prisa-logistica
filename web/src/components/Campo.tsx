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

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "children" | "value"> & {
  label: ReactNode;
  /** Mostra " (opcional)" depois do rótulo. */
  opcional?: boolean;
  /** Texto de ajuda abaixo do campo (`.ajuda`), ligado ao input por `aria-describedby`. */
  ajuda?: ReactNode;
  /** Erro vindo de fora (ex.: resposta da Server Action). Some quando a pessoa edita o campo. */
  erro?: string | null;
  /** Máscara ao digitar: cpf, cnpj, telefone, cep, placa, digitos. */
  mascara?: Mascara;
  /** Validação ao sair do campo: cpf, cnpj, placa (mensagens do protótipo). */
  valida?: Valida;
  /** Classe de largura na grade `.campos` (f2, f3, f4, f6, f8, f12...). */
  classe?: string;
  /** Troca o `<input>` por outro controle (select, textarea). Com `controle`:
     - passe `id` e dê o mesmo `id` ao controle (o rótulo aponta para ele);
     - `mascara` e `valida` não se aplicam (em desenvolvimento, o Campo lança um erro se vierem juntos);
     - o erro externo some quando o controle muda e o `form.reset()` limpa o estado, como no input;
     - `aria-describedby` do controle fica com quem o escreve: use `${id}-ajuda` e `${id}-erro`. */
  controle?: ReactNode;
};

/* Campo de formulário do protótipo (`.campo`): rótulo acima, máscara (`data-mascara`) e validação
   ao vivo (`data-valida`, `montarValidacao` do nilt.js): valida no blur; enquanto inválido, revalida
   a cada tecla; vazio limpa o estado.
   O Campo é NÃO CONTROLADO: valor inicial em `defaultValue` (já sai mascarado); `value` não é aceito
   (é descartado se vier). Repassa `name` e as demais props ao `<input>`, para o formulário ler tudo
   com `FormData`; `form.reset()` ("Descartar") volta o valor e limpa erro/validação. */
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
  "aria-describedby": descritoPor,
  ...resto
}: Props) {
  if (controle && process.env.NODE_ENV !== "production") {
    if (mascara || valida) throw new Error("Campo: `mascara` e `valida` não funcionam com `controle`.");
    if (!id) throw new Error("Campo: com `controle`, passe o `id` do controle.");
  }
  // Não controlado: um `value` que escape do tipo é descartado (senão o React travaria o campo).
  delete (resto as { value?: unknown }).value;

  const gerado = useId();
  const idCampo = id ?? gerado;
  const caixa = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<"neutro" | "valido" | "invalido">("neutro");
  const [erroExterno, setErroExterno] = useState(erro ?? null);
  const [erroAnterior, setErroAnterior] = useState(erro);
  if (erro !== erroAnterior) {
    setErroAnterior(erro);
    setErroExterno(erro ?? null);
  }

  // Descartar (form.reset()) volta o campo ao estado inicial, como o "Descartar" do protótipo.
  // O formulário é achado pela caixa do campo: vale também para `controle`.
  useEffect(() => {
    const form = caixa.current?.closest("form");
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
    if (mascara)
      el.value =
        mascara === "placa"
          ? mascaras.placa(el.value)
          : validacao.soDigitos(el.value)
            ? mascaras[mascara](el.value)
            : "";
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
  const idAjuda = `${idCampo}-ajuda`;
  const idErro = `${idCampo}-erro`;
  const descricao = [descritoPor, ajuda ? idAjuda : null, msg ? idErro : null].filter(Boolean).join(" ") || undefined;

  return (
    <div
      ref={caixa}
      className={`campo${classe ? ` ${classe}` : ""}`}
      data-invalido={estado === "invalido" || erroExterno ? "" : undefined}
      data-valido={estado === "valido" ? "" : undefined}
      // Qualquer edição (input, select, textarea) apaga o erro que veio do servidor.
      onInput={() => erroExterno && setErroExterno(null)}
      onChange={() => erroExterno && setErroExterno(null)}
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
          id={idCampo}
          defaultValue={inicial}
          inputMode={inputMode ?? (mascara ? (mascara === "placa" ? "text" : "numeric") : undefined)}
          aria-invalid={estado === "invalido" || erroExterno ? true : estado === "valido" ? false : undefined}
          aria-describedby={descricao}
          onChange={aoDigitar}
          onBlur={aoSair}
          {...resto}
        />
      )}
      {ajuda && (
        <span className="ajuda" id={idAjuda}>
          {ajuda}
        </span>
      )}
      {msg && (
        <span className="erro" id={idErro}>
          {msg}
        </span>
      )}
    </div>
  );
}
