import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IdCard, Link2, Paperclip, TriangleAlert } from "lucide-react";
import { Abas, type Aba } from "@/components/Abas";
import { Documentos } from "@/components/Documentos";
import { Engate } from "@/components/Engate";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Historico } from "@/components/Historico";
import { Placa } from "@/components/Placa";
import { Ponto } from "@/components/Ponto";
import { Sinal } from "@/components/Sinal";
import { tipado } from "@/lib/banco";
import { estadoValidade } from "@/lib/datas";
import { formato } from "@/lib/formato";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { Contatos } from "../../_pessoa/Contatos";
import { ContasPix } from "../../_pessoa/ContasPix";
import { RE_ID } from "../../_pessoa/formulario";
import { ROT } from "../../_pessoa/rotulos";
import { carregarFicha, categoriaCnh, estadoGr, textoValidade, type Ficha } from "../consultas";
import { MarcaValidade } from "../validade";
import { ErroFicha } from "./erro-ficha";
import { FichaFormulario } from "./ficha-formulario";
import { Referencias } from "./referencias";
import "@/styles/paginas/pessoa.css";
import "@/styles/paginas/motoristas.css";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  if (!RE_ID.test(id)) return { title: "Motorista não encontrado" };
  const r = await tipado(await createClient()).from("pessoa").select("nome").eq("id", id).maybeSingle();
  return { title: r.data ? `${r.data.nome} · Motoristas` : "Motorista não encontrado" };
}

const ABAS_FICHA = ["dados", "cnh", "contatos", "referencias", "contas", "documentos", "gr", "historico"] as const;

function SinalCnh({ iso }: { iso: string | null }) {
  const e = estadoValidade(iso);
  if (e.cls === "neutro") return <Sinal situacao="sem_consulta" texto="CNH sem validade" />;
  if (e.cls === "vencido") return <Sinal situacao="vencido" texto="CNH vencida" />;
  if (e.cls === "vencendo") return <Sinal tipo="vencendo" texto={`CNH ${textoValidade(e)}`} />;
  return <Sinal tipo="normal" texto="CNH válida" />;
}

function SinalGr({ f }: { f: Ficha }) {
  const g = estadoGr(f.motorista);
  if (g.chave === "sem_consulta") return <Sinal situacao="sem_consulta" texto="Risco sem consulta" />;
  if (g.chave === "vencido") return <Sinal situacao="vencido" texto="Risco vencido" />;
  if (g.chave === "recusado") return <Sinal situacao="recusado" texto="Recusado pela gerenciadora" />;
  if (g.chave === "vencendo") return <Sinal tipo="vencendo" texto={`Risco ${g.sub}`} />;
  return <Sinal situacao="habilitado" texto="Risco habilitado" />;
}

/** "Para completar o cadastro: …" (faltas() do protótipo). */
function faltas(f: Ficha): string[] {
  const m = f.motorista;
  if (m.situacao_cadastro === "cancelado") return [];
  const itens: string[] = [];
  const cnh = estadoValidade(m.cnh_validade);
  if (cnh.cls === "vencido") itens.push(`renovar a CNH (${textoValidade(cnh)})`);
  if (!f.tiposArquivo.includes("CNH")) itens.push("anexar a CNH");
  if (!f.tiposArquivo.includes("COMP. RESIDÊNCIA")) itens.push("anexar o comprovante de residência");
  if (!f.temEndereco) itens.push("informar o endereço");
  if (!m.situacao_gr || m.situacao_gr === "sem_consulta") itens.push("fazer a consulta na gerenciadora de risco");
  return itens;
}

function Separados({ itens }: { itens: string[] }) {
  return (
    <>
      {itens.map((t, i) => (
        <span key={i}>
          {i > 0 && <Ponto />}
          {t}
        </span>
      ))}
    </>
  );
}

function Resumo({ f }: { f: Ficha }) {
  const { pessoa: p, motorista: m, veiculo: v } = f;
  const cat = categoriaCnh(m.cnh_categoria);
  return (
    <section className="bloco resumo" aria-label="Resumo do motorista">
      <div>
        <dl className="kv">
          <dt>CPF</dt>
          <dd>
            <span className="cod">{formato.cpf(p.cpf)}</span>
          </dd>
          <dt>Apelido</dt>
          <dd>{p.apelido || <span className="dash">—</span>}</dd>
          <dt>Telefone</dt>
          <dd>
            {f.telefone ? (
              <>
                <span className="num">{formato.telefone(f.telefone.numero)}</span>
                {f.telefone.whatsapp && (
                  <>
                    {" "}
                    <span className="muted">
                      <Ponto />
                      WhatsApp
                    </span>
                  </>
                )}
              </>
            ) : (
              <span className="dash">—</span>
            )}
          </dd>
          <dt>Cidade</dt>
          <dd>{f.cidade ?? <span className="dash">—</span>}</dd>
          <dt>CNH</dt>
          <dd>
            {cat && (
              <>
                Categoria {cat}
                <Ponto />
              </>
            )}
            <MarcaValidade iso={m.cnh_validade} prefixo="até " />
          </dd>
          {f.cadastro.por && (
            <>
              <dt>Cadastrado</dt>
              <dd>
                {formato.dataHora(f.cadastro.em).slice(0, 10)}{" "}
                <span className="muted">
                  <Ponto />
                  por {f.cadastro.por}
                </span>
              </dd>
            </>
          )}
        </dl>
      </div>
      <div>
        {v.tipo === "conjunto" ? (
          <>
            <h2>Conjunto atual</h2>
            <div className="veiculo-linha">
              <Placa placa={v.cavalo.placa} />
              <span>
                <b>{v.cavalo.marcaModelo}</b>{" "}
                <span className="muted">
                  <Ponto />
                  desde {formato.dataHora(v.inicio).slice(0, 10)}
                  <Ponto />
                  {v.eixos} eixos
                </span>
              </span>
              <Link href={`/conjuntos/${v.conjuntoId}`}>Ver conjunto</Link>
            </div>
            <Engate cavalo={v.cavaloPeca} itens={v.pecas} />
          </>
        ) : v.tipo === "ultimo" ? (
          <>
            <h2>Último veículo</h2>
            <div className="veiculo-linha">
              <Placa placa={v.veiculo.placa} />
              <span>
                <b>{v.veiculo.marcaModelo}</b>{" "}
                <span className="muted">
                  <Ponto />
                  <Separados itens={v.texto.split(" · ")} />
                </span>
              </span>
              <Link href={`/veiculos/${v.veiculo.id}`}>Ver veículo</Link>
            </div>
          </>
        ) : (
          <>
            <h2>Veículo</h2>
            <EstadoVazio>Ainda não dirigiu nenhum veículo da Prisa. Monte um conjunto para ligar o motorista a um cavalo.</EstadoVazio>
          </>
        )}
      </div>
    </section>
  );
}

export default async function FichaMotoristaPage({ params, searchParams }: Params) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!RE_ID.test(id)) notFound();
  const perfil = await getPerfil();
  const admin = pode(perfil, "admin");
  const podeEditar = pode(perfil, "editar");
  const db = tipado(await createClient());
  const f = await carregarFicha(db, id, admin);

  if ("tipo" in f) {
    if (f.tipo === "nao_encontrado") notFound();
    const p = f.pessoa;
    if (p.tipo === "pj")
      return (
        <ErroFicha titulo={p.nome}>
          <h2>{p.nome} é uma empresa</h2>
          <p>Motorista precisa ser pessoa física. Esta empresa está cadastrada como proprietária.</p>
          <div className="acoes">
            <Link className="btn btn-primario" href={`/proprietarios/${p.id}`}>
              Abrir ficha de proprietário
            </Link>
            <Link className="btn" href="/motoristas">
              Voltar para a lista
            </Link>
          </div>
        </ErroFicha>
      );
    return (
      <ErroFicha titulo={p.nome}>
        <h2>{p.nome} ainda não é motorista</h2>
        <p>
          {f.proprietario
            ? "Esta pessoa está cadastrada como proprietária. Para que ela dirija, ligue o papel de motorista: os dados pessoais, contatos e contas continuam os mesmos."
            : "O cadastro desta pessoa ficou sem o papel de motorista. Ligue o papel de motorista: os dados pessoais, contatos e contas continuam os mesmos."}
        </p>
        <div className="acoes">
          {podeEditar && (
            <Link className="btn btn-primario" href={`/motoristas/novo?cpf=${p.cpf ?? ""}`}>
              <IdCard size={16} strokeWidth={1.6} aria-hidden="true" />
              Cadastrar também como motorista
            </Link>
          )}
          {f.proprietario ? (
            <Link className="btn" href={`/proprietarios/${p.id}`}>
              Abrir ficha de proprietário
            </Link>
          ) : (
            <Link className="btn" href="/motoristas">
              Voltar para a lista
            </Link>
          )}
        </div>
      </ErroFicha>
    );
  }

  const { pessoa: p, motorista: m } = f;
  const abas: Aba[] = [
    { id: "dados", rotulo: "Dados pessoais" },
    { id: "cnh", rotulo: "CNH" },
    { id: "contatos", rotulo: "Contatos", n: f.contagens.contatos },
    { id: "referencias", rotulo: "Referências", n: f.contagens.referencias },
    { id: "contas", rotulo: "Contas e Pix", n: f.contagens.contas },
    { id: "documentos", rotulo: "Documentos", n: f.contagens.documentos },
    { id: "gr", rotulo: "Gerenciadora de risco" },
    ...(admin ? [{ id: "historico", rotulo: "Histórico" }] : []),
  ];
  const pedida = Array.isArray(sp.aba) ? sp.aba[0] : sp.aba;
  const aba = abas.some((a) => a.id === pedida) && (ABAS_FICHA as readonly string[]).includes(pedida ?? "") ? pedida! : "dados";
  const fl = faltas(f);
  const revalidar = [`/motoristas/${id}`, "/motoristas"];
  const faltaDoc = (["CNH", "COMP. RESIDÊNCIA"] as const)
    .filter((t) => !f.tiposArquivo.includes(t))
    .map((t) => (t === "CNH" ? "a CNH" : "o comprovante de residência"));

  let referencias: Parameters<typeof Referencias>[0]["referencias"] = [];
  if (aba === "referencias") {
    const r = await db
      .from("motorista_referencia")
      .select("id, tipo, nome, telefone, dt_referencia, observacao")
      .eq("motorista_id", id)
      .order("dt_referencia", { ascending: false, nullsFirst: false });
    if (r.error) throw r.error;
    referencias = r.data ?? [];
  }

  return (
    <main>
      <div className="titulo">
        <div>
          <nav className="migalha" aria-label="Caminho">
            <Link href="/motoristas">Motoristas</Link>
            <span className="sep" aria-hidden="true">
              /
            </span>
            <h1>{p.nome}</h1>
          </nav>
          <div className="ficha-cab">
            <span className="sinais">
              <Sinal situacao={m.situacao_cadastro} texto={`Cadastro ${ROT.situacao_cadastro[m.situacao_cadastro].toLowerCase()}`} />
              <SinalCnh iso={m.cnh_validade} />
              <SinalGr f={f} />
            </span>
          </div>
        </div>
        <div className="acoes">
          {f.veiculo.tipo === "conjunto" ? (
            <Link className="btn" href={`/conjuntos/${f.veiculo.conjuntoId}`}>
              <Link2 size={16} strokeWidth={1.6} aria-hidden="true" />
              Ver conjunto
            </Link>
          ) : (
            podeEditar && (
              <Link className="btn" href={`/conjuntos?novo=1&motorista=${id}`}>
                <Link2 size={16} strokeWidth={1.6} aria-hidden="true" />
                Montar conjunto
              </Link>
            )
          )}
          {podeEditar && (
            <Link className="btn btn-primario" href="?aba=documentos#enviar" scroll>
              <Paperclip size={16} strokeWidth={1.6} aria-hidden="true" />
              Anexar documento
            </Link>
          )}
        </div>
      </div>

      <div className="pendencias-ficha">
        {fl.length > 0 && (
          <div className="aviso aviso-pendente">
            <TriangleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
            <span>
              <b>Para completar o cadastro:</b> <Separados itens={fl} />.
            </span>
          </div>
        )}
      </div>

      <Resumo f={f} />

      <Abas abas={abas} ativa={aba} rotulo="Partes da ficha" />

      <FichaFormulario pessoa={p} motorista={m} aba={aba} podeEditar={podeEditar} grRotulo={estadoGr(m).rot} />

      {aba === "contatos" && (
        <Contatos
          pessoaId={id}
          podeEditar={podeEditar}
          revalidar={revalidar}
          textos={{
            enderecos: "Nenhum endereço. Adicione o residencial: o comprovante de residência precisa bater com ele.",
            telefones: "Nenhum telefone. O motorista precisa de pelo menos um para ser chamado para carga.",
            emails: "Nenhum e-mail. É opcional; marque “recebe CT-e” se ele quiser receber os conhecimentos.",
          }}
        />
      )}
      {aba === "referencias" && <Referencias motoristaId={id} referencias={referencias} podeEditar={podeEditar} />}
      {aba === "contas" && (
        <ContasPix
          pessoaId={id}
          nome={p.nome}
          documento={p.cpf ?? ""}
          quem={{ o: "o motorista", do: "do motorista", proprio: "o próprio motorista" }}
          podeEditarFinanceiro={pode(perfil, "editarFinanceiro")}
          revalidar={revalidar}
          textos={{
            contas: "Nenhuma conta. O frete do motorista só é pago em conta cadastrada aqui.",
            pix: "Nenhuma chave Pix. Ligue a chave a uma das contas acima para o financeiro conferir o titular.",
          }}
        />
      )}
      {aba === "documentos" && (
        <>
          {faltaDoc.length > 0 && m.situacao_cadastro !== "cancelado" && (
            <div className="pendencias-ficha">
              <div className="aviso aviso-pendente">
                <TriangleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
                <span>
                  <b>Falta anexar {faltaDoc.join(" e ")}.</b> Sem {faltaDoc.length > 1 ? "eles" : "ele"}, o cadastro fica pendente.
                </span>
              </div>
            </div>
          )}
          <Documentos
            pessoaId={id}
            podeEditar={podeEditar}
            titulo="Arquivos do motorista"
            vazio="Nenhum arquivo anexado. Comece pela CNH e pelo comprovante de residência."
            tipoSugerido={faltaDoc.length && !f.tiposArquivo.includes("CNH") ? "CNH" : !f.tiposArquivo.includes("COMP. RESIDÊNCIA") ? "COMP. RESIDÊNCIA" : "CNH"}
            idEnvio="enviar"
          />
        </>
      )}
      {aba === "historico" && admin && (
        <Historico
          tabela={["pessoa", "motorista"]}
          registroId={id}
          relacionadas={[
            { tabela: "arquivo", coluna: "pessoa_id" },
            { tabela: "pessoa_telefone", coluna: "pessoa_id" },
            { tabela: "pessoa_endereco", coluna: "pessoa_id" },
            { tabela: "pessoa_email", coluna: "pessoa_id" },
            { tabela: "pessoa_conta_bancaria", coluna: "pessoa_id" },
            { tabela: "pessoa_chave_pix", coluna: "pessoa_id" },
            { tabela: "motorista_referencia", coluna: "motorista_id" },
          ]}
        />
      )}
    </main>
  );
}
