import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Ponto } from "@/components/Ponto";
import { tipado } from "@/lib/banco";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { listarMotoristas, type LinhaMotorista } from "./consultas";
import { ListaMotoristas, type AbaLista } from "./lista-motoristas";
import "@/styles/paginas/motoristas.css";

export const metadata: Metadata = { title: "Motoristas" };

const ABAS: readonly AbaLista[] = ["todos", "normal", "pendente", "documentos", "cancelado"];
const FILTROS_GR = ["habilitado", "vencendo", "vencido", "sem_consulta"];

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** "8 motoristas cadastrados · 1 CNH vencida · …": o fato da lista que pede atenção (`#achado`). */
function achado(linhas: LinhaMotorista[]): string[] {
  const ativos = linhas.filter((l) => l.situacao !== "cancelado");
  const cnhVenc = ativos.filter((l) => l.cnh.cls === "vencido").length;
  const cnhVencendo = ativos.filter((l) => l.cnh.cls === "vencendo").length;
  const grAtencao = ativos.filter((l) => l.gr.chave === "vencendo" || l.gr.chave === "vencido").length;
  const partes: string[] = [];
  if (cnhVenc) partes.push(`${cnhVenc} ${cnhVenc === 1 ? "CNH vencida" : "CNHs vencidas"}`);
  if (cnhVencendo) partes.push(`${cnhVencendo} ${cnhVencendo === 1 ? "CNH vence" : "CNHs vencem"} em até 30 dias`);
  if (grAtencao)
    partes.push(`${grAtencao} ${grAtencao === 1 ? "consulta de risco vence" : "consultas de risco vencem"} em até 30 dias`);
  return [`${linhas.length} ${linhas.length === 1 ? "motorista cadastrado" : "motoristas cadastrados"}`, ...(partes.length ? partes : ["nenhum documento vencendo"])];
}

export default async function MotoristasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const [perfil, linhas] = await Promise.all([getPerfil(), listarMotoristas(tipado(await createClient()))]);
  const situacao = um(sp.situacao);
  const gr = um(sp.gr);

  return (
    <main>
      <div className="titulo">
        <div>
          <h1>Motoristas</h1>
          <p className="sub">
            {achado(linhas).map((t, i) => (
              <Fragment key={i}>
                {i > 0 && <Ponto />}
                {t}
              </Fragment>
            ))}
          </p>
        </div>
        {pode(perfil, "editar") && (
          <div className="acoes">
            <Link className="btn btn-primario" href="/motoristas/novo">
              <Plus size={16} strokeWidth={1.6} aria-hidden="true" />
              Novo motorista
            </Link>
          </div>
        )}
      </div>
      <ListaMotoristas
        linhas={linhas}
        aba={(ABAS as readonly string[]).includes(situacao) ? (situacao as AbaLista) : "todos"}
        busca={um(sp.q)}
        gr={FILTROS_GR.includes(gr) ? gr : ""}
      />
    </main>
  );
}
