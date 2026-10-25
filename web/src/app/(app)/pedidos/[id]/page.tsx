import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Placa } from "@/components/Placa";
import { Sinal, type TipoSinal } from "@/components/Sinal";
import { tipado } from "@/lib/banco";
import { formato } from "@/lib/formato";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { RE_ID } from "../../_pessoa/formulario";
import { CabPainel, Dash } from "../../_pessoa/partes";
import { enderecoDoLocal } from "../../clientes/consultas";
import { carregarPedido, type LocalFicha, type ParteFicha, type ViagemDoPedido } from "../consultas";
import { bloqueioDoCancelamento, situacaoDaViagem, SUFIXO_TARIFA, TIPOS_CARGA_ANTT } from "../regras";
import { CancelarPedido } from "./cancelar-pedido";
import { prepararDespacho } from "../despacho";
import { PainelDespacho } from "../../despacho/painel-despacho";
import { NovaViagem } from "./nova-viagem";
import "@/styles/paginas/proprietarios.css";
import "@/styles/paginas/pedidos.css";
import "@/styles/paginas/despacho.css";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  if (!RE_ID.test(id)) return { title: "Pedido não encontrado" };
  const r = await tipado(await createClient()).from("pedido").select("numero").eq("id", id).maybeSingle();
  return { title: r.data ? `Pedido #${r.data.numero} · Pedidos` : "Pedido não encontrado" };
}

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function Parte({ p }: { p: ParteFicha }) {
  return (
    <>
      <Link href={`/clientes/${p.id}`}>{p.nome}</Link>
      {p.nome !== p.nomeCompleto && <span className="linha2">{p.nomeCompleto}</span>}
    </>
  );
}

function LocalPrevisto({ l, data }: { l: LocalFicha | null; data: string | null }) {
  if (!l) return <Dash />;
  const extra = [enderecoDoLocal(l), l.ponto_referencia].filter(Boolean).join(" · ");
  return (
    <>
      <b>
        {l.cidade}/{l.uf}
      </b>
      {data && <> · previsto para {formato.data(data)}</>}
      {extra && <span className="linha2">{extra}</span>}
      {(l.janela_atendimento || l.contato_local) && (
        <span className="linha2">{[l.janela_atendimento && `Atende ${l.janela_atendimento}`, l.contato_local].filter(Boolean).join(" · ")}</span>
      )}
    </>
  );
}

function sinalDaViagem(v: ViagemDoPedido): TipoSinal {
  if (v.cancelada_em) return "neutro";
  if (v.status_campo === null) return "info";
  return "normal";
}

/* Ficha do pedido: resumo, saldo a carregar, as viagens (com a coluna atual do Quadro) e as ações
   "Nova viagem" e "Cancelar pedido" (só pedido aberto, Ruling R4). */
export default async function FichaPedidoPage({ params, searchParams }: Params) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!RE_ID.test(id)) notFound();
  const perfil = await getPerfil();
  const podeEditar = pode(perfil, "editar");
  const db = tipado(await createClient());
  const f = await carregarPedido(db, id);
  if (!f) notFound();

  const aberto = f.situacao === "aberto";
  // Despacho (motor): ranking dos motoristas livres e composição do lote para o saldo.
  const desp = aberto ? await prepararDespacho(db, f) : null;
  const conjuntos = desp?.conjuntos ?? [];
  const rotaSalva = desp?.rotaSalva ?? null;
  const vivas = f.viagens.filter((v) => !v.cancelada_em);
  const pct = f.pesoTotalKg > 0 ? Math.min(100, Math.max(0, (f.alocadoKg / f.pesoTotalKg) * 100)) : 0;

  return (
    <main className="prop ped">
      {um(sp.criado) && (
        <div className="aviso aviso-normal aviso-criado">
          <Check size={16} strokeWidth={1.6} aria-hidden="true" />
          <span>
            <b>Pedido criado.</b> Agora crie as viagens: cada uma leva uma parte do peso, num conjunto aberto.
          </span>
        </div>
      )}
      <div className="cab-ficha">
        <div className="ident">
          <nav className="migalha" aria-label="Caminho">
            <Link href="/pedidos">Pedidos</Link>
            <span className="sep" aria-hidden="true">
              /
            </span>
            <h1>Pedido #{f.numero}</h1>
          </nav>
          <div className="linha-doc">
            <span>{f.tomador.nome}</span>
            <span>{f.produto}</span>
            <span>criado em {formato.dataHora(f.criadoEm)}</span>
          </div>
          <div className="sinais">
            {aberto ? <Sinal tipo="normal" texto="Aberto" /> : <Sinal situacao="cancelado" />}
            {aberto &&
              (f.saldoKg > 0 ? (
                <Sinal tipo="pendente" texto={`${formato.kg(f.saldoKg)} a planejar`} />
              ) : (
                <Sinal tipo="info" texto="Todo o peso em viagens" />
              ))}
          </div>
        </div>
        {aberto && podeEditar && (
          <div className="acoes">
            <CancelarPedido pedidoId={f.id} numero={f.numero} bloqueio={bloqueioDoCancelamento(f.viagens)} />
            <NovaViagem pedidoId={f.id} numero={f.numero} saldoKg={f.saldoKg} conjuntos={conjuntos} rotaSalva={rotaSalva} />
          </div>
        )}
      </div>

      <div className="resumo-pedido">
        <section className="subsecao">
          <CabPainel titulo="Resumo" />
          <dl className="kv">
            <dt>Tomador</dt>
            <dd>
              <Parte p={f.tomador} />
            </dd>
            <dt>Remetente</dt>
            <dd>
              <Parte p={f.remetente} />
            </dd>
            <dt>Destinatário</dt>
            <dd>
              <Parte p={f.destinatario} />
            </dd>
            <dt>Coleta</dt>
            <dd>
              <LocalPrevisto l={f.coleta} data={f.coletaPrevista} />
            </dd>
            <dt>Descarga</dt>
            <dd>
              <LocalPrevisto l={f.descarga} data={f.entregaPrevista} />
            </dd>
            <dt>Produto</dt>
            <dd>
              {f.produto}
              <span className="linha2">{TIPOS_CARGA_ANTT[f.tipoCarga]} na tabela da ANTT</span>
            </dd>
            <dt>Peso total</dt>
            <dd>{formato.kg(f.pesoTotalKg)}</dd>
            <dt>Frete da empresa</dt>
            <dd>
              {formato.reais(f.freteValor)} {SUFIXO_TARIFA[f.freteTipo]}
              <span className="linha2">{f.freteOrigem === "manual" ? "valor digitado" : "da tabela de frete"}</span>
            </dd>
            {f.observacao && (
              <>
                <dt>Observação</dt>
                <dd className="observacao">{f.observacao}</dd>
              </>
            )}
          </dl>
        </section>

        <aside className="saldo" aria-labelledby="h-saldo">
          <span className="rotulo" id="h-saldo">
            Saldo a carregar
          </span>
          <span className="kpi" id="saldo">
            {formato.kg(f.saldoKg)}
          </span>
          <span className="trilho" role="img" aria-label={`${Math.round(pct)}% do peso já em viagens`}>
            <i style={{ width: `${pct}%` }} />
          </span>
          <div className="linhas">
            <span>Peso total</span>
            <b>{formato.kg(f.pesoTotalKg)}</b>
            <span>Em viagens</span>
            <b>{formato.kg(f.alocadoKg)}</b>
            <span>Viagens ativas</span>
            <b>{vivas.length}</b>
          </div>
        </aside>
      </div>

      {desp && (
        <section className="subsecao despacho" aria-label="Despacho">
          <CabPainel titulo="Despacho" />
          <PainelDespacho
          dados={desp.dados}
          tabela={desp.tabela}
          fiscal={desp.fiscal}
          tiposCarga={TIPOS_CARGA_ANTT}
          podeEditar={podeEditar}
          verResultado={pode(perfil, "financeiro")}
          pedidoId={f.id}
          numero={f.numero}
          saldoKg={f.saldoKg}
          conjuntos={conjuntos}
          rotaSalva={rotaSalva}
          />
        </section>
      )}

      <section className="subsecao" style={{ marginTop: 32 }}>
        <CabPainel titulo={`Viagens (${f.viagens.length})`} />
        {f.viagens.length ? (
          <div className="tabela-wrap">
            <table className="tabela leve empilha">
              <thead>
                <tr>
                  <th scope="col">Viagem</th>
                  <th scope="col">Motorista</th>
                  <th className="num" scope="col">
                    Peso
                  </th>
                  <th scope="col">Coluna</th>
                  <th className="num" scope="col">
                    Frete do motorista
                  </th>
                </tr>
              </thead>
              <tbody>
                {f.viagens.map((v) => (
                  <tr key={v.id} className={v.cancelada_em ? "cancelada" : undefined}>
                    <td className="cel-1">
                      <span className="viagem-cel">
                        <Link className="id" href={`/viagens/${v.id}`}>
                          #{v.numero}
                        </Link>
                        {v.placa && <Placa placa={v.placa} />}
                      </span>
                    </td>
                    <td>{v.motorista ?? <Dash />}</td>
                    <td className="num">
                      {v.pesoSaidaKg != null ? (
                        <>
                          {formato.kg(v.pesoSaidaKg)}
                          <span className="linha2">saída · previsto {formato.kg(v.pesoPrevistoKg)}</span>
                        </>
                      ) : (
                        <>
                          {formato.kg(v.pesoPrevistoKg)}
                          <span className="linha2">previsto</span>
                        </>
                      )}
                    </td>
                    <td>
                      <Sinal tipo={sinalDaViagem(v)} texto={situacaoDaViagem(v)} />
                    </td>
                    <td className="num">
                      {v.freteMotoristaValor != null && v.freteMotoristaTipo ? (
                        <>
                          {formato.reais(v.freteMotoristaValor)}
                          <span className="linha2">{SUFIXO_TARIFA[v.freteMotoristaTipo]}</span>
                        </>
                      ) : (
                        <Dash />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EstadoVazio>
            Nenhuma viagem ainda.
            {aberto && podeEditar ? " Use “Nova viagem” para colocar uma parte do peso num conjunto." : ""}
          </EstadoVazio>
        )}
      </section>
    </main>
  );
}
