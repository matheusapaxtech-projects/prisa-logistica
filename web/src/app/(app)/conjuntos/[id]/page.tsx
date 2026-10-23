import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Info } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Engate } from "@/components/Engate";
import { Historico } from "@/components/Historico";
import { Placa } from "@/components/Placa";
import { Ponto } from "@/components/Ponto";
import { Sinal } from "@/components/Sinal";
import { capacidade } from "@/lib/conjunto";
import { diasAte } from "@/lib/datas";
import { formato } from "@/lib/formato";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { Aviso, avisosMotorista, ContaCapacidade } from "../avisos";
import { carregarBaseMontador, carregarFicha, cargaEfetiva, peca, RE_ID, type FichaConjunto } from "../consultas";
import { LinhaClicavel } from "../lista-conjuntos";
import { Montador } from "../montador";
import { diaSP, diasEntre, haDias, Partes } from "../partes";
import { nomeConjunto, tipoTxt, type VeiculoConjunto } from "../regras";
import { SemPermissao } from "../sem-permissao";
import { AcoesConjunto, BotaoEscolherMotorista, type DadosAcoes } from "./acoes-conjunto";
import "@/styles/paginas/conjuntos.css";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** A ficha do pedido, uma vez por requisição (metadata e página). Id que não é uuid = não encontrado. */
const fichaDoPedido = cache(async (id: string) => (RE_ID.test(id) ? carregarFicha(await createClient(), id) : null));

const nomeDe = (f: FichaConjunto) => nomeConjunto([f.cavalo.placa, ...f.itens.map((v) => v.placa)]);
const querEditar = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) === "1";

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const f = await fichaDoPedido((await params).id);
  if (!f) return { title: "Conjunto não encontrado" };
  if (querEditar((await searchParams).editar) && !f.fim) return { title: "Trocar peças" };
  return { title: `Conjunto ${nomeDe(f)}` };
}

const data = (iso: string) => formato.data(diaSP(iso));

function LinhaPeca({ v, pos }: { v: VeiculoConjunto; pos: "Cavalo" | number }) {
  const carreta = v.categoria === "carreta";
  return (
    <LinhaClicavel href={`/veiculos/${v.id}`}>
      <td className="some-celular">{pos}</td>
      <td>
        <Placa placa={v.placa} />
        <span className="linha2 so-celular">
          <Partes
            itens={[
              pos === "Cavalo" ? "Cavalo" : `Posição ${pos}`,
              tipoTxt(v.tipo),
              `tara ${formato.t(v.tara_t)}`,
              carreta && `carga ${formato.t(cargaEfetiva(v))}`,
            ]}
          />
        </span>
      </td>
      <td className="some-celular">
        <b className="id">{tipoTxt(v.tipo)}</b>
        <span className="linha2">
          <Partes itens={[`${v.marca ?? ""} ${v.modelo ?? ""}`.trim(), v.arrendado && "arrendado"]} />
        </span>
      </td>
      <td className="some-celular">{v.dono}</td>
      <td className="num some-celular">{formato.t(v.tara_t)}</td>
      <td className="num some-celular">
        {carreta ? (
          formato.t(cargaEfetiva(v))
        ) : pos === "Cavalo" ? (
          <>
            <span className="muted">CMT</span> {formato.t(v.cmt_t)}
          </>
        ) : (
          <span className="dash">—</span>
        )}
      </td>
    </LinhaClicavel>
  );
}

/* Ficha do conjunto (`renderVer` de prototipo/conjunto.html) e, com `?editar=1`, o montador em
   "Trocar peças". Encerrado = só leitura, com o aviso azul. */
export default async function ConjuntoFicha({ params, searchParams }: Params) {
  const { id } = await params;
  const f = await fichaDoPedido(id);
  if (!f) notFound();

  const perfil = await getPerfil();
  const podeEditar = pode(perfil, "editar");
  const admin = pode(perfil, "admin");
  const aberto = !f.fim;
  const nome = nomeDe(f);

  if (aberto && querEditar((await searchParams).editar)) {
    if (!podeEditar) return <SemPermissao titulo="Trocar peças" />;
    const base = await carregarBaseMontador(await createClient());
    return (
      <main>
        <Montador
          base={base}
          cavaloInicial={null}
          editar={{
            conjuntoId: f.id,
            cavaloId: f.cavalo_id,
            itens: f.itens.map((v) => v.id),
            motoristaId: f.motorista_id,
            motoristaNome: f.motorista?.nome ?? null,
          }}
        />
      </main>
    );
  }

  const cap = capacidade(f.cavalo, f.itens);
  const eixos = f.cavalo.eixos + f.itens.reduce((s, v) => s + v.eixos, 0);
  const k = f.itens.length;

  // botões e diálogos só para quem grava, e só no conjunto aberto
  let acoes: DadosAcoes | null = null;
  let dirige: Record<string, { id: string; nome: string }> = {};
  if (aberto && podeEditar) {
    const base = await carregarBaseMontador(await createClient());
    const placa = new Map(base.veiculos.map((v) => [v.id, v.placa]));
    dirige = Object.fromEntries(
      base.abertos
        .filter((c) => c.id !== f.id && c.motorista_id)
        .map((c) => [c.motorista_id!, { id: c.id, nome: nomeConjunto([c.cavalo_id, ...c.item_ids].map((x) => placa.get(x) ?? "—")) }]),
    );
    acoes = { id: f.id, nome, motoristaId: f.motorista_id, motoristaNome: f.motorista?.nome ?? null, motoristas: base.motoristas, dirige };
  }

  const mot = f.motorista;
  const cnhDias = mot?.cnh_validade ? diasAte(mot.cnh_validade) : null;

  return (
    <main>
      <div className="titulo">
        <div>
          <div className="migalha">
            <Link href={aberto ? "/conjuntos" : "/conjuntos?aba=historico"}>Conjuntos</Link>
            <span className="sep">/</span>
            <h1 id="h1" tabIndex={-1}>
              {nome}
            </h1>
            {aberto ? <Sinal situacao="ativo" texto="Aberto" /> : <Sinal tipo="neutro" texto="Encerrado" />}
            {aberto && cap.excede_cmt && <Sinal tipo="bloqueado" texto="Acima do CMT" />}
          </div>
          <p className="sub">
            {aberto ? (
              <Partes itens={[`${eixos} eixos`, `${k} ${k === 1 ? "peça" : "peças"} atrás do cavalo`, `aberto em ${data(f.inicio)}, ${haDias(f.inicio)}`]} />
            ) : (
              <Partes itens={[`${eixos} eixos`, `rodou de ${data(f.inicio)} a ${data(f.fim!)}, ${diasEntre(f.inicio, f.fim!)} dias`]} />
            )}
          </p>
        </div>
        {acoes && <AcoesConjunto d={acoes} />}
      </div>

      {!aberto && (
        <div className="avisos" style={{ marginBottom: 24 }}>
          <Aviso tipo="info" icone={Info}>
            <b>Conjunto encerrado em {data(f.fim!)}.</b> O cavalo e as peças ficaram livres para outros conjuntos.
          </Aviso>
        </div>
      )}

      <div className="grade">
        <section className="bloco c12" aria-labelledby="h-engate">
          <div className="bloco-cab">
            <h2 id="h-engate">Engate</h2>
            <span className="dir">posição 1 engata no cavalo</span>
          </div>
          <div className="bloco-corpo">
            <div className="previa engate-grande">
              <Engate cavalo={peca(f.cavalo)} itens={f.itens.map(peca)} />
            </div>
            <div className="tabela-wrap" style={{ marginTop: 16 }}>
              <table className="tabela tabela-fixa">
                <thead>
                  <tr>
                    <th className="some-celular" style={{ width: 84 }}>
                      Posição
                    </th>
                    <th style={{ width: 132 }}>Placa</th>
                    <th className="some-celular">Tipo</th>
                    <th className="some-celular">Proprietário na ANTT</th>
                    <th className="num some-celular">Tara</th>
                    <th className="num some-celular">Carga</th>
                  </tr>
                </thead>
                <tbody>
                  <LinhaPeca v={f.cavalo} pos="Cavalo" />
                  {f.itens.map((v, i) => (
                    <LinhaPeca key={v.id} v={v} pos={i + 1} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="bloco c7" aria-labelledby="h-cap">
          <div className="bloco-cab">
            <h2 id="h-cap">Capacidade</h2>
            <span className="dir">limite = CMT − taras</span>
          </div>
          <div className="bloco-corpo">
            <ContaCapacidade cavalo={f.cavalo} itens={f.itens} />
          </div>
        </section>

        <section className="bloco c5" aria-labelledby="h-mot">
          <div className="bloco-cab">
            <h2 id="h-mot">Motorista</h2>
          </div>
          <div className="bloco-corpo">
            {mot ? (
              <>
                <div className="pessoa-cab">
                  <Avatar nome={mot.nome} />
                  <div>
                    <Link href={`/motoristas/${mot.id}`}>
                      <b>{mot.nome}</b>
                    </Link>
                    <span className="small">
                      CPF <span className="cod">{formato.cpf(mot.cpf)}</span>
                    </span>
                  </div>
                </div>
                <dl className="kv">
                  <dt>CNH</dt>
                  <dd>
                    Categoria {(mot.cnh_categoria ?? "—").toUpperCase()}
                    <Ponto />
                    até {formato.data(mot.cnh_validade)}{" "}
                    {cnhDias != null && (
                      <span className={cnhDias < 0 ? "doc-validade vencido" : cnhDias <= 30 ? "doc-validade vencendo" : "muted"}>
                        ({formato.dias(cnhDias)})
                      </span>
                    )}
                  </dd>
                  <dt>Consulta de risco</dt>
                  <dd>
                    <Sinal situacao={mot.situacao_gr} />
                    {mot.gr_validade && <span className="muted"> até {formato.data(mot.gr_validade)}</span>}
                  </dd>
                  <dt>Telefone</dt>
                  <dd>
                    {mot.telefone ? (
                      <>
                        <span className="cod">{formato.telefone(mot.telefone.numero)}</span>
                        {mot.telefone.whatsapp && <span className="muted"> WhatsApp</span>}
                      </>
                    ) : (
                      <span className="dash">—</span>
                    )}
                  </dd>
                  <dt>{aberto ? "No conjunto desde" : "No conjunto"}</dt>
                  <dd>{aberto ? `${data(f.inicio)}, ${haDias(f.inicio)}` : `${data(f.inicio)} a ${data(f.fim!)}`}</dd>
                </dl>
                {aberto && <div className="avisos">{avisosMotorista({ ...mot, pessoa_id: mot.id }, dirige[mot.id] ?? null)}</div>}
              </>
            ) : (
              <div className="vazio-bloco">
                Sem motorista neste conjunto.{aberto && podeEditar && <> <BotaoEscolherMotorista /></>}
              </div>
            )}
          </div>
        </section>

        <section className={`bloco ${admin ? "c7" : "c12"}`} aria-labelledby="h-ant">
          <div className="bloco-cab">
            <h2 id="h-ant">Outros conjuntos de {f.cavalo.placa}</h2>
            <span className="dir">{f.anteriores.length}</span>
          </div>
          <div className="bloco-corpo">
            {f.anteriores.length ? (
              <div className="tempo">
                {f.anteriores.map((x) => (
                  <div className="tempo-linha" key={x.id}>
                    <span className="quando">
                      {data(x.inicio)} a {x.fim ? data(x.fim) : "hoje"}
                    </span>
                    <span>
                      <Link href={`/conjuntos/${x.id}`}>{nomeConjunto(x.placas)}</Link>
                      <span className="muted">
                        <Ponto />
                        {x.motorista ?? "sem motorista"}
                        {!x.fim && (
                          <>
                            <Ponto />
                            aberto
                          </>
                        )}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="vazio-bloco">Este é o primeiro conjunto deste cavalo.</div>
            )}
          </div>
        </section>

        {admin && (
          <section className="bloco c5 hist-conjunto" aria-labelledby="h-hist">
            <div className="bloco-cab">
              <h2 id="h-hist">Histórico de alterações</h2>
              <span className="dir">só administradores veem</span>
            </div>
            <div className="bloco-corpo">
              <Historico
                tabela="conjunto"
                registroId={f.id}
                relacionadas={[{ tabela: "conjunto_item", coluna: "conjunto_id" }]}
                titulo="Histórico de alterações"
                vazio="Nenhuma alteração registrada desde a migração do ATUA."
              />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
