"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { CircleAlert, Eye, EyeOff, KeyRound, LoaderCircle } from "lucide-react";
import { entrar, type EstadoEntrada } from "./actions";
import { emailValido, validarEntrada, type ErrosEntrada } from "./regras";

// Porta do formulário de prototipo/login.html: mesma marcação, classes e textos.
export function FormularioEntrar() {
  const [estado, enviar, enviando] = useActionState<EstadoEntrada, FormData>(entrar, null);
  const [erros, setErros] = useState<ErrosEntrada>({});
  // Resposta do servidor que a pessoa já "dispensou" ao voltar a digitar.
  const [dispensado, setDispensado] = useState<EstadoEntrada>(null);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [capsLigado, setCapsLigado] = useState(false);
  const [esqueciAberto, setEsqueciAberto] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const senhaRef = useRef<HTMLInputElement>(null);

  const erroGeral = estado !== dispensado ? estado?.erro : undefined;
  const campos: ErrosEntrada =
    erros.email || erros.senha ? erros : estado !== dispensado ? (estado?.campos ?? {}) : {};

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  // Credencial errada: como no protótipo, a senha fica selecionada para redigitar.
  useEffect(() => {
    if (estado?.erro) {
      senhaRef.current?.select();
      senhaRef.current?.focus();
    }
  }, [estado]);

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    // Envio manual (sem <form action>): o React não limpa os campos depois da action.
    e.preventDefault();
    if (enviando) return;
    setDispensado(estado);
    const dados = new FormData(e.currentTarget);
    const novos = validarEntrada(String(dados.get("email") ?? "").trim(), String(dados.get("senha") ?? ""));
    setErros(novos);
    if (novos.email) return emailRef.current?.focus();
    if (novos.senha) return senhaRef.current?.focus();
    startTransition(() => enviar(dados));
  }

  return (
    <form id="form-entrar" noValidate onSubmit={aoEnviar}>
      <div className="campo" id="c-email" data-invalido={campos.email ? "" : undefined}>
        <label htmlFor="email">E-mail</label>
        <input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          spellCheck={false}
          autoCapitalize="off"
          aria-describedby="email-erro"
          aria-invalid={campos.email ? true : undefined}
          onInput={(e) => {
            setDispensado(estado);
            if (erros.email && emailValido(e.currentTarget.value.trim())) setErros({ ...erros, email: undefined });
          }}
        />
        <span className="erro" id="email-erro" hidden={!campos.email}>
          <CircleAlert />
          <span>{campos.email}</span>
        </span>
      </div>

      <div className="campo" id="c-senha" data-invalido={campos.senha ? "" : undefined}>
        <div className="rotulo-linha">
          <label htmlFor="senha">Senha</label>
          <button
            className="btn btn-texto"
            type="button"
            id="btn-esqueci"
            aria-expanded={esqueciAberto}
            aria-controls="esqueci"
            onClick={() => setEsqueciAberto(!esqueciAberto)}
          >
            Esqueci minha senha
          </button>
        </div>
        <div className="com-acao">
          <input
            ref={senhaRef}
            id="senha"
            name="senha"
            type={mostrarSenha ? "text" : "password"}
            autoComplete="current-password"
            aria-describedby="senha-erro senha-caps"
            aria-invalid={campos.senha ? true : undefined}
            onInput={(e) => {
              setDispensado(estado);
              if (erros.senha && e.currentTarget.value) setErros({ ...erros, senha: undefined });
            }}
            onKeyDown={(e) => setCapsLigado(e.getModifierState("CapsLock"))}
            onKeyUp={(e) => setCapsLigado(e.getModifierState("CapsLock"))}
            onBlur={() => setCapsLigado(false)}
          />
          <button
            className="btn"
            type="button"
            id="btn-ver"
            aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={mostrarSenha}
            title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => {
              setMostrarSenha(!mostrarSenha);
              senhaRef.current?.focus();
            }}
          >
            {mostrarSenha ? <EyeOff /> : <Eye />}
          </button>
        </div>
        <span className="ajuda" id="senha-caps" hidden={!capsLigado}>
          Caps Lock ligado: a senha diferencia maiúsculas.
        </span>
        <span className="erro" id="senha-erro" hidden={!campos.senha}>
          <CircleAlert />
          <span>{campos.senha}</span>
        </span>
      </div>

      <div className="aviso aviso-info" id="esqueci" hidden={!esqueciAberto}>
        <KeyRound />
        <p>
          Quem redefine a senha é o administrador do NILT. Peça a ele: pelo painel do Supabase ele manda para o seu
          e-mail um link para você criar uma senha nova.
        </p>
      </div>

      <div className="aviso aviso-bloqueado" id="erro-entrar" role="alert" hidden={!erroGeral}>
        <CircleAlert />
        <p>{erroGeral}</p>
      </div>

      <button
        className={`btn btn-primario btn-entrar${enviando ? " carregando" : ""}`}
        type="submit"
        id="btn-entrar"
        aria-busy={enviando || undefined}
      >
        <LoaderCircle className="giro" />
        <span>{enviando ? "Entrando…" : "Entrar"}</span>
      </button>
    </form>
  );
}
