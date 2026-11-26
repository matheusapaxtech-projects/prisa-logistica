import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { Avatar } from "@/components/Avatar";
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
import { OfertaAppPainel, type InteressadoApp, type OfertaApp } from "./oferta-app";
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

const PAPEIS = { tomador: "Tomador", remetente: "Remetente", destinatario: "Destinatário" } as const;

/** As três partes do pedido, juntando os papéis de quem aparece mais de uma vez (o tomador costuma ser o remetente). */
function partesAgrupadas(f: { tomador: ParteFicha; remetente: ParteFicha; destinatario: ParteFicha }) {
  const grupos: { p: ParteFicha; papeis: string[] }[] = [];
  for (const k of ["tomador", "remetente", "destinatario"] as const) {
    const g = grupos.find((x) => x.p.id === f[k].id);
    if (g) g.papeis.push(PAPEIS[k]);
    else grupos.push({ p: f[k], papeis: [PAPEIS[k]] });
  }
  return grupos;
}

/** Dias corridos entre duas datas "aaaa-mm-dd" (prazo entre coleta e entrega). */
function diasEntre(de: string | null, ate: string | null): number | null {
  if (!de || !ate) return null;
  const n = Math.round((Date.parse(ate.slice(0, 10)) - Date.parse(de.slice(0, 10))) / 86_400_000);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Uma ponta da rota: a cidade em destaque, o tipo e a data prevista, o endereço e o atendimento. */
function Ponta({ l, tipo, data, lado }: { l: LocalFicha | null; tipo: string; data: string | null; lado: "origem" | "destino" }) {
  const quando = data ? `${tipo} prevista para ${formato.data(data)}` : `${tipo} sem data prevista`;
  if (!l)
    return (
      <div className={`ponta ${lado}`}>
        <span className="cidade">
          <Dash />
        </span>
        <span className="quando">{quando}</span>
      </div>
    );
  const extra = [enderecoDoLocal(l), l.ponto_referencia].filter(Boolean).join(" · ");
  const atende = [l.janela_atendimento && `Atende ${l.janela_atendimento}`, l.contato_local].filter(Boolean).join(" · ");
  return (
    <div className={`ponta ${lado}`}>
      <span className="cidade">
        {l.cidade}
        <span className="uf">/{l.uf}</span>
      </span>
      <span className="quando">{quando}</span>
      {extra && <span className="end">{extra}</span>}
      {atende && <span className="end">{atende}</span>}
    </div>
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
  // App do motorista: frete publicado (aberto) e quem disse que tem interesse.
  const [ofertaR, interesseR] = aberto
    ? await Promise.all([
        db
          .from("frete_oferta")
          .select("frete_motorista_por_t, carrocerias, eixos_minimos, raio_km, observacao, publicada_em")
          .eq("pedido_id", f.id)
          .is("encerrada_em", null)
          .maybeSingle(),
        db.from("v_frete_interesse").select("motorista_id, motorista_nome, km_ate_embarque, created_at").eq("pedido_id", f.id).order("created_at"),
      ])
    : [null, null];
  if (ofertaR?.error) throw ofertaR.error;
  if (interesseR?.error) throw interesseR.error;
  const oferta: OfertaApp | null = ofertaR?.data ?? null;
  const interessados = (interesseR?.data ?? []).flatMap((i): InteressadoApp[] =>
    i.motorista_id && i.motorista_nome && i.created_at
      ? [{ motorista_id: i.motorista_id, motorista_nome: i.motorista_nome, km_ate_embarque: i.km_ate_embarque ?? 0, created_at: i.created_at }]
      : [],
  );
  const vivas = f.viagens.filter((v) => !v.cancelada_em);
  const pct = f.pesoTotalKg > 0 ? Math.min(100, Math.max(0, (f.alocadoKg / f.pesoTotalKg) * 100)) : 0;
  // Barra do carregamento: um trecho por viagem ativa (peso de saída, ou o previsto) e o saldo tracejado.
  const trechos = vivas.map((v) => ({ id: v.id, numero: v.numero, kg: v.pesoSaidaKg ?? v.pesoPrevistoKg }));
  const base = Math.max(f.pesoTotalKg, trechos.reduce((t, x) => t + x.kg, 0), 1);
  const prazo = diasEntre(f.coletaPrevista, f.entregaPrevista);
  const partes = partesAgrupadas(f);

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

      <div className="grade ficha-ped">
        <div className="coluna">
          <section className="bloco rota-ped" aria-label="Rota">
            <div className="rota">
              <Ponta l={f.coleta} tipo="Coleta" data={f.coletaPrevista} lado="origem" />
              <div className="estrada" aria-hidden="true">
                {prazo != null && <span className="prazo">{prazo === 0 ? "no mesmo dia" : prazo === 1 ? "1 dia" : `${prazo} dias`}</span>}
                <span className="pista">
                  <span className="faixa" />
                </span>
              </div>
              <Ponta l={f.descarga} tipo="Descarga" data={f.entregaPrevista} lado="destino" />
            </div>
            <dl className="carga">
              <div>
                <dt>Produto</dt>
                <dd>
                  <b>{f.produto}</b>
                  <span className="linha2">{TIPOS_CARGA_ANTT[f.tipoCarga]} na tabela da ANTT</span>
                </dd>
              </div>
              <div>
                <dt>Peso total</dt>
                <dd>
                  <b>{formato.kg(f.pesoTotalKg)}</b>
                </dd>
              </div>
              <div>
                <dt>Frete da empresa</dt>
                <dd>
                  <b>{formato.reais(f.freteValor)}</b>
                  <span className="linha2">
                    {SUFIXO_TARIFA[f.freteTipo]} · {f.freteOrigem === "manual" ? "valor digitado" : "da tabela de frete"}
                  </span>
                </dd>
              </div>
            </dl>
          </section>

          <section className="bloco partes-ped" aria-labelledby="h-partes">
            <div className="bloco-cab">
              <h2 id="h-partes">Partes</h2>
            </div>
            <ul className="bloco-corpo partes">
              {partes.map(({ p, papeis }) => (
                <li key={p.id}>
                  <Avatar nome={p.nome} />
                  <span className="quem">
                    <Link href={`/clientes/${p.id}`}>{p.nome}</Link>
                    {p.nome !== p.nomeCompleto && <span className="linha2">{p.nomeCompleto}</span>}
                  </span>
                  <span className="papeis">{papeis.join(" e ")}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="coluna">
          <section className="bloco saldo-ped" aria-labelledby="h-saldo">
            <div className="bloco-cab">
              <h2 id="h-saldo">Saldo a carregar</h2>
            </div>
            <div className="bloco-corpo">
              <span className={`valor-medio${f.saldoKg < 0 ? " negativo" : ""}`}>{formato.kg(f.saldoKg)}</span>
              <p className="nota-saldo">
                {f.saldoKg > 0
                  ? `de ${formato.kg(f.pesoTotalKg)} ainda sem viagem`
                  : f.saldoKg < 0
                    ? `As viagens passam ${formato.kg(-f.saldoKg)} do peso do pedido`
                    : "Todo o peso já está em viagens"}
              </p>
              <span className="carregamento" role="img" aria-label={`${Math.round(pct)}% do peso já em viagens, em ${trechos.length} ${trechos.length === 1 ? "viagem" : "viagens"}`}>
                {trechos.map((t) => (
                  <i key={t.id} style={{ flexGrow: t.kg / base }} title={`Viagem #${t.numero}: ${formato.kg(t.kg)}`} />
                ))}
                {f.saldoKg > 0 && <i className="falta" style={{ flexGrow: f.saldoKg / base }} />}
              </span>
              <dl className="linhas">
                <dt>Peso total</dt>
                <dd>{formato.kg(f.pesoTotalKg)}</dd>
                <dt>Em viagens</dt>
                <dd>{formato.kg(f.alocadoKg)}</dd>
                <dt>Viagens ativas</dt>
                <dd>{vivas.length}</dd>
              </dl>
            </div>
          </section>

          {f.observacao && (
            <section className="bloco" aria-labelledby="h-obs">
              <div className="bloco-cab">
                <h2 id="h-obs">Observação</h2>
              </div>
              <p className="bloco-corpo observacao">{f.observacao}</p>
            </section>
          )}
        </div>
      </div>

      {desp && f.saldoKg > 0 && (
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
            interessadosApp={oferta ? interessados.map((i) => i.motorista_id) : []}
          />
        </section>
      )}

      {aberto && <OfertaAppPainel pedidoId={f.id} oferta={oferta} interessados={interessados} podeEditar={podeEditar} />}

      <section className="subsecao viagens-ped" aria-label="Viagens">
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
