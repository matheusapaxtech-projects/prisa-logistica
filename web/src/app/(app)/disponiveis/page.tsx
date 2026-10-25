import type { Metadata } from "next";
import { tipado } from "@/lib/banco";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { listarConjuntosAbertos, nomesDeMotorista } from "../pedidos/consultas";
import { DisponiveisCliente, type Livre, type OpcaoMotorista } from "./disponiveis-cliente";
import "@/styles/paginas/calculadora.css";
import "@/styles/paginas/disponiveis.css";

export const metadata: Metadata = { title: "Motoristas livres" };

type LinhaLivre = {
  id: string | null;
  motorista_id: string | null;
  cidade: string | null;
  livre_desde: string | null;
  livre_ate: string | null;
  observacao: string | null;
  created_at: string | null;
  viagens_finalizadas: number | null;
};

/** Vigentes primeiro (livre até depois de agora), cada grupo do registro mais novo ao mais velho. */
function montarLista(linhas: LinhaLivre[], nomes: Map<string, string>): Livre[] {
  const agora = Date.now();
  return linhas
    .filter((l) => l.id && l.motorista_id && l.livre_ate)
    .map((l) => ({
      id: l.id!,
      motorista: nomes.get(l.motorista_id!) ?? "—",
      cidade: l.cidade ?? "—",
      livreAte: l.livre_ate!,
      registradoEm: l.created_at ?? l.livre_desde ?? "",
      observacao: l.observacao,
      viagens: l.viagens_finalizadas ?? 0,
      vigente: Date.parse(l.livre_ate!) > agora,
    }))
    .sort((a, b) => Number(b.vigente) - Number(a.vigente) || Date.parse(b.registradoEm) - Date.parse(a.registradoEm));
}

/* Motoristas livres (motor de despacho, rotina 1 "Estou livre"): sem o app do motorista, a operação registra
   onde ele está e até quando está livre. O registro mais recente de cada motorista vale no ranking do
   despacho, na ficha do pedido, até vencer. */
export default async function DisponiveisPage() {
  const db = tipado(await createClient());
  const [perfil, livres, conjuntos] = await Promise.all([
    getPerfil(),
    db.from("v_motorista_livre").select("id, motorista_id, cidade, livre_desde, livre_ate, observacao, created_at, viagens_finalizadas"),
    listarConjuntosAbertos(db),
  ]);
  if (livres.error) throw livres.error;
  const ids = (livres.data ?? []).flatMap((l) => (l.motorista_id ? [l.motorista_id] : []));
  const nomes = await nomesDeMotorista(db, ids);
  const lista = montarLista(livres.data ?? [], nomes);

  // Quem pode ser registrado: o motorista de cada conjunto aberto (o ranking usa o conjunto).
  const motoristas = await db.from("conjunto").select("id, motorista_id").is("fim", null).not("motorista_id", "is", null);
  if (motoristas.error) throw motoristas.error;
  const porConjunto = new Map((motoristas.data ?? []).map((c) => [c.id, c.motorista_id!]));
  const opcoes: OpcaoMotorista[] = conjuntos
    .filter((c) => porConjunto.has(c.id))
    .map((c) => ({ id: porConjunto.get(c.id)!, nome: c.motorista, placa: c.cavalo, eixos: c.eixos, capacidadeT: c.capacidadeT }));

  return (
    <main className="calc disp">
      <DisponiveisCliente livres={lista} motoristas={opcoes} podeEditar={pode(perfil, "editar")} />
    </main>
  );
}
