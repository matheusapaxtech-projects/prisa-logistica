import type { ReactNode } from "react";
import Link from "next/link";
import { Ponto } from "@/components/Ponto";
import { Sinal } from "@/components/Sinal";
import { tipado } from "@/lib/banco";
import { formato } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { motoristasParaEscolher } from "../consultas";
import "@/styles/paginas/motoristas.css";

/* "Erro amigável" da ficha (prototipo/motorista.html): o motivo à esquerda e, à direita, os
   motoristas cadastrados para escolher. */
export async function ErroFicha({ titulo, children }: { titulo: string; children: ReactNode }) {
  const motoristas = await motoristasParaEscolher(tipado(await createClient()));
  return (
    <main>
      <div className="titulo">
        <div>
          <nav className="migalha" aria-label="Caminho">
            <Link href="/motoristas">Motoristas</Link>
            <span className="sep" aria-hidden="true">
              /
            </span>
            <h1>{titulo}</h1>
          </nav>
        </div>
      </div>
      <div className="grade">
        <section className="bloco erro-ficha c6" role="alert">
          {children}
        </section>
        <section className="bloco erro-lista c6" aria-labelledby="h-outros">
          <div className="bloco-cab">
            <h2 id="h-outros">Motoristas cadastrados</h2>
            <span className="dir">{motoristas.length} no total</span>
          </div>
          <div className="bloco-corpo">
            <div className="marcos">
              {motoristas.map((x) => (
                <Link className="marco erro-item" href={`/motoristas/${x.id}`} key={x.id}>
                  <span className="quem">
                    <b>{x.nome}</b>
                    <span>
                      {x.apelido || "sem apelido"}
                      <Ponto />
                      <span className="cod">{formato.cpf(x.cpf)}</span>
                    </span>
                  </span>
                  <Sinal situacao={x.situacao} />
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
