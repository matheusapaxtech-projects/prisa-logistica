import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Columns3, Truck, Upload } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Documentos } from "@/components/Documentos";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Placa } from "@/components/Placa";
import { Ponto } from "@/components/Ponto";
import { Sinal, type TipoSinal } from "@/components/Sinal";
import { tipado } from "@/lib/banco";
import { formato } from "@/lib/formato";
import { getPerfil, pode } from "@/lib/permissoes";
import { rotuloDe } from "@/lib/quadro";
import { createClient } from "@/lib/supabase/server";
import { RE_ID } from "../../_pessoa/formulario";
import { CabPainel, Dash } from "../../_pessoa/partes";
import { SUFIXO_TARIFA } from "../../pedidos/regras";
import { carregarFrete, carregarParcelas, carregarViagem, type FichaViagem, type PausaDaViagem } from "../consultas";
import { pagoPeloFinanceiro } from "../parcelas";
import { duracao, modoDeInicio, podeCancelar, proximoPasso, temCanhotoEnviado, TIPOS_PAUSA, type ModoInicio } from "../regras";
import { CancelarViagem, ConfirmarPagamento, IniciarViagem } from "./acoes-viagem";
import { BlocoAptidao } from "./aptidao";
import { Canhoto } from "./canhoto";
import { BlocoFrete } from "./frete";
import { BlocoParcelas } from "./parcelas";
import { BlocoQuebraEstadia, lerQuebraEstadia } from "./quebra-estadia";
import { BlocoRetorno } from "./retorno";
import { DEPOIS_DA_SAIDA, retornoDaViagem } from "../retorno";
import { LinhaDoTempo } from "./linha-do-tempo";
import { Ocorrencias } from "./ocorrencias";
import "@/styles/paginas/proprietarios.css";
import "@/styles/paginas/pedidos.css";
import "@/styles/paginas/viagens.css";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  if (!RE_ID.test(id)) return { title: "Viagem não encontrada" };
  const r = await tipado(await createClient()).from("viagem").select("numero").eq("id", id).maybeSingle();
  return { title: r.data ? `Viagem #${r.data.numero} · Viagens` : "Viagem não encontrada" };
}

const RESULTADO: Record<string, string> = { sem_divergencia: "Sem divergência", falta: "Falta", sobra: "Sobra", avaria: "Avaria" };

function situacao(f: FichaViagem): { tipo: TipoSinal; texto: string } {
  if (f.canceladaEm) return { tipo: "bloqueado", texto: "Cancelada" };
  if (f.status_campo === null) return { tipo: "neutro", texto: "Planejada" };
  if (f.status_campo === "frete_finalizado") return { tipo: "normal", texto: "Frete finalizado" };
  return { tipo: f.status_campo === "pausa" ? "pendente" : "info", texto: rotuloDe(f.status_campo) };
}

function explicaInicio(modo: ModoInicio): string {
  switch (modo) {
    case "iniciar":
      return "A viagem está apta. Ao iniciar, ela entra no Quadro em “Trânsito”.";
    case "excecao":
      return "A viagem tem trava. Como administrador, você pode liberar com exceção, escrevendo a justificativa.";
    case "so_admin":
      return "A viagem tem trava: resolva o cadastro ou peça ao administrador para liberar com exceção.";
    case "bloqueado":
      return "Há trava legal (veja abaixo): resolva antes de iniciar. Trava legal não tem exceção.";
  }
}

function LinhaPausa({ p }: { p: PausaDaViagem }) {
  return (
    <tr>
      <td>
        {TIPOS_PAUSA[p.tipo]}
        <span className="linha2">
          {p.programada ? "programada" : "não programada"}
          <Ponto />
          saiu de {rotuloDe(p.colunaOrigem)}
        </span>
      </td>
      <td className="num data">{formato.dataHora(p.inicio)}</td>
      <td className="num data">{p.fim ? formato.dataHora(p.fim) : <Sinal tipo="pendente" texto="Em pausa" />}</td>
    </tr>
  );
}

/** Uma ponta da rota ("APUCARANA/PR"): a cidade em destaque, a UF clara e o momento daquela ponta. */
function Ponta({ local, quando, lado }: { local: string | undefined; quando: string; lado: "origem" | "destino" }) {
  const i = local ? local.lastIndexOf("/") : -1;
  return (
    <div className={`ponta ${lado}`}>
      <span className="cidade">
        {!local ? (
          <Dash />
        ) : i > 0 ? (
          <>
            {local.slice(0, i)}
            <span className="uf">{local.slice(i)}</span>
          </>
        ) : (
          local
        )}
      </span>
      <span className="quando">{quando}</span>
    </div>
  );
}

/** Chave fiscal em grupos de 4 para ler e conferir; copiar continua dando os 44 dígitos sem espaço. */
function Chave({ v }: { v: string }) {
  return (
    <span className="chave">
      {(v.match(/.{1,4}/g) ?? []).map((g, i) => (
        <span key={i}>{g}</span>
      ))}
    </span>
  );
}

/* Ficha da viagem (no padrão da ficha do pedido): próximo passo em destaque; a rota desenhada com peso,
   frete e pedido; motorista e conjunto; documentos fiscais; a situação com os pagamentos; aptidão (travas
   e avisos do banco); frete e piso ANTT (resultado do CT-e só para admin e financeiro); linha do tempo,
   pausas, canhoto, ocorrências e arquivos, todos em cartões. Página do servidor normal (sem tempo real): as
   ações revalidam a rota. Leitura só vê; financeiro confirma o pagamento de saída; operação e admin
   fazem o resto. */
export default async function FichaViagemPage({ params }: Params) {
  const { id } = await params;
  if (!RE_ID.test(id)) notFound();
  const perfil = await getPerfil();
  const podeEditar = pode(perfil, "editar");
  const podeFinanceiro = pode(perfil, "editarFinanceiro");
  const verResultado = pode(perfil, "financeiro");
  const db = tipado(await createClient());
  const [f, frete, qe, parcelas] = await Promise.all([
    carregarViagem(db, id),
    carregarFrete(db, id, verResultado),
    db.rpc("quebra_e_estadia", { p_viagem: id }),
    carregarParcelas(db, id),
  ]);
  if (qe.error) throw qe.error;
  // Previsão de chegada e frete de retorno: da saída ("Em rota") até descarregar.
  const retorno =
    f && f.pedido && !f.canceladaEm && f.status_campo && DEPOIS_DA_SAIDA.includes(f.status_campo)
      ? await retornoDaViagem(db, {
          viagemId: f.id,
          pedidoId: f.pedido.id,
          origem: f.pedido.origem,
          destino: f.pedido.destino,
          kmViagem: f.kmViagem,
          conjuntoId: f.conjuntoId,
          eventos: f.eventos,
        })
      : null;
  // Quebra e estadia só depois do início (antes não há pesos nem horas na linha do tempo).
  const quebraEstadia = f && f.status_campo !== null && !f.canceladaEm ? lerQuebraEstadia(qe.data) : null;
  if (!f) notFound();

  const cancelada = Boolean(f.canceladaEm);
  const planejada = !cancelada && f.status_campo === null;
  const pagamento = Boolean(f.pagamentoSaidaEm);
  const temCanhoto = temCanhotoEnviado(f.canhotos);
  const saldoPago = Boolean(f.saldoPagoEm);
  // Com a parcela no Contas a pagar, quem paga é o financeiro e o banco recusa a confirmação manual: some o botão.
  const adiantamentoNoFinanceiro = pagoPeloFinanceiro(parcelas, "adiantamento");
  const saldoNoFinanceiro = pagoPeloFinanceiro(parcelas, "saldo");
  const verFinanceiro = pode(perfil, "financeiro");
  const passo = cancelada
    ? null
    : proximoPasso({
        status_campo: f.status_campo,
        pagamento_saida: pagamento,
        tem_canhoto: temCanhoto,
        saldo_pago: saldoPago,
        adiantamento_no_financeiro: adiantamentoNoFinanceiro,
        saldo_no_financeiro: saldoNoFinanceiro,
      });
  // Cancelar e confirmar o pagamento valem na mesma janela (antes de "Em rota").
  const antesDeEmRota = !cancelada && podeCancelar(f.status_campo, f.origemDaPausa);
  const podePagar = antesDeEmRota && !pagamento && podeFinanceiro && !adiantamentoNoFinanceiro;
  const podePagarSaldo = !saldoPago && podeFinanceiro && !saldoNoFinanceiro;
  const modo = modoDeInicio(f.aptidao, perfil?.papel);
  const travas = f.aptidao.filter((a) => a.nivel === "trava");
  const s = situacao(f);
  const abertas = f.ocorrencias.filter((o) => !o.resolvidaEm).length;
  const pausaAberta = f.pausas.find((p) => !p.fim);

  const pecas = f.carretas.length;
  const docsFiscais = Boolean(f.chaveCte || f.chaveMdfe || f.chaveNfe || f.ciot || f.averbacaoSeguro);
  const saida = f.iniciadaEm ? `Iniciada em ${formato.dataHora(f.iniciadaEm)}` : cancelada ? "Não chegou a iniciar" : "Ainda não iniciada";
  const chegada = f.finalizadaEm
    ? `Frete finalizado em ${formato.dataHora(f.finalizadaEm)}`
    : retorno?.previsao
      ? `Chegada prevista para ${formato.dataHora(retorno.previsao)}`
      : cancelada
        ? "Viagem cancelada"
        : "Sem previsão de chegada";

  return (
    <main className="prop ped via">
      <div className="cab-ficha">
        <div className="ident">
          <nav className="migalha" aria-label="Caminho">
            <Link href="/viagens">Viagens</Link>
            <span className="sep" aria-hidden="true">
              /
            </span>
            <h1>Viagem #{f.numero}</h1>
          </nav>
          <div className="linha-doc">
            {f.pedido && <Link href={`/pedidos/${f.pedido.id}`}>Pedido #{f.pedido.numero}</Link>}
            {f.pedido && <span>{f.pedido.cliente}</span>}
            {f.pedido && <span>{f.pedido.produto}</span>}
          </div>
          <div className="sinais">
            <Sinal tipo={s.tipo} texto={s.texto} />
            {pagamento && <Sinal tipo="normal" texto="Pagamento de saída confirmado" />}
            {abertas > 0 && <Sinal tipo="pendente" texto={abertas === 1 ? "1 ocorrência aberta" : `${abertas} ocorrências abertas`} />}
          </div>
        </div>
        {podeEditar && antesDeEmRota && (
          <div className="acoes">
            <CancelarViagem viagemId={f.id} numero={f.numero} />
          </div>
        )}
      </div>

      {cancelada && (
        <div className="aviso aviso-bloqueado aviso-ficha">
          <span>
            <b>Viagem cancelada</b> em {formato.dataHora(f.canceladaEm!)}
            {f.canceladaPor && <> por {f.canceladaPor}</>}
            {f.cancelamentoMotivo && <>: {f.cancelamentoMotivo}</>}
          </span>
        </div>
      )}

      {passo && (
        <section className="proximo-passo" aria-labelledby="h-proximo">
          <div className="texto">
            <span className="rotulo">Próximo passo</span>
            <h2 id="h-proximo">{passo}</h2>
            {planejada && <p>{explicaInicio(modo)}</p>}
            {f.status_campo === "aguardando_nf_pagamento" && !pagamento && !adiantamentoNoFinanceiro && (
              <p>Confirme o adiantamento e o vale-pedágio. Depois, informe as chaves do CT-e e do MDF-e no Quadro, ao passar a viagem para “Em rota”.</p>
            )}
            {f.status_campo === "aguardando_nf_pagamento" && !pagamento && adiantamentoNoFinanceiro && (
              <p>
                O adiantamento e o vale-pedágio são pagos pelo financeiro (Contas a pagar): a viagem fica paga sozinha quando ele pagar. Depois,
                informe as chaves do CT-e e do MDF-e no Quadro, ao passar a viagem para “Em rota”.
              </p>
            )}
            {f.status_campo === "aguardando_nf_pagamento" && pagamento && (
              <p>As chaves do CT-e e do MDF-e são pedidas no Quadro, ao passar a viagem para “Em rota”.</p>
            )}
            {(f.status_campo === "aguardando_descarga" || f.status_campo === "descarregando") && (
              <p>O canhoto assinado é pedido para passar a viagem de “Descarregando” para a contagem de divergência.</p>
            )}
            {f.status_campo === "aguardando_saldo" && (
              <p>
                {saldoPago
                  ? "Com o saldo pago, encerre o MDF-e e o CIOT e finalize a viagem no Quadro."
                  : saldoNoFinanceiro
                    ? "O saldo de 30% é pago pelo financeiro (Contas a pagar): a viagem fica paga sozinha quando ele pagar."
                    : "O saldo de 30% ao motorista vence em até 30 dias úteis da entrega (Lei 15.485/2026)."}
              </p>
            )}
          </div>
          <div className="acoes">
            {planejada && podeEditar && <IniciarViagem viagemId={f.id} numero={f.numero} modo={modo} travas={travas} />}
            {f.status_campo === "aguardando_nf_pagamento" && podePagar && <ConfirmarPagamento viagemId={f.id} numero={f.numero} primario />}
            {f.status_campo === "aguardando_nf_pagamento" && (
              <Link className={`btn${pagamento ? " btn-primario" : ""}`} href="/quadro">
                <Columns3 size={16} strokeWidth={1.6} aria-hidden="true" />
                Informar chaves no Quadro
              </Link>
            )}
            {f.status_campo === "aguardando_saldo" && podePagarSaldo && (
              <ConfirmarPagamento viagemId={f.id} numero={f.numero} primario saldo />
            )}
            {f.status_campo === "aguardando_saldo" && saldoPago && (
              <Link className="btn btn-primario" href="/quadro">
                <Columns3 size={16} strokeWidth={1.6} aria-hidden="true" />
                Finalizar no Quadro
              </Link>
            )}
            {(f.status_campo === "aguardando_descarga" || f.status_campo === "descarregando") && podeEditar && !temCanhoto && (
              <a className="btn btn-primario" href="#arquivo-canhoto">
                <Upload size={16} strokeWidth={1.6} aria-hidden="true" />
                Enviar canhoto
              </a>
            )}
          </div>
        </section>
      )}

      <div className="grade ficha-ped ficha-via">
        <div className="coluna">
          <section className="bloco rota-ped" aria-label="Rota">
            <div className="rota">
              <Ponta local={f.pedido?.origem} quando={saida} lado="origem" />
              <div className="estrada" aria-hidden="true">
                {f.kmViagem != null && <span className="prazo">{f.kmViagem.toLocaleString("pt-BR")} km</span>}
                <span className="pista">
                  <span className="faixa" />
                </span>
              </div>
              <Ponta local={f.pedido?.destino} quando={chegada} lado="destino" />
            </div>
            <dl className="carga">
              <div>
                <dt>Peso</dt>
                <dd>
                  <b>{formato.kg(f.pesoSaidaKg ?? f.pesoPrevistoKg)}</b>
                  <span className="linha2">
                    {f.pesoSaidaKg != null ? `na saída · previsto ${formato.kg(f.pesoPrevistoKg)}` : "previsto"}
                  </span>
                  {f.pesoChegadaKg != null && <span className="linha2">chegada {formato.kg(f.pesoChegadaKg)}</span>}
                </dd>
              </div>
              <div>
                <dt>Frete do motorista</dt>
                <dd>
                  {f.freteMotoristaValor != null && f.freteMotoristaTipo ? (
                    <>
                      <b>{formato.reais(f.freteMotoristaValor)}</b>
                      <span className="linha2">{SUFIXO_TARIFA[f.freteMotoristaTipo]}</span>
                    </>
                  ) : (
                    <Dash>não informado</Dash>
                  )}
                </dd>
              </div>
              <div>
                <dt>Pedido</dt>
                <dd>
                  {f.pedido ? (
                    <>
                      <b>
                        <Link href={`/pedidos/${f.pedido.id}`}>Pedido #{f.pedido.numero}</Link>
                      </b>
                      <span className="linha2">
                        {f.pedido.produto}
                        {f.pedido.situacao === "cancelado" && " · pedido cancelado"}
                      </span>
                    </>
                  ) : (
                    <Dash />
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section className="bloco partes-ped" aria-labelledby="h-equipe">
            <div className="bloco-cab">
              <h2 id="h-equipe">Motorista e conjunto</h2>
              <span className="dir">
                <Link href={`/conjuntos/${f.conjuntoId}`}>Abrir o conjunto</Link>
              </span>
            </div>
            <ul className="bloco-corpo partes">
              <li>
                <Avatar nome={f.motorista} />
                <span className="quem">{f.motorista ? <Link href={`/motoristas/${f.motoristaId}`}>{f.motorista}</Link> : <Dash />}</span>
                <span className="papeis">Motorista</span>
              </li>
              <li>
                <span className="avatar icone-conjunto" aria-hidden="true">
                  <Truck size={16} strokeWidth={1.8} />
                </span>
                <span className="quem placas">
                  {f.cavalo ? <Placa placa={f.cavalo} /> : <Dash />}
                  {f.carretas.map((p, i) => (
                    <Placa key={i} placa={p} />
                  ))}
                </span>
                <span className="papeis">{pecas === 0 ? "Cavalo" : `Cavalo e ${pecas} ${pecas === 1 ? "peça" : "peças"}`}</span>
              </li>
            </ul>
          </section>

          <section className="bloco docs-via" aria-labelledby="h-docs">
            <div className="bloco-cab">
              <h2 id="h-docs">Documentos fiscais</h2>
            </div>
            <div className="bloco-corpo">
              {docsFiscais ? (
                <dl className="docs">
                  <div>
                    <dt>CT-e</dt>
                    <dd>{f.chaveCte ? <Chave v={f.chaveCte} /> : <Dash>não informado</Dash>}</dd>
                  </div>
                  <div>
                    <dt>MDF-e</dt>
                    <dd>{f.chaveMdfe ? <Chave v={f.chaveMdfe} /> : <Dash>não informado</Dash>}</dd>
                  </div>
                  {f.chaveNfe && (
                    <div>
                      <dt>NF-e</dt>
                      <dd>
                        <Chave v={f.chaveNfe} />
                      </dd>
                    </div>
                  )}
                  <div className="par">
                    <div>
                      <dt>CIOT</dt>
                      <dd>{f.ciot ? <span className="codigo">{f.ciot}</span> : <Dash>não informado</Dash>}</dd>
                    </div>
                    <div>
                      <dt>Averbação do seguro</dt>
                      <dd>{f.averbacaoSeguro ? <span className="codigo">{f.averbacaoSeguro}</span> : <Dash>não informada</Dash>}</dd>
                    </div>
                  </div>
                </dl>
              ) : (
                <EstadoVazio>Chaves do CT-e e do MDF-e, CIOT e averbação são informados no Quadro, ao passar a viagem para “Em rota”.</EstadoVazio>
              )}
            </div>
          </section>
        </div>

        <div className="coluna">
          <section className="bloco situacao-via" aria-labelledby="h-situacao">
            <div className="bloco-cab">
              <h2 id="h-situacao">Situação</h2>
            </div>
            <div className="bloco-corpo">
              <span className="valor-medio">{s.texto}</span>
              <p className="nota-saldo">
                {cancelada
                  ? `desde ${formato.dataHora(f.canceladaEm!)}`
                  : f.statusDesde && f.status_campo
                    ? `desde ${formato.dataHora(f.statusDesde)} · há ${duracao(f.statusDesde)}`
                    : `planejada em ${formato.dataHora(f.criadaEm)}`}
              </p>
              {pausaAberta && (
                <Sinal tipo="pendente" texto={`${TIPOS_PAUSA[pausaAberta.tipo]}, ${pausaAberta.programada ? "programada" : "não programada"}`} />
              )}
              <dl className="linhas">
                <dt>Adiantamento e vale-pedágio</dt>
                <dd>
                  {pagamento ? (
                    <>
                      Confirmados
                      <span className="linha2">
                        {formato.dataHora(f.pagamentoSaidaEm!)}
                        {f.pagamentoSaidaPor && <> · {f.pagamentoSaidaPor}</>}
                      </span>
                    </>
                  ) : (
                    <Dash>não confirmados</Dash>
                  )}
                </dd>
                {(f.status_campo === "aguardando_saldo" || f.status_campo === "frete_finalizado") && (
                  <>
                    <dt>Saldo (30%)</dt>
                    <dd>
                      {saldoPago ? (
                        <>
                          Pago
                          <span className="linha2">
                            {formato.dataHora(f.saldoPagoEm!)}
                            {f.saldoPagoPor && <> · {f.saldoPagoPor}</>}
                          </span>
                        </>
                      ) : (
                        <Dash>não confirmado</Dash>
                      )}
                    </dd>
                  </>
                )}
                {f.divergencia && (
                  <>
                    <dt>Contagem</dt>
                    <dd>
                      {RESULTADO[f.divergencia] ?? f.divergencia}
                      {f.divergenciaDescricao && <span className="linha2">{f.divergenciaDescricao}</span>}
                      {f.resolucao && <span className="linha2">Resolução: {f.resolucao}</span>}
                    </dd>
                  </>
                )}
                {f.iniciadaEm && (
                  <>
                    <dt>Início</dt>
                    <dd>
                      {formato.dataHora(f.iniciadaEm)}
                      {f.iniciadaPor && <span className="linha2">por {f.iniciadaPor}</span>}
                    </dd>
                  </>
                )}
                {f.finalizadaEm && (
                  <>
                    <dt>Finalizada</dt>
                    <dd>{formato.dataHora(f.finalizadaEm)}</dd>
                  </>
                )}
              </dl>
              {podePagar && f.status_campo !== "aguardando_nf_pagamento" && (
                <div className="acao-situacao">
                  <ConfirmarPagamento viagemId={f.id} numero={f.numero} />
                </div>
              )}
              {f.liberacaoJustificativa && (
                <p className="excecao">
                  <b>Liberada com exceção:</b> {f.liberacaoJustificativa}
                </p>
              )}
            </div>
          </section>

          {planejada ? (
            <BlocoAptidao
              itens={f.aptidao}
              titulo="Aptidão"
              explica="Trava legal impede a viagem; trava só sai com exceção do administrador; aviso não impede."
            />
          ) : f.liberacaoAptidao ? (
            <BlocoAptidao itens={f.liberacaoAptidao} titulo="Aptidão no início" vazio="Estava apta quando iniciou." />
          ) : (
            <section className="subsecao aptidao">
              <CabPainel titulo="Aptidão" />
              <EstadoVazio>{cancelada ? "Cancelada antes de iniciar." : "Sem conferência gravada."}</EstadoVazio>
            </section>
          )}

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

      {frete.frete && (
        <BlocoFrete
          viagemId={f.id}
          frete={frete.frete}
          resultado={frete.resultado}
          verResultado={verResultado}
          editavel={
            planejada && podeEditar
              ? {
                  viagemId: f.id,
                  numero: f.numero,
                  freteMotoristaValor: f.freteMotoristaValor,
                  freteMotoristaTipo: f.freteMotoristaTipo,
                  kmViagem: f.kmViagem,
                  pedagioValor: f.pedagioValor,
                }
              : null
          }
        />
      )}

      {(retorno || quebraEstadia || parcelas.length > 0) && (
        <div className="par-via">
          <BlocoParcelas parcelas={parcelas} verFinanceiro={verFinanceiro} />
          {retorno && <BlocoRetorno r={retorno} />}
          {quebraEstadia && <BlocoQuebraEstadia q={quebraEstadia} />}
        </div>
      )}

      <div className="blocos-viagem">
        <LinhaDoTempo eventos={f.eventos} criadaEm={f.criadaEm} />

        <section className="subsecao">
          <CabPainel titulo={`Pausas (${f.pausas.length})`} />
          {f.pausas.length ? (
            <div className="tabela-wrap">
              <table className="tabela leve">
                <thead>
                  <tr>
                    <th scope="col">Pausa</th>
                    <th className="num" scope="col">
                      Início
                    </th>
                    <th className="num" scope="col">
                      Fim
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {f.pausas.map((p) => (
                    <LinhaPausa key={p.id} p={p} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EstadoVazio>Nenhuma pausa. Pausas são abertas no Quadro, a partir de “Trânsito” ou “Em rota”.</EstadoVazio>
          )}
        </section>

        <Canhoto viagemId={f.id} canhotos={f.canhotos} podeEnviar={podeEditar && !cancelada && f.status_campo !== null} />

        <Ocorrencias viagemId={f.id} ocorrencias={f.ocorrencias} podeEditar={podeEditar} podeRegistrar={!cancelada} />

        <section className="bloco arquivos-via" aria-label="Arquivos da viagem">
          <Documentos
            viagemId={f.id}
            podeEditar={podeEditar && !cancelada}
            titulo="Arquivos da viagem"
            vazio="Nenhum arquivo. Canhoto e fotos das ocorrências aparecem aqui."
            tipoSugerido="OUTROS"
          />
        </section>
      </div>
    </main>
  );
}
