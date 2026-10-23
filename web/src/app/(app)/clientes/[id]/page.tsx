import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Link2 } from "lucide-react";
import { Abas, type Aba } from "@/components/Abas";
import { Sinal } from "@/components/Sinal";
import { tipado } from "@/lib/banco";
import { formato } from "@/lib/formato";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { Contatos } from "../../_pessoa/Contatos";
import { RE_ID } from "../../_pessoa/formulario";
import { Dash } from "../../_pessoa/partes";
import { carregarFicha, type PessoaRow } from "../consultas";
import { CONDICOES } from "../regras";
import { AbaFaturamento } from "./aba-faturamento";
import { AbaLocais } from "./aba-locais";
import "@/styles/paginas/pessoa.css";
import "@/styles/paginas/proprietarios.css";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  if (!RE_ID.test(id)) return { title: "Cliente não encontrado" };
  const r = await tipado(await createClient()).from("pessoa").select("nome, nome_fantasia").eq("id", id).maybeSingle();
  return { title: r.data ? `${r.data.nome_fantasia || r.data.nome} · Clientes` : "Cliente não encontrado" };
}

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function Migalha({ titulo }: { titulo: string }) {
  return (
    <nav className="migalha" aria-label="Caminho">
      <Link href="/clientes">Clientes</Link>
      <span className="sep" aria-hidden="true">
        /
      </span>
      <h1>{titulo}</h1>
    </nav>
  );
}

function Valor({ children }: { children: ReactNode }) {
  return <dd>{children || <Dash />}</dd>;
}

/** Aba "Dados": a identificação da pessoa (como está no cadastro) e os contatos compartilhados. */
function Identificacao({ p, outros }: { p: PessoaRow; outros: ReactNode }) {
  const pj = p.tipo === "pj";
  return (
    <section className="secao" aria-labelledby="h-ident">
      <div className="secao-rotulo">
        <h2 id="h-ident">{pj ? "Empresa" : "Pessoa física"}</h2>
        <p>
          {pj
            ? "Como está na Receita. Endereços, telefones e e-mails ficam logo abaixo, nos contatos."
            : "Como está no CPF. Endereços, telefones e e-mails ficam logo abaixo, nos contatos."}
        </p>
      </div>
      <div>
        <dl className="kv">
          <dt>{pj ? "Razão social" : "Nome"}</dt>
          <Valor>{p.nome}</Valor>
          <dt>{pj ? "CNPJ" : "CPF"}</dt>
          <dd className="cod">{formato.doc(p)}</dd>
          {pj && (
            <>
              <dt>Nome fantasia</dt>
              <Valor>{p.nome_fantasia}</Valor>
              <dt>Inscrição estadual</dt>
              <Valor>{p.inscricao_estadual_isento ? "Isento" : p.inscricao_estadual}</Valor>
              <dt>Atividade principal</dt>
              <Valor>{p.cnae_principal}</Valor>
              <dt>Consulta à Receita</dt>
              <Valor>{p.dt_consulta_brasilapi ? formato.dataHora(p.dt_consulta_brasilapi) : null}</Valor>
            </>
          )}
        </dl>
        {outros}
      </div>
    </section>
  );
}

export default async function FichaClientePage({ params, searchParams }: Params) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!RE_ID.test(id)) notFound();
  const perfil = await getPerfil();
  const podeEditar = pode(perfil, "editar");
  const f = await carregarFicha(tipado(await createClient()), id);

  if ("tipo" in f) {
    if (f.tipo === "nao_encontrado") notFound();
    const p = f.pessoa;
    return (
      <main className="prop">
        <div className="titulo">
          <div>
            <Migalha titulo={p.nome} />
          </div>
        </div>
        <div className="prop-nao-achou" role="alert">
          <div className="vazio-bloco">{p.nome} está no NILT, mas ainda não é cliente.</div>
          <div className="acoes">
            {podeEditar && (
              <Link className="btn btn-primario" href={`/clientes/novo?tipo=${p.tipo}&${p.tipo === "pf" ? `cpf=${p.cpf ?? ""}` : `cnpj=${p.cnpj ?? ""}`}`}>
                <Link2 size={16} strokeWidth={1.6} aria-hidden="true" />
                Cadastrar como cliente
              </Link>
            )}
            <Link className="btn" href="/clientes">
              Voltar para clientes
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { pessoa: p, cliente: c, locais } = f;
  const pj = p.tipo === "pj";
  const condicao = CONDICOES[c.condicao_faturamento];
  const abas: Aba[] = [
    { id: "dados", rotulo: "Dados" },
    { id: "locais", rotulo: "Locais", n: locais.length },
    { id: "faturamento", rotulo: "Faturamento e exigências" },
  ];
  const pedida = um(sp.aba);
  const aba = abas.some((a) => a.id === pedida) ? pedida : "dados";

  const outrosPapeis =
    f.tambemMotorista || f.tambemProprietario ? (
      <p className="explica" style={{ marginTop: 16 }}>
        Também é{" "}
        {f.tambemProprietario && <Link href={`/proprietarios/${id}`}>proprietário</Link>}
        {f.tambemProprietario && f.tambemMotorista && " e "}
        {f.tambemMotorista && <Link href={`/motoristas/${id}`}>motorista</Link>}: dados e contatos são os mesmos nas fichas.
      </p>
    ) : null;

  return (
    <main className="prop">
      {um(sp.criado) && (
        <div className="aviso aviso-normal aviso-criado">
          <Check size={16} strokeWidth={1.6} aria-hidden="true" />
          <span>
            <b>Cliente criado.</b> Complete a ficha: os locais de coleta e descarga e, em Faturamento e exigências, a condição de faturamento e o
            que o cliente exige.
          </span>
        </div>
      )}
      <div className="cab-ficha">
        <div className="ident">
          <Migalha titulo={p.nome_fantasia || p.nome} />
          <div className="linha-doc">
            <span>
              {pj ? "CNPJ" : "CPF"} <span className="cod">{formato.doc(p)}</span>
            </span>
            {pj && p.nome_fantasia && <span>{p.nome}</span>}
            <span>{pj ? "Empresa" : "Pessoa física"}</span>
          </div>
          <div className="sinais">
            <Sinal tipo="neutro" texto={`Faturamento ${condicao.charAt(0).toLowerCase()}${condicao.slice(1)}`} />
            {c.exige_gr && <Sinal tipo="info" texto={c.gerenciadora ? `Exige GR: ${c.gerenciadora}` : "Exige GR"} />}
            {c.exige_sm && <Sinal tipo="info" texto="Exige SM" />}
            {!locais.length && <Sinal situacao="pendente" texto="Sem local de coleta ou descarga" />}
          </div>
        </div>
      </div>

      <Abas abas={abas} ativa={aba} rotulo="Partes da ficha" />

      {aba === "dados" && (
        <>
          <Identificacao p={p} outros={outrosPapeis} />
          <Contatos pessoaId={id} podeEditar={podeEditar} revalidar={[`/clientes/${id}`, "/clientes"]} />
        </>
      )}
      {aba === "locais" && <AbaLocais pessoaId={id} locais={locais} podeEditar={podeEditar} podeApagar={pode(perfil, "admin")} />}
      {aba === "faturamento" && <AbaFaturamento key={c.updated_at} cliente={c} podeEditar={podeEditar} />}
    </main>
  );
}
