import type { Metadata } from "next";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { carregarBaseMontador, RE_ID } from "../consultas";
import { Montador } from "../montador";
import { SemPermissao } from "../sem-permissao";
import "@/styles/paginas/conjuntos.css";

export const metadata: Metadata = { title: "Montar conjunto" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/* Montador (`conjunto.html?novo=1`). `?cavalo=<id>` chega da ficha do veículo com o cavalo escolhido. */
export default async function MontarConjunto({ searchParams }: Props) {
  const perfil = await getPerfil();
  if (!pode(perfil, "editar")) return <SemPermissao titulo="Montar conjunto" />;

  const pedido = (await searchParams).cavalo;
  const cavalo = typeof pedido === "string" && RE_ID.test(pedido) ? pedido : null;
  const base = await carregarBaseMontador(await createClient());

  return (
    <main>
      <Montador base={base} editar={null} cavaloInicial={cavalo} />
    </main>
  );
}
