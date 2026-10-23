import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Ponto } from "@/components/Ponto";
import { tipado } from "@/lib/banco";
import { formato } from "@/lib/formato";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { listarProprietarios, type ListaProprietarios } from "./consultas";
import { ListaProprietarios as Lista, type AbaLista } from "./lista-proprietarios";
import "@/styles/paginas/proprietarios.css";

export const metadata: Metadata = { title: "Proprietários" };

const ABAS: readonly AbaLista[] = ["todos", "pf", "pj", "pendentes", "rntrc"];
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** "6 proprietários · RNTRC de Rodo Norte vencido · …": o fato da lista que pede atenção (`#achado`). */
function achado({ linhas, arrendadosTotal }: ListaProprietarios): string[] {
  const venc = linhas.filter((l) => l.r.estado === "vencido");
  const vcd = linhas.filter((l) => l.r.estado === "vencendo");
  const sem = linhas.filter((l) => l.r.estado === "sem");
  const curto = (l: (typeof linhas)[number]) => l.nomeFantasia || l.nome.split(" ")[0];
  const partes = [`${linhas.length} ${linhas.length === 1 ? "proprietário" : "proprietários"}`];
  if (venc.length) partes.push(venc.length === 1 ? `RNTRC de ${curto(venc[0])} vencido` : `${venc.length} RNTRC vencidos`);
  if (vcd.length) partes.push(vcd.length === 1 ? `1 ${formato.dias(vcd[0].r.dias!)}` : `${vcd.length} vencem em até 30 dias`);
  if (sem.length) partes.push(`${sem.length} sem RNTRC`);
  if (arrendadosTotal) partes.push(`${arrendadosTotal} ${arrendadosTotal === 1 ? "veículo arrendado" : "veículos arrendados"}`);
  return partes;
}

export default async function ProprietariosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const [perfil, dados] = await Promise.all([getPerfil(), listarProprietarios(tipado(await createClient()))]);
  const aba = um(sp.aba);

  return (
    <main className="prop">
      <div className="titulo">
        <div>
          <h1>Proprietários</h1>
          <p className="sub" id="achado">
            {achado(dados).map((t, i) => (
              <Fragment key={i}>
                {i > 0 && <Ponto />}
                {t}
              </Fragment>
            ))}
          </p>
        </div>
        {pode(perfil, "editar") && (
          <div className="acoes">
            <Link className="btn btn-primario" href="/proprietarios/novo">
              <Plus size={16} strokeWidth={1.6} aria-hidden="true" />
              Novo proprietário
            </Link>
          </div>
        )}
      </div>
      <Lista linhas={dados.linhas} aba={(ABAS as readonly string[]).includes(aba) ? (aba as AbaLista) : "todos"} busca={um(sp.q)} />
    </main>
  );
}
