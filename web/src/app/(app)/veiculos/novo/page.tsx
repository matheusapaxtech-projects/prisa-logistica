import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { tipado } from "@/lib/banco";
import { exigirPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import "@/styles/paginas/veiculos.css";
import type { TipoVeiculo } from "../rotulos";
import { FormularioNovo } from "./formulario-novo";

export const metadata: Metadata = { title: "Novo veículo" };

export default async function PaginaNovoVeiculo({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const perfil = await exigirPerfil();
  // Quem só lê não cadastra: volta para a lista (o RLS também recusaria o insert).
  if (!pode(perfil, "editar")) redirect("/veiculos");

  const sp = await searchParams;
  const placaInicial = typeof sp.placa === "string" ? sp.placa.slice(0, 12) : "";

  const db = tipado(await createClient());
  const [tipos, marcas, contrato] = await Promise.all([
    db.from("tipo_veiculo").select("id, nome, categoria, eixos, configuracao_cavalo").order("nome"),
    db.from("marca_veiculo").select("id, nome").order("nome"),
    db.from("tipo_arquivo").select("id").eq("nome", "CONTRATO").maybeSingle(),
  ]);
  if (tipos.error) throw tipos.error;
  if (marcas.error) throw marcas.error;
  if (contrato.error) throw contrato.error;

  return (
    <main>
      <div className="titulo">
        <div>
          <nav className="migalha" aria-label="Caminho">
            <Link href="/veiculos">Veículos</Link>
            <span className="sep" aria-hidden="true">/</span>
            <h1>Novo veículo</h1>
          </nav>
          <p className="sub">Comece pela placa. Depois, o tipo, o CRLV e os proprietários; o resto se completa na ficha.</p>
        </div>
      </div>

      <FormularioNovo
        tipos={(tipos.data ?? []) as TipoVeiculo[]}
        marcas={marcas.data ?? []}
        tipoContratoId={contrato.data?.id ?? null}
        admin={pode(perfil, "admin")}
        placaInicial={placaInicial}
      />
    </main>
  );
}
