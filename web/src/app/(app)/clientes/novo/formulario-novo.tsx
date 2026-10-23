"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, CircleAlert, Info, Link2, LoaderCircle, RefreshCw, Search, User, UserCheck } from "lucide-react";
import { Campo } from "@/components/Campo";
import { Sinal } from "@/components/Sinal";
import { toast } from "@/components/Toast";
import type { DadosCnpj } from "@/lib/brasilapi";
import { MSG_SESSAO_EXPIRADA } from "@/lib/erros";
import { mascaras } from "@/lib/formato";
import { ConsultaDocumento, type Consulta } from "../../_pessoa/consulta-documento";
import { OpcoesUf } from "../../_pessoa/partes";
import { salvarCliente } from "../actions";

type Tipo = "pf" | "pj";
type Receita = DadosCnpj & { cnpj: string; em: string };
/** Dados da empresa abertos: com o que veio da Receita ou à mão (`receita: null`). */
type Aberto = { receita: Receita | null; versao: number };
type Props = { tipoInicial: Tipo | null; documentoInicial: string };

const MSG_RECEITA_404 = "CNPJ não encontrado na Receita. Confira os dígitos no cartão CNPJ; se estiverem certos, preencha os dados à mão.";
const MSG_RECEITA_FALHOU = "A consulta à Receita não respondeu (BrasilAPI fora do ar ou sem internet). Tente de novo em instantes ou preencha os dados à mão.";
const MSG_CORRIJA = "Corrija os campos marcados em vermelho para criar.";

/* Novo cliente: tipo → documento (confere os dígitos e procura no NILT antes de criar outro) →
   dados (empresa: da Receita pela BrasilAPI ou à mão). Faturamento, exigências e locais ficam na
   ficha. O tipo troca o formulário inteiro (`key`), então nada do outro tipo fica para trás. */
export function FormularioNovo({ tipoInicial, documentoInicial }: Props) {
  const [tipo, setTipo] = useState<Tipo>(tipoInicial ?? "pj");
  return (
    <>
      <section className="secao" aria-labelledby="h-tipo">
        <div className="secao-rotulo">
          <h2 id="h-tipo">Tipo</h2>
          <p>Quem contrata o frete: quase sempre uma empresa.</p>
        </div>
        <div className="tipos" role="radiogroup" aria-labelledby="h-tipo">
          <label className="tipo-opcao">
            <input type="radio" name="tipo" value="pj" checked={tipo === "pj"} onChange={() => setTipo("pj")} />
            <span className="cartao">
              <Building2 size={20} strokeWidth={1.6} aria-hidden="true" />
              <b>Empresa</b>
              <span>CNPJ. Razão social, fantasia e endereço vêm da Receita pela consulta do CNPJ.</span>
            </span>
          </label>
          <label className="tipo-opcao">
            <input type="radio" name="tipo" value="pf" checked={tipo === "pf"} onChange={() => setTipo("pf")} />
            <span className="cartao">
              <User size={20} strokeWidth={1.6} aria-hidden="true" />
              <b>Pessoa física</b>
              <span>CPF. Produtor rural ou pessoa que contrata o frete em nome próprio.</span>
            </span>
          </label>
        </div>
      </section>
      <FormularioTipo key={tipo} tipo={tipo} documentoInicial={tipo === tipoInicial ? documentoInicial : ""} />
    </>
  );
}

function SituacaoReceita({ situacao }: { situacao: string }) {
  const t = situacao.toUpperCase();
  if (t === "ATIVA") return <Sinal situacao="normal" texto="Ativa na Receita" />;
  if (!t) return <Sinal tipo="neutro" texto="Situação não informada" />;
  return <Sinal tipo="bloqueado" texto={`${t.charAt(0) + t.slice(1).toLowerCase()} na Receita`} />;
}

function FormularioTipo({ tipo, documentoInicial }: { tipo: Tipo; documentoInicial: string }) {
  const router = useRouter();
  const pj = tipo === "pj";
  const form = useRef<HTMLFormElement>(null);
  const buscaReceita = useRef(0);
  const docAtual = useRef("");
  const [consulta, setConsulta] = useState<Consulta>({ estado: "nada" });
  const [ligado, setLigado] = useState(false);
  const [aberto, setAberto] = useState<Aberto | null>(null);
  const [buscandoReceita, setBuscandoReceita] = useState(false);
  const [erroReceita, setErroReceita] = useState<string | null>(null);
  const [estado, enviar, gravando] = useActionState(salvarCliente, null);
  // Resposta do servidor que a pessoa já deixou para trás ao mudar o documento.
  const [dispensado, setDispensado] = useState<typeof estado>(null);

  const pessoa = consulta.estado === "achado" ? consulta.pessoa : null;
  const livre = consulta.estado === "achado" && !pessoa;
  const modo: "pf" | "pj" | "ligar" | null = pessoa ? (!pessoa.cliente && ligado ? "ligar" : null) : livre ? (pj ? (aberto ? "pj" : null) : "pf") : null;
  const receita = aberto?.receita ?? null;
  const resposta = estado !== dispensado ? estado : null;
  const campos: Record<string, string> = resposta && !resposta.ok && "campos" in resposta ? (resposta.campos as Record<string, string>) : {};
  const erro = resposta && !resposta.ok && !("campos" in resposta) ? resposta.erro : null;
  // Depois de criado, o botão fica travado até a ficha abrir.
  const travado = gravando || (resposta?.ok ?? false);

  useEffect(() => {
    if (!estado) return;
    if (estado.ok) {
      toast(pessoa ? `${pessoa.nome} agora também é cliente. Abrindo a ficha…` : "Cliente criado. Abrindo a ficha…");
      router.push(`/clientes/${estado.dados.id}?criado=1${estado.dados.semEndereco ? "&sem_endereco=1" : ""}`);
      return;
    }
    if ("campos" in estado) {
      toast(MSG_CORRIJA, "alert-circle");
      form.current?.querySelector<HTMLElement>(`[name="${Object.keys(estado.campos)[0]}"]`)?.focus();
    }
    // `pessoa` e `router` não disparam: só a resposta nova do servidor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  function mudarConsulta(c: Consulta) {
    docAtual.current = c.estado === "buscando" || c.estado === "achado" ? c.documento : "";
    buscaReceita.current++;
    setBuscandoReceita(false);
    setConsulta(c);
    setLigado(false);
    setAberto(null);
    setErroReceita(null);
    setDispensado(estado);
  }

  function abrirPj(r: Receita | null) {
    setAberto((a) => ({ receita: r, versao: (a?.versao ?? 0) + 1 }));
    setErroReceita(null);
    requestAnimationFrame(() => form.current?.querySelector<HTMLElement>("#nome")?.focus());
  }

  async function buscarReceita() {
    const d = docAtual.current;
    if (!livre || !d) return;
    const minha = ++buscaReceita.current;
    // Resposta de um CNPJ que já não está no campo (ou de uma busca mais velha) não vale: descarta.
    const atual = () => minha === buscaReceita.current && docAtual.current === d;
    setBuscandoReceita(true);
    setErroReceita(null);
    try {
      const r = await fetch(`/api/cnpj/${d}`, { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as DadosCnpj & { erro?: string };
      if (!atual()) return;
      if (r.status === 401) throw new Error(MSG_SESSAO_EXPIRADA);
      if (r.status === 404) throw new Error(MSG_RECEITA_404);
      if (!r.ok || j.erro) throw new Error(MSG_RECEITA_FALHOU);
      abrirPj({ ...j, cnpj: d, em: new Date().toISOString() });
    } catch (e) {
      if (!atual()) return;
      const m = (e as Error).message;
      setErroReceita(m === MSG_RECEITA_404 || m === MSG_SESSAO_EXPIRADA ? m : MSG_RECEITA_FALHOU);
    } finally {
      if (minha === buscaReceita.current) setBuscandoReceita(false);
    }
  }

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    // Envio manual (sem <form action>): o React não limpa os campos depois da action.
    e.preventDefault();
    if (travado) return;
    if (!modo) {
      if (pj && livre) void buscarReceita();
      return;
    }
    const dados = new FormData(e.currentTarget);
    dados.set("modo", modo);
    if (modo === "ligar" && pessoa) dados.set("pessoa_id", pessoa.id);
    setDispensado(estado);
    startTransition(() => enviar(dados));
  }


  return (
    <form id="form" ref={form} noValidate onSubmit={aoEnviar}>
      <section className="secao" aria-labelledby="h-doc">
        <div className="secao-rotulo">
          <h2 id="h-doc">Documento</h2>
          <p>
            {pj
              ? "O NILT confere os dígitos do CNPJ, procura a empresa no cadastro e busca razão social, endereço e situação na Receita (BrasilAPI)."
              : "O NILT confere os dígitos do CPF e procura a pessoa no cadastro antes de criar outra."}
          </p>
        </div>
        <div className="campos">
          <ConsultaDocumento
            tipo={pj ? "cnpj" : "cpf"}
            id={pj ? "cnpj" : "cpf"}
            name={pj ? "cnpj" : "cpf"}
            label={pj ? "CNPJ" : "CPF"}
            classe={pj ? "f6" : "f5"}
            inicial={documentoInicial}
            ajuda={`A conferência acontece sozinha ao completar os ${pj ? 14 : 11} dígitos.`}
            aoMudar={mudarConsulta}
          />
          {pj && livre && !aberto && (
            <div className="campo f6">
              <span className="rotulo" aria-hidden="true">
                &nbsp;
              </span>
              <span className="acoes-aviso">
                <button className="btn btn-primario" type="button" id="btn-receita" onClick={() => void buscarReceita()} disabled={buscandoReceita} aria-busy={buscandoReceita}>
                  {buscandoReceita ? (
                    <LoaderCircle className="gira" size={16} strokeWidth={1.6} aria-hidden="true" />
                  ) : (
                    <Search size={16} strokeWidth={1.6} aria-hidden="true" />
                  )}
                  <span>{buscandoReceita ? "Buscando…" : "Buscar na Receita"}</span>
                </button>
                <button type="button" className="btn btn-texto" id="btn-mao" onClick={() => abrirPj(null)}>
                  Preencher à mão
                </button>
              </span>
            </div>
          )}
          <div className="f12 existe" aria-live="polite">
            <Existe consulta={consulta} ligado={ligado} onLigar={() => setLigado(true)} erroReceita={erroReceita} onDeNovo={() => void buscarReceita()} onMao={() => abrirPj(null)} pj={pj} />
          </div>
        </div>
      </section>

      {modo && (
        <section className="secao" aria-labelledby="h-dados">
          <div className="secao-rotulo">
            <h2 id="h-dados">Dados</h2>
            <p>
              {modo === "ligar"
                ? "Os dados cadastrais, contatos e contas são os que já estão no NILT."
                : modo === "pf"
                  ? "O mínimo para criar. Contatos, faturamento e locais ficam na ficha."
                  : receita
                    ? "Preenchidos pela Receita. Todos podem ser corrigidos antes de criar."
                    : "Preencha como está no cartão CNPJ."}
            </p>
          </div>
          {modo === "ligar" && pessoa && (
            <div className="campos">
              <dl className="kv f12">
                <dt>Nome</dt>
                <dd>{pessoa.nome}</dd>
                <dt>{pessoa.tipo === "pj" ? "CNPJ" : "CPF"}</dt>
                <dd className="cod">{pessoa.tipo === "pj" ? mascaras.cnpj(pessoa.documento) : mascaras.cpf(pessoa.documento)}</dd>
              </dl>
            </div>
          )}
          {modo === "pf" && (
            <div className="campos">
              <Campo classe="f8" id="nome" name="nome" label="Nome completo" maxLength={110} autoComplete="off" erro={campos.nome} />
            </div>
          )}
          {modo === "pj" && aberto && (
            <div className="campos" key={aberto.versao}>
              <div className="f12 receita-estado" id="receita-estado">
                {receita ? (
                  <>
                    <SituacaoReceita situacao={receita.situacao} />
                    <span className="carimbo">
                      Consultado na Receita hoje às {new Date(receita.em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                    </span>
                    {receita.situacao.toUpperCase() !== "ATIVA" && (
                      <div className="aviso aviso-bloqueado" style={{ flexBasis: "100%" }}>
                        <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
                        <span>
                          A Receita mostra esta empresa como <b>{(receita.situacao || "sem situação").toLowerCase()}</b>. Confirme com a empresa antes de
                          fechar frete com ela.
                        </span>
                      </div>
                    )}
                    <input type="hidden" name="receita" value="1" />
                    <input type="hidden" name="fundacao" value={receita.fundacao ?? ""} />
                    <input type="hidden" name="natureza_juridica" value={receita.natureza_juridica ?? ""} />
                    <input type="hidden" name="cnae_principal" value={receita.cnae_principal ?? ""} />
                    {receita.optante_simples != null && <input type="hidden" name="optante_simples" value={receita.optante_simples ? "sim" : "nao"} />}
                  </>
                ) : (
                  <>
                    <Sinal tipo="neutro" texto="Sem consulta à Receita" />
                    <span className="carimbo">Preenchido à mão</span>
                  </>
                )}
              </div>
              <Campo classe="f8" id="nome" name="nome" label="Razão social" maxLength={110} autoComplete="off" defaultValue={receita?.nome ?? ""} erro={campos.nome} />
              <Campo classe="f4" id="nome_fantasia" name="nome_fantasia" label="Nome fantasia" opcional autoComplete="off" defaultValue={receita?.nome_fantasia ?? ""} erro={campos.nome_fantasia} />
              <Campo classe="f3" id="cep" name="cep" label="CEP" opcional mascara="cep" placeholder="00000-000" autoComplete="off" defaultValue={receita?.endereco.cep ?? ""} erro={campos.cep} />
              <Campo classe="f6" id="logradouro" name="logradouro" label="Endereço da sede" opcional autoComplete="off" defaultValue={receita?.endereco.logradouro ?? ""} erro={campos.logradouro} />
              <Campo classe="f3" id="numero" name="numero" label="Número" autoComplete="off" defaultValue={receita?.endereco.numero ?? ""} erro={campos.numero} />
              <Campo classe="f4" id="complemento" name="complemento" label="Complemento" opcional autoComplete="off" defaultValue={receita?.endereco.complemento ?? ""} />
              <Campo classe="f8" id="bairro" name="bairro" label="Bairro" opcional autoComplete="off" defaultValue={receita?.endereco.bairro ?? ""} />
              <Campo classe="f9" id="cidade" name="cidade" label="Cidade" opcional autoComplete="off" defaultValue={receita?.endereco.cidade ?? ""} erro={campos.cidade} />
              <Campo
                classe="f3"
                id="uf"
                label="UF"
                erro={campos.uf}
                controle={
                  <select id="uf" name="uf" defaultValue={receita?.endereco.uf ?? ""}>
                    <OpcoesUf />
                  </select>
                }
              />
              <p className="f12 explica">A sede vai para os contatos. Locais de coleta e descarga você cadastra na ficha, depois de criar.</p>
            </div>
          )}
        </section>
      )}

      {erro && (
        <div className="aviso aviso-bloqueado" role="alert">
          <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
          <span>{erro}</span>
        </div>
      )}

      {modo && (
        <div className="rodape-form" id="rodape">
          <span className="resumo">O cliente nasce com faturamento por CT-e e sem exigências; ajuste na ficha.</span>
          <Link className="btn" href="/clientes">
            Cancelar
          </Link>
          <button className="btn btn-primario" type="submit" id="btn-criar" disabled={travado}>
            <Check size={16} strokeWidth={1.6} aria-hidden="true" />
            {gravando ? "Gravando…" : modo === "ligar" ? "Cadastrar também como cliente" : "Criar cliente"}
          </button>
        </div>
      )}
    </form>
  );
}

type ExisteProps = {
  consulta: Consulta;
  ligado: boolean;
  onLigar: () => void;
  erroReceita: string | null;
  onDeNovo: () => void;
  onMao: () => void;
  pj: boolean;
};

/** Resultado da procura do documento: já é cliente, dá para ligar o papel, falha da consulta. */
function Existe({ consulta, ligado, onLigar, erroReceita, onDeNovo, onMao, pj }: ExisteProps) {
  const itens: ReactNode[] = [];
  if (consulta.estado === "buscando") itens.push(<p key="b" className="muted">Procurando {pj ? "o CNPJ" : "o CPF"} no NILT…</p>);
  if (consulta.estado === "erro")
    itens.push(
      <div key="e" className="aviso aviso-bloqueado" role="alert">
        <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
        <span className="txt">{consulta.erro}</span>
      </div>,
    );
  if (consulta.estado === "achado" && consulta.pessoa) {
    const p = consulta.pessoa;
    if (p.cliente)
      itens.push(
        <div key="c" className="aviso aviso-info">
          <Info size={16} strokeWidth={1.6} aria-hidden="true" />
          <span className="txt">
            <b>{p.nome}</b> já é cliente no NILT. Abra a ficha para conferir ou completar os dados.
          </span>
          <Link className="btn btn-pequeno" href={`/clientes/${p.id}`}>
            Abrir ficha
          </Link>
        </div>,
      );
    else {
      const papel = p.proprietario ? "proprietário" : p.motorista ? "motorista" : "pessoa";
      itens.push(
        <div key="l" className="aviso aviso-info">
          <UserCheck size={16} strokeWidth={1.6} aria-hidden="true" />
          <span className="txt">
            <b>{p.nome}</b> já está no NILT como {papel}. Dados, contatos e contas são os mesmos: basta ligar o papel de cliente.
          </span>
          <span className="acoes-aviso">
            <button className="btn btn-pequeno" type="button" id="btn-ligar" onClick={onLigar} disabled={ligado}>
              {ligado ? <Check size={16} strokeWidth={1.6} aria-hidden="true" /> : <Link2 size={16} strokeWidth={1.6} aria-hidden="true" />}
              {ligado ? "Ligando como cliente" : "Cadastrar também como cliente"}
            </button>
          </span>
        </div>,
      );
    }
  }
  if (erroReceita)
    itens.push(
      <div key="r" className="aviso aviso-bloqueado" role="alert">
        <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
        <span className="txt">{erroReceita}</span>
        <span className="acoes-aviso">
          <button className="btn btn-pequeno" type="button" id="btn-denovo" onClick={onDeNovo}>
            <RefreshCw size={16} strokeWidth={1.6} aria-hidden="true" />
            Tentar de novo
          </button>
          <button className="btn btn-texto btn-pequeno" type="button" id="btn-mao2" onClick={onMao}>
            Preencher à mão
          </button>
        </span>
      </div>,
    );
  return <>{itens}</>;
}
