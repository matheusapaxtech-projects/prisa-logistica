import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Columns3, Upload } from "lucide-react";
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
import { carregarViagem, type FichaViagem, type PausaDaViagem } from "../consultas";
import { duracao, modoDeInicio, podeCancelar, proximoPasso, TIPOS_PAUSA, type ModoInicio } from "../regras";
import { CancelarViagem, ConfirmarPagamento, IniciarViagem } from "./acoes-viagem";
import { BlocoAptidao } from "./aptidao";
import { Canhoto } from "./canhoto";
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

/* Ficha da viagem: resumo, próximo passo em destaque, aptidão (travas e avisos do banco), linha do
   tempo, pausas, canhoto, ocorrências e arquivos. Página do servidor normal (sem tempo real): as
   ações revalidam a rota. Leitura só vê; financeiro confirma o pagamento de saída; operação e admin
   fazem o resto. */
export default async function FichaViagemPage({ params }: Params) {
  const { id } = await params;
  if (!RE_ID.test(id)) notFound();
  const perfil = await getPerfil();
  const podeEditar = pode(perfil, "editar");
  const podeFinanceiro = pode(perfil, "editarFinanceiro");
  const db = tipado(await createClient());
  const f = await carregarViagem(db, id);
  if (!f) notFound();

  const cancelada = Boolean(f.canceladaEm);
  const planejada = !cancelada && f.status_campo === null;
  const pagamento = Boolean(f.pagamentoSaidaEm);
  const temCanhoto = f.canhotos.length > 0;
  const passo = cancelada ? null : proximoPasso({ status_campo: f.status_campo, pagamento_saida: pagamento, tem_canhoto: temCanhoto });
  // Cancelar e confirmar o pagamento valem na mesma janela (antes de "Em rota").
  const antesDeEmRota = !cancelada && podeCancelar(f.status_campo, f.origemDaPausa);
  const podePagar = antesDeEmRota && !pagamento && podeFinanceiro;
  const modo = modoDeInicio(f.aptidao, perfil?.papel);
  const travas = f.aptidao.filter((a) => a.nivel === "trava");
  const s = situacao(f);
  const abertas = f.ocorrencias.filter((o) => !o.resolvidaEm).length;
  const pausaAberta = f.pausas.find((p) => !p.fim);

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
            {f.pedido && (
              <span>
                {f.pedido.origem} → {f.pedido.destino}
              </span>
            )}
          </div>
          <div className="sinais">
            <Sinal tipo={s.tipo} texto={s.texto} />
            {!cancelada && f.status_campo && f.status_campo !== "frete_finalizado" && f.statusDesde && (
              <span className="desde">{duracao(f.statusDesde)} nesta coluna</span>
            )}
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
            <h2 id="h-proximo">Próximo passo: {passo}</h2>
            {planejada && <p>{explicaInicio(modo)}</p>}
            {f.status_campo === "aguardando_nf_pagamento" && !pagamento && (
              <p>Confirme o adiantamento e o vale-pedágio. Depois, informe as chaves do CT-e e do MDF-e no Quadro, ao passar a viagem para “Em rota”.</p>
            )}
            {f.status_campo === "aguardando_nf_pagamento" && pagamento && (
              <p>As chaves do CT-e e do MDF-e são pedidas no Quadro, ao passar a viagem para “Em rota”.</p>
            )}
            {f.status_campo === "aguardando_descarga" && <p>O canhoto assinado é pedido para passar a viagem para a contagem de divergência.</p>}
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
            {f.status_campo === "aguardando_descarga" && podeEditar && (
              <a className="btn btn-primario" href="#arquivo-canhoto">
                <Upload size={16} strokeWidth={1.6} aria-hidden="true" />
                Enviar canhoto
              </a>
            )}
          </div>
        </section>
      )}

      <div className="resumo-pedido">
        <section className="subsecao">
          <CabPainel titulo="Resumo" />
          <dl className="kv">
            <dt>Pedido</dt>
            <dd>
              {f.pedido ? (
                <>
                  <Link href={`/pedidos/${f.pedido.id}`}>Pedido #{f.pedido.numero}</Link>
                  <Ponto />
                  {f.pedido.produto}
                  <span className="linha2">
                    {f.pedido.cliente}
                    {f.pedido.situacao === "cancelado" && (
                      <>
                        <Ponto />
                        pedido cancelado
                      </>
                    )}
                  </span>
                </>
              ) : (
                <Dash />
              )}
            </dd>
            <dt>Origem e destino</dt>
            <dd>{f.pedido ? `${f.pedido.origem} → ${f.pedido.destino}` : <Dash />}</dd>
            <dt>Conjunto</dt>
            <dd>
              <span className="placas">
                {f.cavalo ? <Placa placa={f.cavalo} /> : <Dash />}
                {f.carretas.map((p, i) => (
                  <Placa key={i} placa={p} />
                ))}
              </span>
              <span className="linha2">
                <Link href={`/conjuntos/${f.conjuntoId}`}>Abrir o conjunto</Link>
              </span>
            </dd>
            <dt>Motorista</dt>
            <dd>{f.motorista ? <Link href={`/motoristas/${f.motoristaId}`}>{f.motorista}</Link> : <Dash />}</dd>
            <dt>Coluna atual</dt>
            <dd>
              {s.texto}
              {!cancelada && f.statusDesde && f.status_campo && (
                <span className="linha2">
                  desde {formato.dataHora(f.statusDesde)} ({duracao(f.statusDesde)})
                </span>
              )}
              {pausaAberta && (
                <span className="linha2">
                  {TIPOS_PAUSA[pausaAberta.tipo]}, {pausaAberta.programada ? "programada" : "não programada"}
                </span>
              )}
            </dd>
            <dt>Peso</dt>
            <dd>
              {formato.kg(f.pesoPrevistoKg)} previsto
              {f.pesoSaidaKg != null && <span className="linha2">saída {formato.kg(f.pesoSaidaKg)}</span>}
              {f.pesoChegadaKg != null && <span className="linha2">chegada {formato.kg(f.pesoChegadaKg)}</span>}
            </dd>
            <dt>Frete do motorista</dt>
            <dd>
              {f.freteMotoristaValor != null && f.freteMotoristaTipo ? (
                <>
                  {formato.reais(f.freteMotoristaValor)} {SUFIXO_TARIFA[f.freteMotoristaTipo]}
                </>
              ) : (
                <Dash />
              )}
            </dd>
            <dt>Pagamento de saída</dt>
            <dd>
              {pagamento ? (
                <>
                  Adiantamento e vale-pedágio confirmados
                  <span className="linha2">
                    em {formato.dataHora(f.pagamentoSaidaEm!)}
                    {f.pagamentoSaidaPor && <> por {f.pagamentoSaidaPor}</>}
                  </span>
                </>
              ) : (
                <span className="com-acao">
                  <Dash>não confirmado</Dash>
                  {podePagar && f.status_campo !== "aguardando_nf_pagamento" && <ConfirmarPagamento viagemId={f.id} numero={f.numero} />}
                </span>
              )}
            </dd>
            <dt>Chaves</dt>
            <dd>
              {f.chaveCte || f.chaveMdfe ? (
                <>
                  <span className="codigo">CT-e {f.chaveCte ?? "—"}</span>
                  <span className="linha2 codigo">MDF-e {f.chaveMdfe ?? "—"}</span>
                </>
              ) : (
                <Dash>não informadas</Dash>
              )}
            </dd>
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
                  {f.liberacaoJustificativa && <span className="linha2">Liberada com exceção: {f.liberacaoJustificativa}</span>}
                </dd>
              </>
            )}
            {f.finalizadaEm && (
              <>
                <dt>Finalizada</dt>
                <dd>{formato.dataHora(f.finalizadaEm)}</dd>
              </>
            )}
            {f.observacao && (
              <>
                <dt>Observação</dt>
                <dd className="observacao">{f.observacao}</dd>
              </>
            )}
          </dl>
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
      </div>

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

        <Documentos
          viagemId={f.id}
          podeEditar={podeEditar && !cancelada}
          titulo="Arquivos da viagem"
          vazio="Nenhum arquivo. Canhoto e fotos das ocorrências aparecem aqui."
          tipoSugerido="OUTROS"
        />
      </div>
    </main>
  );
}
