import { Fragment } from "react";
import type { Metadata } from "next";
import { Info } from "lucide-react";
import { Abas } from "@/components/Abas";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Ponto } from "@/components/Ponto";
import { tipado } from "@/lib/banco";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { contasAbertasPorCentro, listarCentros } from "./consultas";
import { BotaoNovoCentro } from "./dialogo-centro";
import { ListaCentros } from "./lista-centros";
import { FILTROS, ROTULO_FILTRO, lerFiltro, montarArvore } from "./regras";
import "@/styles/paginas/proprietarios.css";
import "@/styles/paginas/centros.css";

export const metadata: Metadata = { title: "Centros de custo" };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const plural = (n: number, a: string, b: string) => `${n} ${n === 1 ? a : b}`;

function SemAcesso() {
  return (
    <main className="prop centros">
      <div className="titulo">
        <div>
          <h1>Centros de custo</h1>
        </div>
      </div>
      <EstadoVazio>Os centros de custo são vistos pelo administrador e pelo financeiro. Se você precisa deles, peça o acesso ao administrador.</EstadoVazio>
    </main>
  );
}

/* Centros de custo: a árvore de departamentos (00) e subdepartamentos (00.00) que toda despesa, receita e funcionário
   carrega. Admin e financeiro veem; só o administrador cria, renomeia e desativa. Aba por `?filtro=ativos|todos`. */
export default async function CentrosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const perfil = await getPerfil();
  if (!perfil || !pode(perfil, "financeiro")) return <SemAcesso />;

  const admin = pode(perfil, "admin");
  const filtro = lerFiltro(um(sp.filtro));
  const db = tipado(await createClient());
  const [centros, uso] = await Promise.all([listarCentros(db), contasAbertasPorCentro(db)]);

  const ativos = centros.filter((c) => c.ativo).length;
  const contagens = { ativos, todos: centros.length };
  const arvore = montarArvore(centros, filtro);
  const departamentos = centros.filter((c) => !c.codigo.includes(".")).length;
  const achado = [plural(departamentos, "departamento", "departamentos"), plural(ativos, "centro ativo", "centros ativos")];

  return (
    <main className="prop centros">
      <div className="titulo titulo-inicio">
        <div>
          <h1>Centros de custo</h1>
          <p className="sub" id="achado">
            {achado.map((t, i) => (
              <Fragment key={i}>
                {i > 0 && <Ponto />}
                {t}
              </Fragment>
            ))}
          </p>
        </div>
        {admin && (
          <div className="acoes">
            <BotaoNovoCentro codigos={centros.map((c) => c.codigo)} />
          </div>
        )}
      </div>

      <p className="centros-regra">Cada despesa, receita e funcionário leva um centro de custo. O código não muda: para corrigir, renomeie ou desative.</p>
      {!admin && (
        <div className="aviso aviso-info aviso-topo" role="note">
          <Info size={16} strokeWidth={1.6} aria-hidden="true" />
          <p>Só o administrador cria, renomeia e desativa centros de custo.</p>
        </div>
      )}

      <Abas
        rotulo="Situação dos centros"
        ativa={filtro}
        abas={FILTROS.map((f) => ({ id: f, rotulo: ROTULO_FILTRO[f], n: contagens[f], href: f === "ativos" ? "/centros-de-custo" : `/centros-de-custo?filtro=${f}` }))}
      />

      <ListaCentros
        arvore={arvore}
        uso={[...uso]}
        admin={admin}
        vazio={filtro === "ativos" ? "Nenhum centro de custo ativo." : "Nenhum centro de custo cadastrado."}
      />
    </main>
  );
}
