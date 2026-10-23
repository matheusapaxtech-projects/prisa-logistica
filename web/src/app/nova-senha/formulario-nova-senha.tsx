"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { CircleAlert, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { definirNovaSenha, type EstadoNovaSenha } from "./actions";
import { SENHA_MINIMO, validarNovaSenha, type ErrosNovaSenha } from "./regras";

// Mesma marcação e classes do formulário de entrada (prototipo/login.html).
export function FormularioNovaSenha({ email }: { email: string | null }) {
  const [estado, enviar, enviando] = useActionState<EstadoNovaSenha, FormData>(definirNovaSenha, null);
  const [erros, setErros] = useState<ErrosNovaSenha>({});
  // Resposta do servidor que a pessoa já "dispensou" ao voltar a digitar.
  const [dispensado, setDispensado] = useState<EstadoNovaSenha>(null);
  const [mostrar, setMostrar] = useState(false);
  const senhaRef = useRef<HTMLInputElement>(null);
  const confirmacaoRef = useRef<HTMLInputElement>(null);

  const erroGeral = estado !== dispensado ? estado?.erro : undefined;
  const campos: ErrosNovaSenha =
    erros.senha || erros.confirmacao ? erros : estado !== dispensado ? (estado?.campos ?? {}) : {};

  useEffect(() => {
    senhaRef.current?.focus();
  }, []);

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    // Envio manual (sem <form action>): o React não limpa os campos depois da action.
    e.preventDefault();
    if (enviando) return;
    setDispensado(estado);
    const dados = new FormData(e.currentTarget);
    const novos = validarNovaSenha(String(dados.get("senha") ?? ""), String(dados.get("confirmacao") ?? ""));
    setErros(novos);
    if (novos.senha) return senhaRef.current?.focus();
    if (novos.confirmacao) return confirmacaoRef.current?.focus();
    startTransition(() => enviar(dados));
  }

  function aoDigitar() {
    setDispensado(estado);
    if (erros.senha || erros.confirmacao) setErros({});
  }

  return (
    <form id="form-nova-senha" noValidate onSubmit={aoEnviar}>
      {/* Para o gerenciador de senhas saber de qual conta é a senha nova. */}
      {email ? <input type="email" name="usuario" autoComplete="username" value={email} readOnly hidden /> : null}

      <div className="campo" id="c-senha" data-invalido={campos.senha ? "" : undefined}>
        <label htmlFor="senha">Senha nova</label>
        <div className="com-acao">
          <input
            ref={senhaRef}
            id="senha"
            name="senha"
            type={mostrar ? "text" : "password"}
            autoComplete="new-password"
            aria-describedby="senha-ajuda senha-erro"
            aria-invalid={campos.senha ? true : undefined}
            onInput={aoDigitar}
          />
          <button
            className="btn"
            type="button"
            id="btn-ver"
            aria-label={mostrar ? "Ocultar senhas" : "Mostrar senhas"}
            aria-pressed={mostrar}
            title={mostrar ? "Ocultar senhas" : "Mostrar senhas"}
            onClick={() => {
              setMostrar(!mostrar);
              senhaRef.current?.focus();
            }}
          >
            {mostrar ? <EyeOff /> : <Eye />}
          </button>
        </div>
        <span className="ajuda" id="senha-ajuda" hidden={Boolean(campos.senha)}>
          Pelo menos {SENHA_MINIMO} caracteres.
        </span>
        <span className="erro" id="senha-erro" hidden={!campos.senha}>
          <CircleAlert />
          <span>{campos.senha}</span>
        </span>
      </div>

      <div className="campo" id="c-confirmacao" data-invalido={campos.confirmacao ? "" : undefined}>
        <label htmlFor="confirmacao">Repita a senha nova</label>
        <input
          ref={confirmacaoRef}
          id="confirmacao"
          name="confirmacao"
          type={mostrar ? "text" : "password"}
          autoComplete="new-password"
          aria-describedby="confirmacao-erro"
          aria-invalid={campos.confirmacao ? true : undefined}
          onInput={aoDigitar}
        />
        <span className="erro" id="confirmacao-erro" hidden={!campos.confirmacao}>
          <CircleAlert />
          <span>{campos.confirmacao}</span>
        </span>
      </div>

      <div className="aviso aviso-bloqueado" id="erro-nova-senha" role="alert" hidden={!erroGeral}>
        <CircleAlert />
        <p>{erroGeral}</p>
      </div>

      <button
        className={`btn btn-primario btn-entrar${enviando ? " carregando" : ""}`}
        type="submit"
        id="btn-salvar-senha"
        aria-busy={enviando || undefined}
      >
        <LoaderCircle className="giro" />
        <span>{enviando ? "Salvando…" : "Salvar senha nova"}</span>
      </button>

      <Link className="btn btn-texto" href="/" style={{ justifySelf: "center" }}>
        Voltar sem trocar
      </Link>
    </form>
  );
}
