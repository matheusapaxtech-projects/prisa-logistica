"use client";

import { useRef, useState, useTransition, type ChangeEvent, type FocusEvent, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, CircleAlert, Info, Link2, LoaderCircle, MapPin, RefreshCw, Search, User, UserCheck } from "lucide-react";
import { Campo } from "@/components/Campo";
import { Ponto } from "@/components/Ponto";
import { Sinal } from "@/components/Sinal";
import { toast } from "@/components/Toast";
import type { DadosCnpj } from "@/lib/brasilapi";
import { hojeISO } from "@/lib/datas";
import { MSG_SESSAO_EXPIRADA } from "@/lib/erros";
import { formato, mascaras } from "@/lib/formato";
import { mensagensValidacao, validacao } from "@/lib/validacao";
import { buscarPessoa } from "../../_pessoa/actions";
import { ConsultaDocumento, type Consulta } from "../../_pessoa/consulta-documento";
import { OpcoesUf } from "../../_pessoa/partes";
import { criarProprietario, dadosParaLigar, type PessoaParaLigar } from "../actions";
import { faltasAoCriar } from "../regras";

type Tipo = "pf" | "pj";
type Modo = "pf" | "pj" | "ligar" | "ligavel" | "existe" | null;
type Receita = DadosCnpj & { cnpj: string; em: string };
type Pj = { receita: Receita | null; versao: number };
type Props = { tipoInicial: Tipo | null; documentoInicial: string };

const so = validacao.soDigitos;
const MSG_RECEITA_404 = "CNPJ não encontrado na Receita. Confira os dígitos no cartão CNPJ; se estiverem certos, preencha os dados à mão.";
const MSG_RECEITA_FALHOU = "A consulta à Receita não respondeu (BrasilAPI fora do ar ou sem internet). Tente de novo em instantes ou preencha os dados à mão.";
const MSG_CEP_404 = "CEP não encontrado. Confira os dígitos ou preencha o endereço à mão.";
const MSG_CEP_FALHOU = "A consulta não respondeu. Preencha à mão ou tente de novo.";
const MSG_CORRIJA = "Corrija os campos marcados em vermelho para criar.";

/* Novo proprietário (proprietario-novo.html): tipo → documento → dados → ANTT (→ responsável).
   O tipo troca o formulário inteiro (`key`), então nada do outro tipo fica para trás. */
export function FormularioNovo({ tipoInicial, documentoInicial }: Props) {
  const [tipo, setTipo] = useState<Tipo | null>(tipoInicial);
  return (
    <>
      <section className="secao" aria-labelledby="h-tipo">
        <div className="secao-rotulo">
          <h2 id="h-tipo">Tipo</h2>
          <p>Quem está no CRLV ou na ANTT do veículo: uma pessoa ou uma empresa.</p>
        </div>
        <div className="tipos" role="radiogroup" aria-labelledby="h-tipo">
          <label className="tipo-opcao">
            <input type="radio" name="tipo" value="pf" checked={tipo === "pf"} onChange={() => setTipo("pf")} />
            <span className="cartao">
              <User size={20} strokeWidth={1.6} aria-hidden="true" />
              <b>Pessoa física</b>
              <span>CPF. Dono autônomo do caminhão, enquadrado como TAC na ANTT. Pode ser também motorista.</span>
            </span>
          </label>
          <label className="tipo-opcao">
            <input type="radio" name="tipo" value="pj" checked={tipo === "pj"} onChange={() => setTipo("pj")} />
            <span className="cartao">
              <Building2 size={20} strokeWidth={1.6} aria-hidden="true" />
              <b>Empresa</b>
              <span>CNPJ. Transportadora, cooperativa ou locadora. Os dados vêm da Receita pela consulta do CNPJ.</span>
            </span>
          </label>
        </div>
      </section>

      {tipo === null ? (
        <section className="secao" aria-labelledby="h-passos">
          <div className="secao-rotulo">
            <h2 id="h-passos">Depois do tipo</h2>
            <p>O cadastro segue nesta ordem. Cada etapa abre quando a anterior estiver certa.</p>
          </div>
          <ol className="passos-previa">
            <li>
              <b>Documento</b>
              <span>CPF conferido pelos dígitos, ou CNPJ com a consulta na Receita, que preenche razão social, fantasia e endereço.</span>
            </li>
            <li>
              <b>Dados</b>
              <span>O mínimo para criar: nome, telefone e, para empresa, o que veio da Receita, tudo editável.</span>
            </li>
            <li>
              <b>ANTT</b>
              <span>RNTRC, enquadramento (TAC só para pessoa física) e validade.</span>
            </li>
            <li>
              <b>Responsável</b>
              <span>Só para empresa: quem atende pela frota, com telefone e WhatsApp.</span>
            </li>
            <li>
              <b>Ficha completa</b>
              <span>Endereços, contas bancárias, Pix, documentos e veículos ficam na ficha do proprietário.</span>
            </li>
          </ol>
        </section>
      ) : (
        <FormularioTipo key={tipo} tipo={tipo} documentoInicial={tipo === tipoInicial ? documentoInicial : ""} />
      )}
    </>
  );
}

function SituacaoReceita({ situacao }: { situacao: string }) {
  const t = situacao.toUpperCase();
  if (t === "ATIVA") return <Sinal situacao="normal" texto="Ativa na Receita" />;
  if (!t) return <Sinal tipo="neutro" texto="Situação não informada" />;
  return <Sinal tipo="bloqueado" texto={`${t.charAt(0) + t.slice(1).toLowerCase()} na Receita`} />;
}

type ErroReceita = { texto: string } | null;

function FormularioTipo({ tipo, documentoInicial }: { tipo: Tipo; documentoInicial: string }) {
  const router = useRouter();
  const pj = tipo === "pj";
  const form = useRef<HTMLFormElement>(null);
  const cnpjRef = useRef<HTMLInputElement>(null);
  const pedido = useRef(0);
  const buscaCep = useRef(0);
  const buscaReceita = useRef(0);
  const iniciado = useRef(false);
  const [consulta, setConsulta] = useState<Consulta>({ estado: "nada" });
  const [ligado, setLigado] = useState(false);
  const [paraLigar, setParaLigar] = useState<PessoaParaLigar | null>(null);
  const [aberto, setAberto] = useState<Pj | null>(null);
  const [cnpjErro, setCnpjErro] = useState<string | null>(null);
  const [cnpjFalta, setCnpjFalta] = useState(0);
  const [buscandoReceita, setBuscandoReceita] = useState(false);
  const [erroReceita, setErroReceita] = useState<ErroReceita>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();
  const [criado, setCriado] = useState(false);
  const [valores, setValores] = useState({ rntrc: "", rntrc_validade: "", enquadramento_antt: pj ? "etc" : "tac" });
  const [erroCep, setErroCep] = useState<string | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);

  const pessoa = consulta.estado === "achado" ? consulta.pessoa : null;
  const modo: Modo = (() => {
    if (consulta.estado !== "achado") return null;
    if (pessoa) return pessoa.proprietario ? "existe" : ligado ? "ligar" : "ligavel";
    return pj ? (aberto ? "pj" : null) : "pf";
  })();
  const liberado = modo === "pf" || modo === "pj" || modo === "ligar";
  const receita = aberto?.receita ?? null;

  function mudarConsulta(c: Consulta) {
    setConsulta(c);
    setLigado(false);
    setParaLigar(null);
    setAberto(null);
    setErro(null);
    setCampos({});
    setErroReceita(null);
  }

  /* ---------- CNPJ ---------- */

  /** Confere os dígitos e procura a pessoa; devolve `true` se o CNPJ está livre para cadastrar. */
  async function conferirCnpj(explicito: boolean): Promise<boolean> {
    const el = cnpjRef.current;
    if (!el) return false;
    const d = so(el.value);
    const meu = ++pedido.current;
    mudarConsulta({ estado: "nada" });
    if (d.length < 14) {
      setCnpjFalta(d.length ? 14 - d.length : 0);
      setCnpjErro(explicito ? (d.length ? `Faltam ${14 - d.length} ${14 - d.length === 1 ? "dígito" : "dígitos"} no CNPJ.` : "Digite o CNPJ para conferir.") : null);
      return false;
    }
    setCnpjFalta(0);
    if (!validacao.cnpj(d)) {
      setCnpjErro(mensagensValidacao.cnpj);
      return false;
    }
    setCnpjErro(null);
    setConsulta({ estado: "buscando", documento: d });
    const r = await buscarPessoa(d);
    if (meu !== pedido.current) return false;
    setConsulta(r.ok ? { estado: "achado", documento: d, pessoa: r.dados } : { estado: "erro", erro: r.erro });
    return r.ok && !r.dados;
  }

  function aoDigitarCnpj(e: ChangeEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    el.value = mascaras.cnpj(el.value);
    setCnpjErro(null);
    // Digitar outro CNPJ invalida a busca na Receita que estiver no ar.
    buscaReceita.current++;
    setBuscandoReceita(false);
    if (so(el.value).length === 14) void conferirCnpj(false);
    else {
      pedido.current++;
      mudarConsulta({ estado: "nada" });
      setCnpjFalta(so(el.value).length ? 14 - so(el.value).length : 0);
    }
  }

  const montarCnpj = (el: HTMLInputElement | null) => {
    cnpjRef.current = el;
    if (el && documentoInicial && !iniciado.current) {
      iniciado.current = true;
      queueMicrotask(() => void conferirCnpj(true));
    }
  };

  function abrirPj(r: Receita | null) {
    setAberto((a) => ({ receita: r, versao: (a?.versao ?? 0) + 1 }));
    setErroReceita(null);
    requestAnimationFrame(() => form.current?.querySelector<HTMLElement>("#nome")?.focus());
  }

  async function buscarReceita() {
    const el = cnpjRef.current;
    if (!el) return;
    const d = so(el.value);
    if (d.length !== 14) {
      setCnpjErro("Digite os 14 dígitos do CNPJ antes de buscar.");
      el.focus();
      return;
    }
    if (!(await conferirCnpj(true))) return;
    // Resposta de um CNPJ que já não está no campo (ou de uma busca mais velha) não vale: descarta.
    const meu = pedido.current;
    const minha = ++buscaReceita.current;
    const atual = () => meu === pedido.current && minha === buscaReceita.current && so(cnpjRef.current?.value) === d;
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
      setErroReceita({ texto: m === MSG_RECEITA_404 || m === MSG_SESSAO_EXPIRADA ? m : MSG_RECEITA_FALHOU });
    } finally {
      if (minha === buscaReceita.current) setBuscandoReceita(false);
    }
  }

  function aoTeclarCnpj(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void buscarReceita();
    }
  }

  async function buscarCep() {
    const el = form.current?.elements.namedItem("cep") as HTMLInputElement | null;
    if (!el) return;
    const d = so(el.value);
    if (d.length !== 8) {
      setErroCep("CEP tem 8 dígitos.");
      el.focus();
      return;
    }
    setErroCep(null);
    setBuscandoCep(true);
    // Resposta de uma busca mais velha (ou de um CEP que já não está no campo) não vale: descarta.
    const minha = ++buscaCep.current;
    const atual = () =>
      minha === buscaCep.current && so((form.current?.elements.namedItem("cep") as HTMLInputElement | null)?.value) === d;
    try {
      const r = await fetch(`/api/cep/${d}`, { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as { erro?: string; logradouro?: string; bairro?: string; cidade?: string; uf?: string };
      if (!atual()) return;
      if (r.status === 401) {
        setErroCep(MSG_SESSAO_EXPIRADA);
        return;
      }
      if (r.status === 404) {
        setErroCep(MSG_CEP_404);
        return;
      }
      if (!r.ok || j.erro) throw new Error("falhou");
      const f = form.current!;
      for (const k of ["logradouro", "bairro", "cidade"] as const) (f.elements.namedItem(k) as HTMLInputElement).value = j[k] ?? "";
      (f.elements.namedItem("uf") as HTMLSelectElement).value = j.uf ?? "";
      (f.elements.namedItem("numero") as HTMLInputElement | null)?.focus();
    } catch {
      if (atual()) setErroCep(MSG_CEP_FALHOU);
    } finally {
      if (minha === buscaCep.current) setBuscandoCep(false);
    }
  }

  /* ---------- ligar o papel a quem já existe ---------- */

  async function ligar() {
    if (!pessoa) return;
    setLigado(true);
    const r = await dadosParaLigar(pessoa.id);
    if (r.ok) setParaLigar(r.dados);
    requestAnimationFrame(() => form.current?.querySelector<HTMLElement>("#rntrc")?.focus());
  }

  /* ---------- RNTRC e resumo ---------- */

  function conferirRntrc(v: string) {
    const d = so(v);
    setCampos((c) => {
      const n = { ...c };
      if (d && d.length !== 9) n.rntrc = "O RNTRC tem 9 dígitos. Confira no certificado da ANTT.";
      else delete n.rntrc;
      return n;
    });
  }

  function aoInput(e: FormEvent<HTMLFormElement>) {
    const t = e.target as HTMLInputElement;
    if (t.name === "rntrc" || t.name === "rntrc_validade" || t.name === "enquadramento_antt") setValores((v) => ({ ...v, [t.name]: t.value }));
  }

  const faltas = faltasAoCriar(valores, pj && receita ? receita.situacao : undefined);

  /* ---------- criar ---------- */

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!liberado) {
      if (pj) void buscarReceita();
      return;
    }
    const f = e.currentTarget;
    const dados = new FormData(f);
    dados.set("modo", modo === "ligar" ? "ligar" : tipo);
    if (modo === "ligar" && pessoa) dados.set("pessoa_id", pessoa.id);
    setCampos({});
    setErro(null);
    iniciar(async () => {
      const r = await criarProprietario(dados);
      if (!r.ok) {
        if ("campos" in r) {
          setCampos(r.campos);
          f.querySelector<HTMLElement>(`[name="${Object.keys(r.campos)[0]}"]`)?.focus();
          toast(MSG_CORRIJA, "alert-circle");
        } else setErro(r.erro);
        return;
      }
      setCriado(true);
      toast(modo === "ligar" ? `${pessoa?.nome} agora também é proprietário. Abrindo a ficha…` : "Proprietário criado. Abrindo a ficha…");
      for (const a of r.dados.avisos) toast(a, "alert-circle");
      router.push(`/proprietarios/${r.dados.id}?criado=1`);
    });
  }

  const explicaDados =
    modo === "pf"
      ? "O mínimo para criar. Documentos, endereço e contas ficam na ficha."
      : modo === "ligar"
        ? "Vêm da ficha de motorista. Para mudar, edite lá ou na ficha do proprietário depois de criar."
        : receita
          ? "Preenchidos pela Receita. Todos podem ser corrigidos antes de criar."
          : "Preencha como está no cartão CNPJ.";

  return (
    <form id="form" ref={form} noValidate onInput={aoInput} onSubmit={enviar}>
      <section className="secao" aria-labelledby="h-doc">
        <div className="secao-rotulo">
          <h2 id="h-doc">Documento</h2>
          <p id="doc-explica">
            {pj
              ? "O NILT confere os dígitos do CNPJ e busca razão social, endereço e situação na Receita (BrasilAPI)."
              : "O NILT confere os dígitos do CPF e procura a pessoa: se ela já é motorista, os dados pessoais são aproveitados."}
          </p>
        </div>
        <div className="campos">
          {pj ? (
            <div className="campo f8" data-invalido={cnpjErro ? "" : undefined} data-valido={consulta.estado === "achado" ? "" : undefined}>
              <label htmlFor="cnpj">CNPJ</label>
              <div className="com-acao">
                <input
                  ref={montarCnpj}
                  id="cnpj"
                  name="cnpj"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="00.000.000/0000-00"
                  defaultValue={documentoInicial ? mascaras.cnpj(documentoInicial) : undefined}
                  aria-invalid={cnpjErro ? true : undefined}
                  aria-describedby={cnpjErro ? "cnpj-erro" : "cnpj-estado"}
                  onChange={aoDigitarCnpj}
                  onKeyDown={aoTeclarCnpj}
                />
                <button className="btn" type="button" id="btn-receita" onClick={() => void buscarReceita()} disabled={buscandoReceita} aria-busy={buscandoReceita}>
                  {buscandoReceita ? (
                    <LoaderCircle className="gira" size={16} strokeWidth={1.6} aria-hidden="true" />
                  ) : (
                    <Search size={16} strokeWidth={1.6} aria-hidden="true" />
                  )}
                  <span>{buscandoReceita ? "Buscando…" : "Buscar na Receita"}</span>
                </button>
              </div>
              <span className={`doc-estado${consulta.estado === "achado" ? " ok" : ""}`} id="cnpj-estado" aria-live="polite">
                {consulta.estado === "achado" ? (
                  <>
                    <Check size={14} strokeWidth={1.6} aria-hidden="true" />
                    {!pessoa ? (
                      <span>
                        CNPJ válido. Busque na Receita ou{" "}
                        <button type="button" className="link-botao" id="btn-mao" onClick={() => abrirPj(null)}>
                          preencha à mão
                        </button>
                        .
                      </span>
                    ) : (
                      "CNPJ válido"
                    )}
                  </>
                ) : cnpjFalta > 0 && !cnpjErro ? (
                  `${cnpjFalta} ${cnpjFalta === 1 ? "dígito falta" : "dígitos faltam"}`
                ) : null}
              </span>
              {cnpjErro && (
                <span className="erro" id="cnpj-erro">
                  {cnpjErro}
                </span>
              )}
            </div>
          ) : (
            <ConsultaDocumento
              tipo="cpf"
              id="cpf"
              name="cpf"
              label="CPF"
              classe="f5"
              inicial={documentoInicial}
              ajuda="A conferência acontece sozinha ao completar os 11 dígitos."
              aoMudar={mudarConsulta}
            />
          )}
          <div className="f12 existe" aria-live="polite">
            <Existe
              consulta={consulta}
              ligado={ligado}
              onLigar={() => void ligar()}
              erroReceita={erroReceita}
              onDeNovo={() => void buscarReceita()}
              onMao={() => abrirPj(null)}
              pj={pj}
            />
          </div>
        </div>
      </section>

      {liberado && (
        <section className="secao" aria-labelledby="h-dados">
          <div className="secao-rotulo">
            <h2 id="h-dados">Dados</h2>
            <p id="dados-explica">{explicaDados}</p>
          </div>
          {modo === "pf" && (
            <div className="campos">
              <Campo classe="f8" id="nome" name="nome" label="Nome completo" maxLength={110} autoComplete="off" erro={campos.nome} />
              <Campo classe="f4" id="apelido" name="apelido" label="Apelido" opcional autoComplete="off" erro={campos.apelido} />
              <Campo classe="f4" id="nascimento" name="nascimento" type="date" label="Nascimento" opcional erro={campos.nascimento} />
              <Campo classe="f4" id="celular" name="celular" label="Celular" opcional mascara="telefone" placeholder="(00) 00000-0000" autoComplete="off" erro={campos.celular} />
              <div className="campo f4">
                <span className="rotulo" aria-hidden="true">
                  &nbsp;
                </span>
                <label className="checar">
                  <input type="checkbox" id="whatsapp" name="whatsapp" defaultChecked />
                  Celular tem WhatsApp
                </label>
              </div>
            </div>
          )}
          {modo === "ligar" && pessoa && (
            <div className="campos">
              <dl className="kv f12">
                <dt>Nome</dt>
                <dd>{pessoa.nome}</dd>
                <dt>{pessoa.tipo === "pj" ? "CNPJ" : "CPF"}</dt>
                <dd className="cod">{pessoa.tipo === "pj" ? formato.cnpj(pessoa.documento) : formato.cpf(pessoa.documento)}</dd>
                {pessoa.tipo === "pf" && (
                  <>
                    <dt>Nascimento</dt>
                    <dd>{paraLigar?.nascimento ? formato.data(paraLigar.nascimento) : <span className="dash">—</span>}</dd>
                  </>
                )}
                <dt>Celular</dt>
                <dd>
                  {paraLigar?.telefone ? (
                    <>
                      {formato.telefone(paraLigar.telefone)}
                      {paraLigar.whatsapp && (
                        <>
                          <Ponto />
                          WhatsApp
                        </>
                      )}
                    </>
                  ) : (
                    <span className="dash">—</span>
                  )}
                </dd>
                {pessoa.tipo === "pf" && (
                  <>
                    <dt>Naturalidade</dt>
                    <dd>
                      {paraLigar?.naturalidade ? (
                        <>
                          {paraLigar.naturalidade}
                          {paraLigar.naturalidade_uf && (
                            <>
                              <Ponto />
                              {paraLigar.naturalidade_uf}
                            </>
                          )}
                        </>
                      ) : (
                        <span className="dash">—</span>
                      )}
                    </dd>
                  </>
                )}
              </dl>
            </div>
          )}
          {modo === "pj" && aberto && (
            <div className="campos" key={aberto.versao}>
              <div className="f12 receita-estado" id="receita-estado">
                {receita ? (
                  <>
                    <SituacaoReceita situacao={receita.situacao} />
                    <span className="carimbo">
                      Consultado na Receita hoje às {new Date(receita.em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {receita.situacao.toUpperCase() !== "ATIVA" && (
                      <div className="aviso aviso-bloqueado" style={{ flexBasis: "100%" }}>
                        <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
                        <span>
                          A Receita mostra esta empresa como <b>{(receita.situacao || "sem situação").toLowerCase()}</b>. Confirme com a empresa antes de cadastrar: o
                          cadastro fica pendente.
                        </span>
                      </div>
                    )}
                    <input type="hidden" name="receita" value="1" />
                    <input type="hidden" name="receita_situacao" value={receita.situacao} />
                  </>
                ) : (
                  <>
                    <Sinal tipo="neutro" texto="Sem consulta à Receita" />
                    <span className="carimbo">Dá para buscar depois, na ficha</span>
                  </>
                )}
              </div>
              <Campo classe="f8" id="nome" name="nome" label="Razão social" maxLength={110} autoComplete="off" defaultValue={receita?.nome ?? ""} erro={campos.nome} />
              <Campo classe="f4" id="nome_fantasia" name="nome_fantasia" label="Nome fantasia" opcional autoComplete="off" defaultValue={receita?.nome_fantasia ?? ""} erro={campos.nome_fantasia} />
              <Campo classe="f4" id="fundacao" name="fundacao" type="date" label="Fundação" defaultValue={receita?.fundacao ?? ""} erro={campos.fundacao} />
              <Campo classe="f8" id="natureza_juridica" name="natureza_juridica" label="Natureza jurídica" autoComplete="off" defaultValue={receita?.natureza_juridica ?? ""} erro={campos.natureza_juridica} />
              <Campo classe="f12" id="cnae_principal" name="cnae_principal" label="Atividade econômica principal (CNAE)" autoComplete="off" defaultValue={receita?.cnae_principal ?? ""} erro={campos.cnae_principal} />
              <div className="campo f4">
                <span className="rotulo" id="r-simples">
                  Optante pelo Simples Nacional
                </span>
                <div className="opcoes" role="radiogroup" aria-labelledby="r-simples">
                  <label className="opcao">
                    <input type="radio" name="optante_simples" value="sim" defaultChecked={receita?.optante_simples === true} />
                    <span>Sim</span>
                  </label>
                  <label className="opcao">
                    <input type="radio" name="optante_simples" value="nao" defaultChecked={receita?.optante_simples === false} />
                    <span>Não</span>
                  </label>
                </div>
              </div>
              <Campo
                classe="f4"
                id="dt_consulta_simples"
                name="dt_consulta_simples"
                type="date"
                label="Data da consulta do Simples"
                opcional
                defaultValue={receita ? hojeISO() : ""}
                erro={campos.dt_consulta_simples}
              />
              <Campo
                classe="f4"
                id="cep"
                label="CEP"
                erro={erroCep ?? campos.cep}
                controle={
                  <div className="com-acao">
                    <input
                      id="cep"
                      name="cep"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="00000-000"
                      defaultValue={receita?.endereco.cep ? mascaras.cep(receita.endereco.cep) : ""}
                      aria-describedby="cep-erro"
                      onChange={(e) => {
                        e.currentTarget.value = mascaras.cep(e.currentTarget.value);
                        setErroCep(null);
                      }}
                    />
                    <button className="btn" type="button" id="btn-cep" aria-label="Buscar endereço pelo CEP" onClick={() => void buscarCep()} disabled={buscandoCep}>
                      {buscandoCep ? <LoaderCircle className="gira" size={16} strokeWidth={1.6} aria-hidden="true" /> : <MapPin size={16} strokeWidth={1.6} aria-hidden="true" />}
                    </button>
                  </div>
                }
              />
              <Campo classe="f8" id="logradouro" name="logradouro" label="Endereço" autoComplete="off" defaultValue={receita?.endereco.logradouro ?? ""} erro={campos.logradouro} />
              <Campo classe="f2" id="numero" name="numero" label="Número" autoComplete="off" defaultValue={receita?.endereco.numero ?? ""} erro={campos.numero} />
              <Campo classe="f4" id="complemento" name="complemento" label="Complemento" opcional autoComplete="off" defaultValue={receita?.endereco.complemento ?? ""} />
              <Campo classe="f6" id="bairro" name="bairro" label="Bairro" autoComplete="off" defaultValue={receita?.endereco.bairro ?? ""} />
              <Campo classe="f9" id="cidade" name="cidade" label="Cidade" autoComplete="off" defaultValue={receita?.endereco.cidade ?? ""} erro={campos.cidade} />
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
            </div>
          )}
        </section>
      )}

      {liberado && (
        <section className="secao" aria-labelledby="h-antt">
          <div className="secao-rotulo">
            <h2 id="h-antt">ANTT</h2>
            <p>Registro do transportador (RNTRC). Sem ele o proprietário fica pendente e o veículo não roda em nome dele.</p>
          </div>
          <div className="campos">
            <Campo
              classe="f4"
              id="rntrc"
              name="rntrc"
              label={
                <>
                  RNTRC <span className="opcional">(opcional agora)</span>
                </>
              }
              className="cod"
              mascara="digitos"
              maxLength={9}
              placeholder="9 dígitos"
              autoComplete="off"
              erro={campos.rntrc}
              onBlur={(e: FocusEvent<HTMLInputElement>) => conferirRntrc(e.currentTarget.value)}
              onChange={(e) => {
                if (campos.rntrc) conferirRntrc(e.currentTarget.value);
              }}
            />
            <Campo classe="f4" id="rntrc_emissao" name="rntrc_emissao" type="date" label="Emissão" opcional erro={campos.rntrc_emissao} />
            <Campo classe="f4" id="rntrc_validade" name="rntrc_validade" type="date" label="Validade" erro={campos.rntrc_validade} />
            <div className="campo f12">
              <span className="rotulo" id="r-enq">
                Enquadramento
              </span>
              <div className="opcoes" role="radiogroup" aria-labelledby="r-enq" id="enq">
                <Enq valor="tac" desabilitado={pj} padrao={pj ? "etc" : "tac"}>
                  TAC<em>autônomo</em>
                </Enq>
                <Enq valor="etc" padrao={pj ? "etc" : "tac"}>
                  ETC<em>empresa</em>
                </Enq>
                <Enq valor="ctc" padrao={pj ? "etc" : "tac"}>
                  CTC<em>cooperativa</em>
                </Enq>
                <Enq valor="etc_equiparado" padrao={pj ? "etc" : "tac"}>
                  ETC equiparado
                </Enq>
              </div>
              <span className="ajuda" id="enq-ajuda">
                {pj
                  ? "TAC é só para pessoa física: é o transportador autônomo, dono do caminhão. Empresa entra como ETC, CTC (cooperativa) ou ETC equiparado."
                  : "Autônomo com caminhão próprio é TAC. Use ETC equiparado só se o certificado da ANTT disser isso."}
              </span>
              {campos.enquadramento_antt && <span className="erro">{campos.enquadramento_antt}</span>}
            </div>
            <div className="campo f4">
              <span className="rotulo" id="r-agregado">
                É agregado
              </span>
              <div className="opcoes" role="radiogroup" aria-labelledby="r-agregado" aria-describedby="agregado-ajuda">
                <label className="opcao">
                  <input type="radio" name="agregado" value="sim" />
                  <span>Sim</span>
                </label>
                <label className="opcao">
                  <input type="radio" name="agregado" value="nao" defaultChecked />
                  <span>Não</span>
                </label>
              </div>
              <span className="ajuda" id="agregado-ajuda">
                Agregado trabalha com a Prisa de forma fixa. Terceiro faz uma viagem avulsa.
              </span>
            </div>
            <Campo classe="f4" id="agregado_desde" name="agregado_desde" type="date" label="Agregado desde" opcional erro={campos.agregado_desde} />
          </div>
        </section>
      )}

      {modo === "pj" && (
        <section className="secao" aria-labelledby="h-resp">
          <div className="secao-rotulo">
            <h2 id="h-resp">Responsável</h2>
            <p>Quem fala pela empresa com a operação: quem atende quando o caminhão precisa sair.</p>
          </div>
          <div className="campos">
            <Campo classe="f6" id="responsavel_nome" name="responsavel_nome" label="Nome" autoComplete="off" erro={campos.responsavel_nome} />
            <Campo classe="f3" id="responsavel_telefone" name="responsavel_telefone" label="Telefone" mascara="telefone" placeholder="(00) 00000-0000" autoComplete="off" erro={campos.responsavel_telefone} />
            <div className="campo f3">
              <span className="rotulo" aria-hidden="true">
                &nbsp;
              </span>
              <label className="checar">
                <input type="checkbox" id="responsavel_whatsapp" name="responsavel_whatsapp" defaultChecked />
                Tem WhatsApp
              </label>
            </div>
            <Campo classe="f6" id="responsavel_email" name="responsavel_email" type="email" label="E-mail" opcional placeholder="nome@empresa.com.br" autoComplete="off" erro={campos.responsavel_email} />
          </div>
        </section>
      )}

      {erro && (
        <div className="aviso aviso-bloqueado" role="alert">
          <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
          <span>{erro}</span>
        </div>
      )}

      {liberado && (
        <div className="rodape-form" id="rodape">
          <span className="resumo" id="resumo" aria-live="polite">
            Situação ao criar{" "}
            {faltas.length ? (
              <>
                <Sinal situacao="pendente" /> porque falta {faltas.join(" e ")}.
              </>
            ) : (
              <>
                <Sinal situacao="normal" /> com RNTRC, validade e enquadramento informados.
              </>
            )}
          </span>
          <Link className="btn" href="/proprietarios">
            Cancelar
          </Link>
          <button className="btn btn-primario" type="submit" id="btn-criar" disabled={gravando || criado}>
            <Check size={16} strokeWidth={1.6} aria-hidden="true" />
            {gravando ? "Gravando…" : modo === "ligar" ? "Cadastrar também como proprietário" : "Criar proprietário"}
          </button>
        </div>
      )}
    </form>
  );
}

function Enq({ valor, padrao, desabilitado, children }: { valor: string; padrao: string; desabilitado?: boolean; children: ReactNode }) {
  return (
    <label className="opcao">
      <input type="radio" name="enquadramento_antt" value={valor} defaultChecked={valor === padrao} disabled={desabilitado} />
      <span>{children}</span>
    </label>
  );
}

type ExisteProps = {
  consulta: Consulta;
  ligado: boolean;
  onLigar: () => void;
  erroReceita: ErroReceita;
  onDeNovo: () => void;
  onMao: () => void;
  pj: boolean;
};

/** Resultado da procura do documento (`#existe`): já é proprietário, dá para ligar o papel, falha. */
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
    if (p.proprietario)
      itens.push(
        <div key="p" className="aviso aviso-info">
          <Info size={16} strokeWidth={1.6} aria-hidden="true" />
          <span className="txt">
            <b>{p.nome}</b> já é proprietário no NILT. Abra a ficha para conferir ou completar os dados.
          </span>
          <Link className="btn btn-pequeno" href={`/proprietarios/${p.id}`}>
            Abrir ficha
          </Link>
        </div>,
      );
    else
      itens.push(
        <div key="l" className="aviso aviso-info">
          <UserCheck size={16} strokeWidth={1.6} aria-hidden="true" />
          <span className="txt">
            <b>{p.nome}</b> já está no NILT como {p.motorista ? "motorista" : "pessoa"}. Dados pessoais, contatos e contas são os mesmos: basta ligar o papel de proprietário.
          </span>
          <span className="acoes-aviso">
            <button className="btn btn-pequeno" type="button" id="btn-ligar" onClick={onLigar} disabled={ligado}>
              {ligado ? <Check size={16} strokeWidth={1.6} aria-hidden="true" /> : <Link2 size={16} strokeWidth={1.6} aria-hidden="true" />}
              {ligado ? "Ligando como proprietário" : "Cadastrar também como proprietário"}
            </button>
            {p.motorista && (
              <Link className="btn btn-texto btn-pequeno" href={`/motoristas/${p.id}`}>
                Ver ficha de motorista
              </Link>
            )}
          </span>
        </div>,
      );
  }
  if (erroReceita)
    itens.push(
      <div key="r" className="aviso aviso-bloqueado" role="alert">
        <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
        <span className="txt">{erroReceita.texto}</span>
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
