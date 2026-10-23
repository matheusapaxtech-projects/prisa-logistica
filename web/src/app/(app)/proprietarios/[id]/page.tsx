import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Link2, Paperclip, Plus, TriangleAlert } from "lucide-react";
import { Abas, type Aba } from "@/components/Abas";
import { Documentos } from "@/components/Documentos";
import { Historico } from "@/components/Historico";
import { Sinal } from "@/components/Sinal";
import { tipado } from "@/lib/banco";
import { diasAte } from "@/lib/datas";
import { formato } from "@/lib/formato";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { Contatos } from "../../_pessoa/Contatos";
import { ContasPix } from "../../_pessoa/ContasPix";
import { RE_ID } from "../../_pessoa/formulario";
import { carregarFicha, estadoRntrc, type Ficha } from "../consultas";
import { ErroFicha } from "./erro-ficha";
import { FichaFormulario } from "./ficha-formulario";
import { Veiculos } from "./veiculos";
import "@/styles/paginas/pessoa.css";
import "@/styles/paginas/proprietarios.css";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  if (!RE_ID.test(id)) return { title: "Proprietário não encontrado" };
  const r = await tipado(await createClient()).from("pessoa").select("nome, nome_fantasia").eq("id", id).maybeSingle();
  return { title: r.data ? `${r.data.nome_fantasia || r.data.nome} · Proprietários` : "Proprietário não encontrado" };
}

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const plural = (n: number, a: string, b: string) => (n === 1 ? a : b);

function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="aviso aviso-pendente">
      <TriangleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/** Avisos da aba Documentos (renderDocumentos do protótipo): certificado do RNTRC e autorização de terceiro. */
function avisosDocumentos(f: Ficha): ReactNode[] {
  const avisos: ReactNode[] = [];
  const antt = f.arquivos
    .filter((a) => a.tipo === "ANTT")
    .sort((a, b) => (b.validade ?? "").localeCompare(a.validade ?? ""))[0];
  if (!antt)
    avisos.push(
      <Aviso key="antt">
        <b>Falta o certificado do RNTRC.</b> Anexe como tipo ANTT, com a validade: é o que comprova o registro na ANTT.
      </Aviso>,
    );
  else if (antt.validade && diasAte(antt.validade) < 0)
    avisos.push(
      <Aviso key="antt">
        <b>Falta o certificado do RNTRC renovado.</b> O anexado {formato.dias(diasAte(antt.validade))}: anexe o novo e atualize a validade na aba ANTT.
      </Aviso>,
    );
  if (f.terceiroSemAutorizacao)
    avisos.push(
      <Aviso key="terceiro">
        <b>Falta a autorização de pagamento em conta de terceiro.</b> A conta cadastrada não está em nome do proprietário.
      </Aviso>,
    );
  return avisos;
}

export default async function FichaProprietarioPage({ params, searchParams }: Params) {
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
    return (
      <ErroFicha titulo={p.nome}>
        <div className="vazio-bloco">
          {p.nome} está no NILT{f.motorista ? " como motorista" : ""}, mas ainda não é proprietário de veículo.
        </div>
        <div className="acoes">
          {podeEditar && (
            <Link
              className="btn btn-primario"
              href={`/proprietarios/novo?tipo=${p.tipo}&${p.tipo === "pf" ? `cpf=${p.cpf ?? ""}` : `cnpj=${p.cnpj ?? ""}`}`}
            >
              <Link2 size={16} strokeWidth={1.6} aria-hidden="true" />
              Cadastrar como proprietário
            </Link>
          )}
          {f.motorista && (
            <Link className="btn" href={`/motoristas/${p.id}`}>
              Abrir ficha de motorista
            </Link>
          )}
          {!podeEditar && !f.motorista && (
            <Link className="btn" href="/proprietarios">
              Voltar para proprietários
            </Link>
          )}
        </div>
      </ErroFicha>
    );
  }

  const { pessoa: p, proprietario: pr, veiculos } = f;
  const pj = p.tipo === "pj";
  const r = estadoRntrc(pr);
  const arrendados = veiculos.filter((v) => v.arrendado).length;
  const curto = p.nome_fantasia || p.nome.split(" ")[0];

  const abas: Aba[] = [
    { id: "dados", rotulo: "Dados" },
    { id: "antt", rotulo: "ANTT" },
    ...(pj ? [{ id: "responsavel", rotulo: "Responsável" }] : []),
    { id: "pagamento", rotulo: "Pagamento" },
    { id: "contatos", rotulo: "Contatos" },
    {
      id: "contas",
      // Marca de "titular não confere" (círculo vermelho + texto para leitor de tela). O Abas só tipa texto,
      // mas desenha o que vier: o nó é repassado como está.
      rotulo: (f.temContaForaDoTitular ? (
        <>
          Contas e Pix
          <span className="alerta-aba" aria-hidden="true" />
          <span className="sr-only"> (titular não confere)</span>
        </>
      ) : (
        "Contas e Pix"
      )) as unknown as string,
    },
    { id: "documentos", rotulo: "Documentos", n: f.arquivos.length },
    { id: "veiculos", rotulo: "Veículos", n: veiculos.length },
    ...(admin ? [{ id: "historico", rotulo: "Histórico" }] : []),
  ];
  const pedida = um(sp.aba);
  const aba = abas.some((a) => a.id === pedida) ? pedida : "dados";
  const revalidar = [`/proprietarios/${id}`, "/proprietarios"];

  const anttAnexado = f.arquivos.some((a) => a.tipo === "ANTT");
  const tipoSugerido = !anttAnexado || r.estado === "vencido" ? "ANTT" : "OUTROS";
  const avisos = aba === "documentos" ? avisosDocumentos(f) : [];

  return (
    <main className="prop">
      {um(sp.criado) && (
        <div className="aviso aviso-normal aviso-criado">
          <Check size={16} strokeWidth={1.6} aria-hidden="true" />
          <span>
            <b>Proprietário criado.</b> Complete a ficha: endereço e contatos, contas para o pagamento do frete e o certificado do RNTRC em Documentos.
          </span>
        </div>
      )}
      <div className="cab-ficha">
        <div className="ident">
          <nav className="migalha" aria-label="Caminho">
            <Link href="/proprietarios">Proprietários</Link>
            <span className="sep" aria-hidden="true">
              /
            </span>
            <h1>{p.nome}</h1>
          </nav>
          <div className="linha-doc">
            <span>
              {pj ? "CNPJ" : "CPF"} <span className="cod">{formato.doc(p)}</span>
            </span>
            {pj && p.nome_fantasia && <span>{p.nome_fantasia}</span>}
            <span>{pj ? "Empresa" : "Pessoa física"}</span>
            {f.tambemMotorista && <Link href={`/motoristas/${id}`}>também é motorista</Link>}
          </div>
          <div className="sinais">
            <Sinal situacao={pr.situacao_cadastro} />
            {r.estado === "vencido" && <Sinal situacao="vencido" texto={`RNTRC ${formato.dias(r.dias!)}`} />}
            {r.estado === "vencendo" && <Sinal situacao="vencendo" texto={`RNTRC ${formato.dias(r.dias!)}`} />}
            {r.estado === "sem" && <Sinal situacao="pendente" texto="Sem RNTRC" />}
            {arrendados > 0 && <Sinal situacao="arrendado" texto={`${arrendados} ${plural(arrendados, "veículo arrendado", "veículos arrendados")}`} />}
          </div>
        </div>
        {podeEditar && (
          <div className="acoes">
            <Link className="btn" href="?aba=documentos#enviar" scroll>
              <Paperclip size={16} strokeWidth={1.6} aria-hidden="true" />
              Anexar documento
            </Link>
            <Link className="btn btn-primario" href={`/veiculos/novo?proprietario=${id}`}>
              <Plus size={16} strokeWidth={1.6} aria-hidden="true" />
              Cadastrar veículo
            </Link>
          </div>
        )}
      </div>

      <Abas abas={abas} ativa={aba} rotulo="Partes da ficha" />

      <FichaFormulario pessoa={p} proprietario={pr} aba={aba} podeEditar={podeEditar} tambemMotorista={f.tambemMotorista} />

      {aba === "contatos" && <Contatos pessoaId={id} podeEditar={podeEditar} revalidar={revalidar} />}
      {aba === "contas" && (
        <ContasPix
          pessoaId={id}
          nome={p.nome}
          documento={(pj ? p.cnpj : p.cpf) ?? ""}
          quem={{ o: "o proprietário", do: "do proprietário", proprio: "o próprio proprietário" }}
          podeEditarFinanceiro={pode(perfil, "editarFinanceiro")}
          revalidar={revalidar}
        />
      )}
      {aba === "documentos" && (
        <>
          {avisos.length > 0 && <div className="pendencias-ficha">{avisos}</div>}
          <Documentos
            pessoaId={id}
            podeEditar={podeEditar}
            titulo="Arquivos do proprietário"
            vazio="Nenhum documento anexado."
            tipoSugerido={tipoSugerido}
            idEnvio="enviar"
          />
        </>
      )}
      {aba === "veiculos" && <Veiculos veiculos={veiculos} nome={curto} />}
      {aba === "historico" && admin && (
        <Historico
          tabela={["pessoa", "proprietario"]}
          registroId={id}
          relacionadas={[
            { tabela: "arquivo", coluna: "pessoa_id" },
            { tabela: "pessoa_telefone", coluna: "pessoa_id" },
            { tabela: "pessoa_endereco", coluna: "pessoa_id" },
            { tabela: "pessoa_email", coluna: "pessoa_id" },
            { tabela: "pessoa_conta_bancaria", coluna: "pessoa_id" },
            { tabela: "pessoa_chave_pix", coluna: "pessoa_id" },
          ]}
        />
      )}
    </main>
  );
}
