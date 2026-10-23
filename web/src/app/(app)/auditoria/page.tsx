import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Ponto } from "@/components/Ponto";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import "@/styles/paginas/admin.css";
import { carregarAuditoria, type Evento } from "./consultas";
import { chaveDia, diasEntre, hora, rotuloDia } from "./dias";
import { donoDoArquivo, EventoItem, tipoArquivo } from "./eventos";
import { FiltrosAuditoria } from "./filtros-auditoria";
import { LIMITE_MAXIMO, PASSO, algumFiltro, lerFiltros, montarBusca } from "./filtros";

export const metadata: Metadata = { title: "Auditoria" };

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Auditoria({ searchParams }: Props) {
  const perfil = await getPerfil();

  // Só o administrador vê esta tela (a policy auditoria_select também exige): para os demais nem se consulta.
  if (!perfil || !pode(perfil, "admin")) {
    return (
      <main>
        <div className="titulo">
          <div>
            <h1>Auditoria</h1>
            <p className="sub" id="achado">
              Acesso restrito
            </p>
          </div>
        </div>
        <div id="conteudo">
          <div className="vazio-bloco">Só o administrador vê esta tela.</div>
        </div>
      </main>
    );
  }

  const f = lerFiltros(await searchParams);
  const a = await carregarAuditoria(await createClient(), f);
  const { eventos, res } = a;
  const algum = algumFiltro(f);
  const agora = new Date();

  // achado: o período inteiro, não o filtro
  const dias = a.primeiro ? Math.max(1, diasEntre(agora, a.primeiro) + 1) : 1;
  const achado = (
    <>
      {plural(a.totalGeral, "evento", "eventos")} {dias === 1 ? "no último dia" : `nos últimos ${dias} dias`}
      <Ponto />
      {plural(a.totalVistosGeral, "visualização de documento", "visualizações de documento")}, destacadas porque a LGPD exige registrar quem
      viu cada documento
    </>
  );

  const total = algum ? (
    <>
      {plural(a.totalFiltrado, "evento", "eventos")} de {a.totalGeral}
      {a.totalVistos > 0 && (
        <>
          <Ponto />
          {plural(a.totalVistos, "visualização", "visualizações")}
        </>
      )}
    </>
  ) : (
    plural(a.totalFiltrado, "evento", "eventos")
  );

  // Agrupa por dia de São Paulo, na ordem em que vêm (mais novo primeiro).
  const grupos: { dia: string; em: string; itens: Evento[] }[] = [];
  for (const e of eventos) {
    const dia = chaveDia(e.em);
    const g = grupos.find((x) => x.dia === dia);
    if (g) g.itens.push(e);
    else grupos.push({ dia, em: e.em, itens: [e] });
  }

  return (
    <main>
      <div className="titulo">
        <div>
          <h1>Auditoria</h1>
          <p className="sub" id="achado">
            {achado}
          </p>
        </div>
      </div>

      <div id="conteudo">
        <FiltrosAuditoria valores={f} usuarios={a.usuarios} registroNome={a.registroNome} total={total} />
        <div className="grade aud-grade">
          <div className="c8 aud-principal">
            <div id="linha-do-tempo">
              {grupos.length ? (
                grupos.map((g, i) => {
                  const v = g.itens.filter((e) => e.acao === "visualizacao").length;
                  return (
                    <section className="dia" aria-labelledby={`dia-${i}`} key={g.dia} data-dia={g.dia}>
                      <div className="dia-cab">
                        <h2 id={`dia-${i}`}>{rotuloDia(g.em, agora)}</h2>
                        <span>
                          {plural(g.itens.length, "evento", "eventos")}
                          {v > 0 && (
                            <>
                              <Ponto />
                              {plural(v, "visualização", "visualizações")}
                            </>
                          )}
                        </span>
                      </div>
                      <ol className="eventos">
                        {g.itens.map((e) => (
                          <EventoItem key={e.id} e={e} res={res} />
                        ))}
                      </ol>
                    </section>
                  );
                })
              ) : (
                <div className="vazio-bloco">
                  Nenhum evento com esses filtros.{" "}
                  <Link className="btn btn-texto" href="/auditoria" replace>
                    Limpar filtros
                  </Link>
                </div>
              )}
            </div>
            <div className="rodape-lista" id="rodape">
              <span>
                {eventos.length ? `Mostrando ${eventos.length} de ${a.totalFiltrado}` : `0 de ${a.totalGeral}`}
                {eventos.length < a.totalFiltrado && f.limite < LIMITE_MAXIMO && (
                  <>
                    {" "}
                    <Link
                      className="btn btn-texto"
                      id="mostrar-mais"
                      href={`/auditoria${montarBusca({ ...f, limite: f.limite + PASSO })}`}
                      replace
                      scroll={false}
                    >
                      Mostrar mais
                    </Link>
                  </>
                )}
              </span>
              <span>O banco guarda tudo; nada aqui pode ser editado nem apagado.</span>
            </div>
          </div>

          <aside className="bloco c4 aud-lgpd" aria-labelledby="h-vistos">
            <div className="bloco-cab">
              <h2 id="h-vistos">Quem viu documentos</h2>
              <span className="dir" id="vistos-n">
                {plural(a.totalVistos, "abertura", "aberturas")}
              </span>
            </div>
            <div className="bloco-corpo">
              <p className="muted">
                A LGPD exige saber quem abriu cada documento pessoal. O NILT registra toda abertura, inclusive a do administrador.
              </p>
              <div id="vistos">
                {a.vistos.length ? (
                  <ul className="vistos">
                    {a.vistos.map((e) => {
                      const arq = res.arquivos.get(e.registro_id);
                      const dono = arq ? donoDoArquivo(res, arq) : null;
                      const nome = e.usuario_id ? (res.usuarios.get(e.usuario_id)?.nome ?? "Usuário removido") : "Sistema";
                      const quando = `${rotuloDia(e.em, agora).replace(/,.*/, "").toLowerCase()} às ${hora(e.em)}`;
                      return (
                        <li key={e.id}>
                          <Avatar nome={nome} />
                          <span className="txt">
                            <span>
                              <b>{nome}</b> <span className="muted">{quando}</span>
                            </span>
                            {arq ? (
                              <>
                                {dono?.href ? <Link href={dono.href}>{arq.nome ?? "Arquivo"}</Link> : <span>{arq.nome ?? "Arquivo"}</span>}
                                <span className="de">
                                  {tipoArquivo(res.tipos.get(arq.tipo_arquivo_id) ?? "Documento")}
                                  {dono?.nome && ` de ${dono.nome}`}
                                  {arq.restrito && (
                                    <>
                                      <Ponto />
                                      restrito
                                    </>
                                  )}
                                </span>
                              </>
                            ) : (
                              <span className="de">documento apagado</span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="vazio-bloco">Nenhuma abertura de documento com esses filtros.</div>
                )}
                {a.totalVistos > a.vistos.length && (
                  <p className="muted small" style={{ marginTop: 12 }}>
                    Mostrando as {a.vistos.length} aberturas mais recentes.
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
