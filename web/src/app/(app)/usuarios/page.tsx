import { Fragment } from "react";
import type { Metadata } from "next";
import { Info } from "lucide-react";
import { Abas } from "@/components/Abas";
import { Ponto } from "@/components/Ponto";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import "@/styles/paginas/admin.css";
import { listarUsuarios } from "./consultas";
import { ListaUsuarios } from "./lista-usuarios";
import { FILTROS, PAPEIS, ehFiltro, situacao } from "./papeis";

export const metadata: Metadata = { title: "Usuários" };

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

type Props = { searchParams: Promise<{ aba?: string; editar?: string }> };

export default async function Usuarios({ searchParams }: Props) {
  const perfil = await getPerfil();

  // Só o administrador vê esta tela; para os demais nem se pede a lista (a função do banco recusaria).
  if (!perfil || !pode(perfil, "admin")) {
    return (
      <main>
        <div className="titulo">
          <div>
            <h1>Usuários</h1>
          </div>
        </div>
        <div id="conteudo">
          <div className="vazio-bloco">Só o administrador vê esta tela. Peça a ele se precisar mudar um acesso.</div>
        </div>
      </main>
    );
  }

  const { aba: abaPedida, editar } = await searchParams;
  const aba = ehFiltro(abaPedida) ? abaPedida : "todos";
  const usuarios = await listarUsuarios(await createClient());

  const c = { todos: usuarios.length, ativo: 0, desativado: 0, sem_acesso: 0 };
  for (const u of usuarios) c[situacao(u)]++;
  const partes = [`${plural(c.todos, "pessoa", "pessoas")} com conta`, plural(c.ativo, "ativa", "ativas")];
  if (c.sem_acesso) partes.push(`${c.sem_acesso} esperando papel`);

  return (
    <main>
      <div className="titulo">
        <div>
          <h1>Usuários</h1>
          <p className="sub" id="achado">
            {partes.map((t, i) => (
              <Fragment key={i}>
                {i > 0 && <Ponto />}
                {t}
              </Fragment>
            ))}
          </p>
        </div>
      </div>

      <div className="aviso aviso-info aviso-topo" role="note">
        <Info size={16} strokeWidth={1.6} aria-hidden="true" />
        <div>
          <p>
            Pessoas novas são criadas no painel do Supabase, em <span className="caminho">Authentication → Users → Add user</span>. Depois
            disso elas aparecem aqui como “Sem acesso definido”, e você escolhe o papel.
          </p>
        </div>
      </div>

      <div id="conteudo">
        <Abas abas={FILTROS.map((f) => ({ id: f.id, rotulo: f.rotulo, n: c[f.id] }))} ativa={aba} rotulo="Filtrar por situação" />
        <ListaUsuarios usuarios={usuarios} aba={aba} euId={perfil.userId} editarId={editar} />

        <section className="papeis-ref" aria-labelledby="h-papeis">
          <h2 id="h-papeis">O que cada papel pode fazer</h2>
          <p>A regra vale no banco: mesmo quem tenta por fora da tela não passa do que o papel permite.</p>
          <dl className="papeis-lista" id="papeis-lista">
            {PAPEIS.map((p) => {
              const n = usuarios.filter((u) => u.papel === p.id && u.ativo).length;
              return (
                <div key={p.id}>
                  <dt>
                    {p.rot}
                    <span>{plural(n, "ativo", "ativos")}</span>
                  </dt>
                  <dd>{p.o_que}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      </div>
    </main>
  );
}
