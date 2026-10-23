"use client";

import { Fragment, useState, type KeyboardEvent, type MouseEvent } from "react";
import { KeyRound, Pencil, Search } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Ponto } from "@/components/Ponto";
import { Sinal } from "@/components/Sinal";
import { AvatarVazio, DialogoAcesso } from "./dialogo-acesso";
import { nomeDe, rotPapel, situacao, type FiltroId, type Situacao, type UsuarioTela } from "./papeis";

type Props = {
  usuarios: UsuarioTela[];
  /** Aba ativa (`?aba=`): todos, ativo, desativado ou sem_acesso. */
  aba: FiltroId;
  /** `user_id` de quem está logado. */
  euId: string;
  /** `?editar=<user_id>`: abre o diálogo desse usuário (o link da auditoria usa). */
  editarId?: string;
};

// quem espera papel vem primeiro: é a única linha que pede uma ação
const ORDEM: Record<Situacao, number> = { sem_acesso: 0, ativo: 1, desativado: 2 };

function SinalSituacao({ s }: { s: Situacao }) {
  if (s === "sem_acesso") return <Sinal tipo="pendente" texto="Sem acesso definido" />;
  if (s === "ativo") return <Sinal situacao="ativo" />;
  return <Sinal tipo="neutro" texto="Desativado" />;
}

/* Lista de usuários (busca no cliente, aba na URL) e o diálogo de acesso. Os dados chegam prontos do
   servidor; depois de gravar, a Server Action revalida a página e a lista se atualiza sozinha. */
export function ListaUsuarios({ usuarios, aba, euId, editarId }: Props) {
  const [termo, setTermo] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(() => (usuarios.some((u) => u.user_id === editarId) ? (editarId ?? null) : null));
  const editando = usuarios.find((u) => u.user_id === editandoId) ?? null;

  const t = termo.trim().toLowerCase();
  const lista = usuarios
    .filter((u) => aba === "todos" || situacao(u) === aba)
    .filter((u) => !t || (u.nome ?? "").toLowerCase().includes(t) || u.email.toLowerCase().includes(t))
    .sort((a, b) => ORDEM[situacao(a)] - ORDEM[situacao(b)]);
  const n = lista.length;

  const abrir = (id: string) => setEditandoId(id);
  const aoClicarLinha = (e: MouseEvent<HTMLTableRowElement>, id: string) => {
    if (!(e.target as HTMLElement).closest("button,a")) abrir(id);
  };
  const aoTeclarLinha = (e: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (e.key === "Enter" && e.target === e.currentTarget) abrir(id);
  };

  return (
    <>
      <div className="ferramentas">
        <div className="busca-lista">
          <Search size={16} strokeWidth={1.6} aria-hidden="true" />
          <input
            id="busca"
            type="search"
            placeholder="Buscar nome ou e-mail"
            aria-label="Buscar nome ou e-mail"
            autoComplete="off"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
          />
        </div>
        <span className="total" id="total" aria-live="polite">
          {n} {n === 1 ? "usuário" : "usuários"}
        </span>
      </div>
      <div className="tabela-wrap">
        <table className="tabela tabela-usuarios">
          <thead>
            <tr>
              <th scope="col">Usuário</th>
              <th scope="col" className="col-papel some-celular">
                Papel
              </th>
              <th scope="col" className="some-celular">
                Situação
              </th>
              <th scope="col" className="num some-celular">
                Último acesso
              </th>
              <th scope="col" className="col-acao">
                <span className="sr-only">Ação</span>
              </th>
            </tr>
          </thead>
          <tbody id="linhas">
            {n === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="vazio-bloco">
                    {t ? `Ninguém com “${termo.trim()}” no nome ou no e-mail.` : "Nenhum usuário nesta situação."}
                  </div>
                </td>
              </tr>
            ) : (
              lista.map((u) => {
                const s = situacao(u);
                const rot = rotPapel(u.papel);
                const nunca = !u.ultimo_acesso;
                return (
                  <tr
                    key={u.user_id}
                    data-usuario={u.user_id}
                    className={s === "desativado" ? "desligado" : undefined}
                    tabIndex={0}
                    onClick={(e) => aoClicarLinha(e, u.user_id)}
                    onKeyDown={(e) => aoTeclarLinha(e, u.user_id)}
                  >
                    <td>
                      <div className="usuario-cel">
                        {u.nome ? <Avatar nome={u.nome} /> : <AvatarVazio />}
                        <div className="txt">
                          <span className="id">
                            {u.nome ?? <span className="sem-nome">Nome ainda não informado</span>}
                            {u.user_id === euId && <span className="voce">(você)</span>}
                          </span>
                          <span className="linha2">
                            {u.email}
                            {rot && (
                              <span className="papel-sub">
                                <Ponto />
                                {rot}
                              </span>
                            )}
                          </span>
                          <span className="linha3 so-celular">
                            <SinalSituacao s={s} />
                            <span>
                              {rot && (
                                <Fragment>
                                  {rot}
                                  <Ponto />
                                </Fragment>
                              )}
                              {u.acesso}
                            </span>
                          </span>
                          {s === "sem_acesso" && (
                            <button className="btn dar-celular so-celular" type="button" onClick={() => abrir(u.user_id)}>
                              Dar acesso
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="papel-col col-papel some-celular">{rot ?? <span className="dash">—</span>}</td>
                    <td className="some-celular">
                      <SinalSituacao s={s} />
                    </td>
                    <td className={`num nowrap some-celular${nunca ? " muted" : ""}`}>{u.acesso}</td>
                    <td className={`acao${s === "sem_acesso" ? " acao-sem" : ""}`}>
                      {s === "sem_acesso" ? (
                        <button className="btn" type="button" onClick={() => abrir(u.user_id)}>
                          <KeyRound size={16} strokeWidth={1.6} className="some-celular-ic" aria-hidden="true" />
                          Dar acesso
                        </button>
                      ) : (
                        <button className="btn" type="button" onClick={() => abrir(u.user_id)} aria-label={`Editar acesso de ${nomeDe(u)}`}>
                          <Pencil size={16} strokeWidth={1.6} className="so-celular-ic" aria-hidden="true" />
                          <span className="some-celular-txt">Editar</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <DialogoAcesso usuario={editando} euId={euId} aoFechar={() => setEditandoId(null)} />
    </>
  );
}
