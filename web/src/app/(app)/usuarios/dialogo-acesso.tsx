"use client";

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Campo } from "@/components/Campo";
import { toast } from "@/components/Toast";
import type { Papel } from "@/lib/papeis";
import { definirPerfil } from "./actions";
import { PAPEIS, rotPapel, type UsuarioTela } from "./papeis";

type Props = {
  /** Quem está sendo editado; `null` = diálogo fechado. */
  usuario: UsuarioTela | null;
  /** `user_id` de quem está logado (o próprio administrador não se rebaixa nem se desativa). */
  euId: string;
  aoFechar: () => void;
};

/** Avatar de quem ainda não tem nome: pontilhado, com "?" (`avatar vazio` do protótipo). */
export function AvatarVazio() {
  return <span className="avatar vazio">?</span>;
}

/* Diálogo "Editar acesso" / "Dar acesso ao NILT" de prototipo/usuarios.html. Não usa o <Dialogo> da Task 5
   porque o cabeçalho tem a linha `.quem` (avatar, nome e e-mail) dentro de `.dialogo-cab`, que o componente
   não deixa preencher. Mesmas classes e mesmo comportamento: showModal, Esc e clique no fundo fecham,
   e o navegador devolve o foco a quem abriu. */
export function DialogoAcesso({ usuario, euId, aoFechar }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const fechar = useRef(aoFechar);
  useEffect(() => {
    fechar.current = aoFechar;
  });

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (usuario && !dlg.open) {
      dlg.showModal();
      dlg.querySelector<HTMLElement>("[data-foco]")?.focus();
    }
    if (!usuario && dlg.open) dlg.close();
  }, [usuario]);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    const aoClose = () => fechar.current();
    dlg.addEventListener("close", aoClose);
    return () => dlg.removeEventListener("close", aoClose);
  }, []);

  return (
    <dialog
      ref={ref}
      className="dialogo"
      id="dlg-acesso"
      aria-labelledby={idTitulo}
      onClick={(e) => {
        if (e.target === ref.current) ref.current.close();
      }}
    >
      {usuario && (
        <FormularioAcesso key={usuario.user_id} u={usuario} euId={euId} idTitulo={idTitulo} fechar={() => ref.current?.close()} />
      )}
    </dialog>
  );
}

function FormularioAcesso({ u, euId, idTitulo, fechar }: { u: UsuarioTela; euId: string; idTitulo: string; fechar: () => void }) {
  const novo = !u.papel;
  const proprio = u.user_id === euId;
  const [ativo, setAtivo] = useState(novo ? true : u.ativo);
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [erroPapel, setErroPapel] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [gravando, startTransition] = useTransition();
  const idAtivo = useId();
  const idAjuda = useId();
  const idErroPapel = useId();

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const dados = new FormData(form);
    const papel = (dados.get("papel") as Papel | null) || null;
    const nome = novo ? String(dados.get("nome") ?? "").trim() : (u.nome ?? "");
    setErroAcao(null);
    const semNome = novo && !nome;
    setErroNome(semNome ? "Digite o nome da pessoa para dar acesso." : null);
    setErroPapel(!papel);
    if (semNome || !papel) {
      form.querySelector<HTMLElement>(semNome ? "input[name=nome]" : "input[name=papel]")?.focus();
      return;
    }

    // Nada de salvaguarda aqui: o banco não deixa o administrador tirar o próprio acesso e a mensagem dele
    // vai para a tela (a tela já desabilita as opções que levariam a isso).
    const mudou: string[] = [];
    if (u.papel !== papel) mudou.push(novo ? `acesso dado como ${rotPapel(papel)}` : `papel: ${rotPapel(u.papel)} → ${rotPapel(papel)}`);
    if (!novo && u.ativo !== ativo) mudou.push(ativo ? "usuário reativado" : "usuário desativado");
    if (!mudou.length) {
      toast("Nada mudou no acesso.", "info");
      fechar();
      return;
    }
    startTransition(async () => {
      const r = await definirPerfil({ userId: u.user_id, nome, papel, ativo });
      if (!r.ok) {
        setErroAcao(r.erro);
        return;
      }
      toast(novo ? `${nome} agora entra no NILT como ${rotPapel(papel)}.` : `Acesso de ${nome} atualizado: ${mudou.join(", ")}.`);
      fechar();
    });
  }

  return (
    <form id="form-acesso" noValidate onSubmit={aoEnviar}>
      <div className="dialogo-cab">
        <h2 id={idTitulo}>{novo ? "Dar acesso ao NILT" : `Acesso de ${u.nome}`}</h2>
        <div className="quem">
          {u.nome ? <Avatar nome={u.nome} /> : <AvatarVazio />}
          <div>
            <b>{u.nome ?? "Conta criada no Supabase"}</b>
            <span className="email">{u.email}</span>
          </div>
        </div>
      </div>
      <div className="dialogo-corpo">
        {proprio && (
          <div className="aviso aviso-info" id="dlg-proprio">
            <ShieldCheck size={16} strokeWidth={1.6} aria-hidden="true" />
            <p>
              Você não pode tirar o seu próprio acesso de administrador nem se desativar. Se fizesse isso, o NILT poderia ficar sem ninguém
              para dar acesso às pessoas. Outro administrador pode mudar o seu papel.
            </p>
          </div>
        )}
        {novo && (
          <Campo
            label="Nome que aparece no NILT"
            name="nome"
            id="dlg-nome"
            type="text"
            autoComplete="off"
            maxLength={60}
            defaultValue={u.nome ?? ""}
            ajuda="O Supabase guarda só o e-mail. Use o nome pelo qual a equipe chama a pessoa."
            erro={erroNome}
            data-foco=""
          />
        )}
        <fieldset className="papeis" id="dlg-papeis" aria-describedby={erroPapel ? idErroPapel : undefined}>
          <legend>Papel</legend>
          {PAPEIS.map((p) => (
            <label className="papel-opcao" key={p.id}>
              <input
                type="radio"
                name="papel"
                value={p.id}
                defaultChecked={u.papel === p.id}
                disabled={proprio && p.id !== "admin"}
                onChange={() => setErroPapel(false)}
                {...(u.papel === p.id ? { "data-foco": "" } : {})}
              />
              <span>
                <b>{p.rot}</b>
                <span className="o-que">{p.o_que}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {erroPapel && (
          <span className="erro small" id={idErroPapel} role="alert" style={{ color: "var(--vermelho-tinta)" }}>
            Escolha um papel para dar acesso.
          </span>
        )}
        <div className="chave-linha">
          <div>
            <label htmlFor={idAtivo}>Acesso ativo</label>
            <span className="ajuda" id={idAjuda}>
              Desativado, a pessoa não entra no NILT. O que ela fez continua na auditoria.
            </span>
          </div>
          <input
            id={idAtivo}
            className="chave"
            type="checkbox"
            role="switch"
            aria-describedby={idAjuda}
            checked={ativo}
            disabled={proprio}
            onChange={(e) => setAtivo(e.target.checked)}
          />
        </div>
        {erroAcao && (
          <div className="aviso aviso-bloqueado" role="alert">
            <p>{erroAcao}</p>
          </div>
        )}
      </div>
      <div className="dialogo-pe">
        <button className="btn" type="button" onClick={fechar}>
          Cancelar
        </button>
        <button className="btn btn-primario" type="submit" disabled={gravando} aria-busy={gravando}>
          {novo ? "Dar acesso" : "Salvar"}
        </button>
      </div>
    </form>
  );
}
