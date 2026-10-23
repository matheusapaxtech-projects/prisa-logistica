import type { Metadata } from "next";
import Link from "next/link";
import { Link2 } from "lucide-react";
import { z } from "zod";
import { Abas } from "@/components/Abas";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { carregarLista } from "./consultas";
import { PainelAbertos, PainelHistorico } from "./lista-conjuntos";
import { Partes } from "./partes";
import "@/styles/paginas/conjuntos.css";

export const metadata: Metadata = { title: "Conjuntos" };

const Aba = z.preprocess((v) => (Array.isArray(v) ? v[0] : v), z.enum(["abertos", "historico"])).catch("abertos");

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/* Lista de conjuntos (prototipo/conjuntos.html): abertos e histórico. */
export default async function Conjuntos({ searchParams }: Props) {
  const aba = Aba.parse((await searchParams).aba);
  const [perfil, { abertos, historico }] = await Promise.all([getPerfil(), carregarLista(await createClient())]);
  const acima = abertos.filter((c) => c.capacidade.excede_cmt).length;

  return (
    <main>
      <div className="titulo">
        <div>
          <h1>Conjuntos</h1>
          <p className="sub" id="achado">
            <Partes
              itens={[
                `${abertos.length} ${abertos.length === 1 ? "aberto" : "abertos"}`,
                acima ? `${acima} ${acima === 1 ? "passa" : "passam"} do CMT do cavalo` : "nenhum acima do CMT",
              ]}
            />
          </p>
        </div>
        {pode(perfil, "editar") && (
          <div className="acoes">
            <Link className="btn btn-primario" href="/conjuntos/novo">
              <Link2 size={16} strokeWidth={1.6} aria-hidden="true" />
              Montar conjunto
            </Link>
          </div>
        )}
      </div>

      <Abas
        rotulo="Conjuntos abertos e encerrados"
        ativa={aba}
        abas={[
          { id: "abertos", rotulo: "Abertos", n: abertos.length },
          { id: "historico", rotulo: "Histórico", n: historico.length },
        ]}
      />

      {aba === "abertos" ? <PainelAbertos abertos={abertos} /> : <PainelHistorico historico={historico} />}
    </main>
  );
}
