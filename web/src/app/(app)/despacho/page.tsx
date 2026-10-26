import type { Metadata } from "next";
import Link from "next/link";
import { Abas } from "@/components/Abas";
import { EstadoVazio } from "@/components/EstadoVazio";
import { tipado } from "@/lib/banco";
import { formato } from "@/lib/formato";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { RE_ID } from "../_pessoa/formulario";
import { carregarPedido, listarPedidos, type LinhaPedido } from "../pedidos/consultas";
import { prepararDespacho } from "../pedidos/despacho";
import { TIPOS_CARGA_ANTT } from "../pedidos/regras";
import { ABAS_DESPACHO } from "./abas";
import { PainelDespacho } from "./painel-despacho";
import "@/styles/paginas/despacho.css";

export const metadata: Metadata = { title: "Despacho" };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** A coleta mais próxima primeiro (sem data por último), como na aba "A planejar" de Pedidos. */
function fila(linhas: LinhaPedido[]): LinhaPedido[] {
  return linhas
    .filter((p) => p.situacao === "aberto" && p.saldoKg > 0)
    .sort((a, b) => {
      if (a.coletaPrevista !== b.coletaPrevista) {
        if (!a.coletaPrevista) return 1;
        if (!b.coletaPrevista) return -1;
        return a.coletaPrevista < b.coletaPrevista ? -1 : 1;
      }
      return a.numero - b.numero;
    });
}

/* Despacho: os pedidos com peso ainda sem caminhão (a "fila de fretes fechados" do sistema do sócio). Escolha o
   pedido, veja quem está livre e apto, simule e contrate: as viagens nascem Planejadas e vão para o Quadro. */
export default async function DespachoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const db = tipado(await createClient());
  const [perfil, linhas] = await Promise.all([getPerfil(), listarPedidos(db)]);
  const pedidos = fila(linhas);
  const pedido = um(sp.pedido);
  const escolhido = pedidos.find((p) => p.id === pedido) ?? pedidos[0] ?? null;
  const f = escolhido && RE_ID.test(escolhido.id) ? await carregarPedido(db, escolhido.id) : null;
  const desp = f ? await prepararDespacho(db, f) : null;

  return (
    <main className="desp-pag">
      <div className="titulo">
        <div>
          <h1>Despacho</h1>
          <p className="sub">
            Pedidos com peso ainda sem caminhão. Escolha o pedido, veja quem está livre e apto (cadastro em dia) e contrate: a viagem vai para o{" "}
            <Link href="/quadro">Quadro</Link>.
          </p>
        </div>
      </div>
      <Abas abas={ABAS_DESPACHO} ativa="fila" rotulo="Partes do despacho" />

      <h2 className="desp-secao">
        Fretes na fila <span>· {pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"}</span>
      </h2>
      {pedidos.length === 0 ? (
        <EstadoVazio>
          Nenhum pedido esperando caminhão. Pedido novo entra aqui até todo o peso estar em viagens. <Link href="/pedidos/novo">Novo pedido</Link>
        </EstadoVazio>
      ) : (
        <ul className="desp-fila">
          {pedidos.map((p) => {
            const programado = p.pesoTotalKg - p.saldoKg;
            const pct = p.pesoTotalKg > 0 ? Math.min(100, Math.max(0, (programado / p.pesoTotalKg) * 100)) : 0;
            return (
              <li key={p.id}>
                <Link href={`/despacho?pedido=${p.id}`} aria-current={escolhido?.id === p.id ? "true" : undefined} scroll={false}>
                  <span className="topo">
                    <span>Pedido #{p.numero}</span>
                    <span>{p.viagens ? `${p.viagens} ${p.viagens === 1 ? "viagem" : "viagens"}` : "aguardando"}</span>
                  </span>
                  <b>
                    {p.origem} → {p.destino}
                  </b>
                  <span className="cliente">{p.tomador}</span>
                  <span className="linha2">
                    {formato.t(p.pesoTotalKg / 1000)} · {p.produto}
                    {p.coletaPrevista && <> · coleta {formato.data(p.coletaPrevista)}</>}
                  </span>
                  <span className="trilho" role="img" aria-label={`${Math.round(pct)}% do peso já em viagens`}>
                    <i style={{ width: `${pct}%` }} />
                  </span>
                  <span className="linha2">
                    {formato.t(programado / 1000)} de {formato.t(p.pesoTotalKg / 1000)} programadas
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {f && desp && (
        <section className="desp-escolhido" aria-labelledby="desp-rota">
          <div className="desp-faixa">
            <div>
              <h2 id="desp-rota">
                {f.coleta ? `${f.coleta.cidade}/${f.coleta.uf}` : "—"} → {f.descarga ? `${f.descarga.cidade}/${f.descarga.uf}` : "—"}
              </h2>
              <p>
                {formato.t(f.saldoKg / 1000)} de {TIPOS_CARGA_ANTT[f.tipoCarga].toLowerCase()} a planejar · {f.produto}
                {f.coletaPrevista && <> · coleta {formato.data(f.coletaPrevista)}</>} · <Link href={`/pedidos/${f.id}`}>Pedido #{f.numero}</Link>
              </p>
            </div>
            {desp.dados.kmViagem > 0 && <span className="km">{desp.dados.kmViagem.toLocaleString("pt-BR")} km</span>}
          </div>
          {/* key: outro pedido = simulação nova (peso, preço e tipo do pedido escolhido). */}
          <PainelDespacho
            key={f.id}
            dados={desp.dados}
            tabela={desp.tabela}
            fiscal={desp.fiscal}
            tiposCarga={TIPOS_CARGA_ANTT}
            podeEditar={pode(perfil, "editar")}
            verResultado={pode(perfil, "financeiro")}
            pedidoId={f.id}
            numero={f.numero}
            saldoKg={f.saldoKg}
            conjuntos={desp.conjuntos}
            rotaSalva={desp.rotaSalva}
          />
        </section>
      )}
    </main>
  );
}
