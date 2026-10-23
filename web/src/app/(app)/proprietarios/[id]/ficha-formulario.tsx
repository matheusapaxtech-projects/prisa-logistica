"use client";

import { useState, useTransition, type ChangeEvent, type FocusEvent, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, LoaderCircle, RefreshCw } from "lucide-react";
import { BarraSalvar, useAlteracoes } from "@/components/BarraSalvar";
import { Campo } from "@/components/Campo";
import { toast } from "@/components/Toast";
import type { DadosCnpj } from "@/lib/brasilapi";
import { hojeISO } from "@/lib/datas";
import { formato } from "@/lib/formato";
import { validacao } from "@/lib/validacao";
import { MSG_FALTAM_DADOS } from "../../_pessoa/formulario";
import { Opcoes } from "../../_pessoa/partes";
import { ROT, UFS } from "../../_pessoa/rotulos";
import { salvarFicha } from "../actions";
import type { PessoaRow, ProprietarioRow } from "../consultas";
import { lerNumero } from "../regras";
import { MarcoRntrc } from "./marco-rntrc";

type Props = {
  pessoa: PessoaRow;
  proprietario: ProprietarioRow;
  /** Aba ativa: "dados", "antt", "responsavel" e "pagamento" mostram este formulário; nas outras ele fica
     oculto (montado), para a alteração não salva sobreviver à troca de aba, como no protótipo. */
  aba: string;
  podeEditar: boolean;
  tambemMotorista: boolean;
};

const opc = (
  <>
    {" "}
    <span className="opcional">(opcional)</span>
  </>
);

const moeda = (n: number | null) => (n == null ? "" : Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const pct = (n: number | null) => (n == null ? "" : Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 }));
const real = (n: number) => "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const finito = (s: string) => {
  const n = lerNumero(s);
  return n === null || Number.isNaN(n) ? null : n;
};
const simNao = (b: boolean | null) => (b === true ? "sim" : b === false ? "nao" : "");

const REGRAS: [string, string, string][] = [
  ["peso_saida", "Peso de saída", "Paga pelo peso carregado na origem."],
  ["peso_chegada", "Peso de chegada", "Paga pelo peso descarregado no destino."],
  ["peso_chegada_se_menor", "Peso de chegada, quando menor que o de saída", "Paga pelo menor dos dois: a quebra do caminho sai do frete."],
  ["peso_chegada_com_tolerancia", "Peso de chegada com tolerância", "Paga pelo peso de chegada; a quebra até a tolerância do contrato é aceita."],
  ["peso_chegada_acima_tolerancia", "Peso de chegada, quando ultrapassar a tolerância", "Paga pelo peso de saída e só passa ao de chegada se a quebra passar da tolerância."],
];

function Secao({ id, titulo, texto, children, depois }: { id: string; titulo: string; texto?: string; children?: ReactNode; depois?: ReactNode }) {
  return (
    <section className="secao" aria-labelledby={id}>
      <div className="secao-rotulo">
        <h2 id={id}>{titulo}</h2>
        {texto && <p>{texto}</p>}
      </div>
      <div>
        {children && <div className="campos">{children}</div>}
        {depois}
      </div>
    </section>
  );
}

function Grupo({ classe, id, rotulo, children, ajuda, erro }: { classe: string; id: string; rotulo: string; children: ReactNode; ajuda?: ReactNode; erro?: string }) {
  return (
    <div className={`campo ${classe}`}>
      <span className="rotulo" id={id}>
        {rotulo}
      </span>
      <div className="opcoes" role="radiogroup" aria-labelledby={id}>
        {children}
      </div>
      {ajuda && <span className="ajuda">{ajuda}</span>}
      {erro && <span className="erro">{erro}</span>}
    </div>
  );
}

function Radio({ nome, valor, atual, desabilitado, children }: { nome: string; valor: string; atual: string; desabilitado?: boolean; children: ReactNode }) {
  return (
    <label className="opcao">
      <input type="radio" name={nome} value={valor} defaultChecked={valor === atual} disabled={desabilitado} />
      <span>{children}</span>
    </label>
  );
}

function SimNao({ nome, atual }: { nome: string; atual: string }) {
  return (
    <>
      <Radio nome={nome} valor="sim" atual={atual}>
        Sim
      </Radio>
      <Radio nome={nome} valor="nao" atual={atual}>
        Não
      </Radio>
    </>
  );
}

function Checar({ nome, rotulo, marcado, classe, onChange }: { nome: string; rotulo: string; marcado: boolean; classe: string; onChange?: (e: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div className={`campo ${classe}`}>
      <span className="rotulo" aria-hidden="true">
        &nbsp;
      </span>
      <label className="checar">
        <input type="checkbox" id={nome} name={nome} defaultChecked={marcado} onChange={onChange} />
        {rotulo}
      </label>
    </div>
  );
}

function Selecao({ classe, nome, rotulo, valor, children, erro }: { classe: string; nome: string; rotulo: ReactNode; valor: string | null; children: ReactNode; erro?: string }) {
  return (
    <Campo
      classe={classe}
      id={nome}
      label={rotulo}
      erro={erro}
      controle={
        <select id={nome} name={nome} defaultValue={valor ?? ""}>
          {children}
        </select>
      }
    />
  );
}

const OpcoesUfTraco = () => (
  <>
    <option value="">—</option>
    {UFS.map((u) => (
      <option key={u} value={u}>
        {u}
      </option>
    ))}
  </>
);

/** Campo de valor ("R$") ou percentual ("%"): número em formato brasileiro, alinhado à direita. */
function Din({ nome, rotulo, valor, tipo, erro }: { nome: string; rotulo: string; valor: number | null; tipo: "R$" | "%"; erro?: string }) {
  return (
    <Campo
      classe="f4"
      id={nome}
      label={
        <>
          {rotulo}
          {opc}
        </>
      }
      erro={erro}
      controle={
        <div className={tipo === "R$" ? "prefixo" : "sufixo"}>
          <input id={nome} name={nome} defaultValue={tipo === "R$" ? moeda(valor) : pct(valor)} inputMode="decimal" className="num" autoComplete="off" />
          <span aria-hidden="true">{tipo}</span>
        </div>
      }
    />
  );
}

type Vivo = {
  rntrc: string;
  validade: string;
  adtoPct: string;
  adtoVal: string;
  fretePct: string;
  freteVal: string;
};

function lerVivo(f: HTMLFormElement | null, inicial: Vivo): Vivo {
  if (!f) return inicial;
  const g = (n: string) => (f.elements.namedItem(n) as HTMLInputElement | null)?.value ?? "";
  return {
    rntrc: validacao.soDigitos(g("rntrc")).slice(0, 9),
    validade: g("rntrc_validade"),
    adtoPct: g("limite_adiantamento_percentual"),
    adtoVal: g("limite_adiantamento_valor"),
    fretePct: g("frete_empresa_motorista_percentual"),
    freteVal: g("frete_empresa_motorista_valor"),
  };
}

type MsgReceita = { ok: boolean; texto: ReactNode; tentarDeNovo?: boolean } | null;

/* Dados, ANTT, Responsável e Pagamento da ficha (painelDados/painelAntt/painelResp/painelPagamento de
   prototipo/proprietario.html): um formulário só, com a barra de salvar da ficha. Contatos e Contas e Pix
   gravam na hora pelos diálogos (ver _pessoa). */
export function FichaFormulario({ pessoa: p, proprietario: pr, aba, podeEditar, tambemMotorista }: Props) {
  const router = useRouter();
  const pj = p.tipo === "pj";
  const { pendente, aoAlterar, limpar } = useAlteracoes();
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  const inicialVivo: Vivo = {
    rntrc: pr.rntrc ?? "",
    validade: pr.rntrc_validade ?? "",
    adtoPct: pct(pr.limite_adiantamento_percentual),
    adtoVal: moeda(pr.limite_adiantamento_valor),
    fretePct: pct(pr.frete_empresa_motorista_percentual),
    freteVal: moeda(pr.frete_empresa_motorista_valor),
  };
  const [vivo, setVivo] = useState<Vivo>(inicialVivo);
  const [isento, setIsento] = useState(!!p.inscricao_estadual_isento);
  const consultaOriginal = p.dt_consulta_brasilapi ? `Consultado na Receita em ${formato.dataHora(p.dt_consulta_brasilapi)}` : "Ainda sem consulta à Receita";
  const [carimbo, setCarimbo] = useState(consultaOriginal);
  const [consultada, setConsultada] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [msgReceita, setMsgReceita] = useState<MsgReceita>(null);

  function marcar(nome: string, msg: string | null) {
    setCampos((c) => {
      if ((c[nome] ?? null) === msg) return c;
      const n = { ...c };
      if (msg) n[nome] = msg;
      else delete n[nome];
      return n;
    });
  }

  const conferirRntrc = (v: string) => {
    const d = validacao.soDigitos(v);
    marcar("rntrc", d && d.length !== 9 ? "O RNTRC tem 9 dígitos. Confira no certificado da ANTT." : null);
  };

  function descartar(f: HTMLFormElement | null) {
    f?.reset();
    setCampos({});
    setErro(null);
    setVivo(lerVivo(f, inicialVivo));
    setIsento(!!p.inscricao_estadual_isento);
    setCarimbo(consultaOriginal);
    setConsultada(false);
    setMsgReceita(null);
    limpar();
  }

  function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    setErro(null);
    iniciar(async () => {
      const r = await salvarFicha(p.id, dados);
      if (!r.ok) {
        if ("campos" in r) {
          setCampos(r.campos);
          toast(MSG_FALTAM_DADOS, "alert-circle");
        } else setErro(r.erro);
        return;
      }
      setCampos({});
      setConsultada(false);
      limpar();
      toast("Alterações salvas.");
      router.refresh();
    });
  }

  /** "Atualizar pela Receita" (BrasilAPI): preenche os campos da empresa; só grava ao salvar. */
  async function atualizarPelaReceita(f: HTMLFormElement | null) {
    if (!f) return;
    const campo = (n: string) => f.elements.namedItem(n) as HTMLInputElement;
    const d = validacao.soDigitos(campo("cnpj").value);
    if (!validacao.cnpj(d)) {
      setMsgReceita({ ok: false, texto: "CNPJ inválido: corrija os dígitos antes de consultar." });
      return;
    }
    setBuscando(true);
    setMsgReceita(null);
    try {
      const r = await fetch(`/api/cnpj/${d}`, { cache: "no-store" });
      const x = (await r.json()) as DadosCnpj & { erro?: string };
      if (!r.ok || x.erro) throw new Error(x.erro || "A consulta não respondeu. Preencha à mão ou tente de novo.");
      let mudou = 0;
      for (const k of ["nome", "nome_fantasia", "fundacao", "natureza_juridica", "cnae_principal"] as const) {
        const v = x[k];
        if (v && campo(k).value !== v) {
          campo(k).value = v;
          mudou++;
        }
      }
      if (x.optante_simples != null) {
        const radio = f.querySelector<HTMLInputElement>(`input[name="optante_simples"][value="${x.optante_simples ? "sim" : "nao"}"]`);
        if (radio && !radio.checked) {
          radio.checked = true;
          mudou++;
        }
      }
      campo("dt_consulta_simples").value = hojeISO();
      setCarimbo(`Consultado na Receita agora, às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`);
      setConsultada(true);
      const ativa = x.situacao.toUpperCase() === "ATIVA";
      setMsgReceita({
        ok: ativa,
        texto: (
          <>
            {ativa ? "Ativa na Receita." : <>A Receita mostra a empresa como <b>{(x.situacao || "sem situação").toLowerCase()}</b>.</>}{" "}
            {mudou ? `${mudou} ${mudou === 1 ? "campo mudou" : "campos mudaram"}: confira e salve.` : "Nada mudou em relação à ficha."} O endereço da Receita fica em Contatos se você
            quiser trocar.
          </>
        ),
      });
      f.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (e) {
      setMsgReceita({ ok: false, texto: `${(e as Error).message || "A consulta não respondeu."} Nada na ficha foi alterado.`, tentarDeNovo: true });
    } finally {
      setBuscando(false);
    }
  }

  /* ---------- prévias do pagamento ---------- */
  const ex = 10000;
  const ap = finito(vivo.adtoPct);
  const av = finito(vivo.adtoVal);
  const limites = [ap != null ? (ex * ap) / 100 : null, av].filter((x): x is number => x != null);
  const prevAdto = limites.length ? `Num frete de ${real(ex)}, o adiantamento vai até ${real(Math.min(...limites))}.` : "Sem limite próprio: vale o limite geral da Prisa.";
  const fp = finito(vivo.fretePct);
  const fv = finito(vivo.freteVal);
  const prevFrete =
    fp != null
      ? `Num frete da empresa de ${real(ex)}, o motorista recebe ${real((ex * fp) / 100)}.`
      : fv != null
        ? `O motorista recebe ${real(fv)} por frete, qualquer que seja o frete da empresa.`
        : "Sem regra própria: o frete do motorista é definido em cada contrato.";

  /* ---------- painéis ---------- */

  const inscricoes = (
    <Secao id="h-insc" titulo="Inscrições" texto="Inscrição estadual e municipal, e a atividade econômica principal.">
      <Checar nome="inscricao_estadual_isento" rotulo="Isento de inscrição estadual" marcado={isento} classe="f4" onChange={(e) => setIsento(e.currentTarget.checked)} />
      <Campo classe="f4" id="inscricao_estadual" name="inscricao_estadual" label={<>Inscrição estadual{opc}</>} className="cod" autoComplete="off" disabled={isento} defaultValue={p.inscricao_estadual ?? ""} erro={campos.inscricao_estadual} />
      <Campo classe="f4" id="inscricao_municipal" name="inscricao_municipal" label={<>Inscrição municipal{opc}</>} className="cod" autoComplete="off" defaultValue={p.inscricao_municipal ?? ""} erro={campos.inscricao_municipal} />
      {!pj && (
        <Campo classe="f12" id="cnae_principal" name="cnae_principal" label={<>Atividade econômica principal{opc}</>} placeholder="CNAE e descrição" autoComplete="off" defaultValue={p.cnae_principal ?? ""} erro={campos.cnae_principal} />
      )}
    </Secao>
  );

  const dados = pj ? (
    <>
      <Secao
        id="h-emp"
        titulo="Empresa"
        texto="Como está na Receita. A consulta pela BrasilAPI atualiza estes campos; o que você corrigir aqui vale até a próxima consulta."
      >
        <div className="f12 receita-estado" id="receita-estado">
          <span className="carimbo" id="carimbo">
            {carimbo}
          </span>
          {podeEditar && (
            <button className="btn btn-pequeno" type="button" id="btn-receita" onClick={(e) => void atualizarPelaReceita(e.currentTarget.form)} disabled={buscando} aria-busy={buscando || undefined}>
              {buscando ? <LoaderCircle className="gira" size={16} strokeWidth={1.6} aria-hidden="true" /> : <RefreshCw size={16} strokeWidth={1.6} aria-hidden="true" />}
              <span>{buscando ? "Consultando…" : "Atualizar pela Receita"}</span>
            </button>
          )}
        </div>
        <div className="f12" id="receita-msg" aria-live="polite">
          {msgReceita && (
            <div className={`aviso ${msgReceita.ok ? "aviso-normal" : "aviso-bloqueado"}`} role={msgReceita.ok ? undefined : "alert"}>
              {msgReceita.ok ? <Check size={16} strokeWidth={1.6} aria-hidden="true" /> : <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />}
              <span>
                {msgReceita.texto}
                {msgReceita.tentarDeNovo && (
                  <span className="acoes-aviso">
                    <button className="btn btn-pequeno" type="button" id="receita-denovo" onClick={(e) => void atualizarPelaReceita(e.currentTarget.form)}>
                      <RefreshCw size={16} strokeWidth={1.6} aria-hidden="true" />
                      Tentar de novo
                    </button>
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
        <input type="hidden" name="receita_consultada" value={consultada ? "1" : ""} />
        <Campo classe="f8" id="nome" name="nome" label="Razão social" maxLength={110} autoComplete="off" defaultValue={p.nome} erro={campos.nome} />
        <Campo classe="f4" id="cnpj" name="cnpj" label="CNPJ" mascara="cnpj" valida="cnpj" className="cod" autoComplete="off" defaultValue={p.cnpj ?? ""} erro={campos.cnpj} />
        <Campo classe="f8" id="nome_fantasia" name="nome_fantasia" label={<>Nome fantasia{opc}</>} autoComplete="off" defaultValue={p.nome_fantasia ?? ""} erro={campos.nome_fantasia} />
        <Campo classe="f4" id="fundacao" name="fundacao" type="date" label="Fundação" defaultValue={p.fundacao ?? ""} erro={campos.fundacao} />
        <Campo classe="f12" id="natureza_juridica" name="natureza_juridica" label="Natureza jurídica" autoComplete="off" defaultValue={p.natureza_juridica ?? ""} erro={campos.natureza_juridica} />
        <Campo classe="f12" id="cnae_principal" name="cnae_principal" label="Atividade econômica principal (CNAE)" autoComplete="off" defaultValue={p.cnae_principal ?? ""} erro={campos.cnae_principal} />
        <Grupo classe="f4" id="g-simples" rotulo="Optante pelo Simples Nacional">
          <SimNao nome="optante_simples" atual={simNao(p.optante_simples)} />
        </Grupo>
        <Campo classe="f4" id="dt_consulta_simples" name="dt_consulta_simples" type="date" label="Data da consulta do Simples" defaultValue={p.dt_consulta_simples ?? ""} erro={campos.dt_consulta_simples} />
      </Secao>
      {inscricoes}
    </>
  ) : (
    <>
      {tambemMotorista && (
        <div className="aviso aviso-info" style={{ marginBottom: 24 }}>
          <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
          <span>
            {p.nome.split(" ")[0]} também é motorista. Dados pessoais, contatos e contas são os mesmos nas duas fichas: o que mudar aqui muda lá.
          </span>
        </div>
      )}
      <Secao id="h-pf" titulo="Pessoa física" texto="Como está no CPF. O CPF é conferido pelos dígitos.">
        <Campo classe="f8" id="nome" name="nome" label="Nome completo" maxLength={110} autoComplete="off" defaultValue={p.nome} erro={campos.nome} />
        <Campo classe="f4" id="apelido" name="apelido" label={<>Apelido{opc}</>} autoComplete="off" defaultValue={p.apelido ?? ""} erro={campos.apelido} />
        <Campo classe="f4" id="cpf" name="cpf" label="CPF" mascara="cpf" valida="cpf" className="cod" autoComplete="off" defaultValue={p.cpf ?? ""} erro={campos.cpf} />
        <Selecao classe="f4" nome="situacao_cpf" rotulo="Situação do CPF" valor={p.situacao_cpf}>
          <Opcoes mapa={ROT.situacao_cpf} vazio="—" />
        </Selecao>
        <Campo classe="f4" id="dt_consulta_cpf" name="dt_consulta_cpf" type="date" label={<>Consulta da situação{opc}</>} defaultValue={p.dt_consulta_cpf ?? ""} />
        <Campo classe="f3" id="nascimento" name="nascimento" type="date" label="Nascimento" defaultValue={p.nascimento ?? ""} erro={campos.nascimento} />
        <Selecao classe="f3" nome="sexo" rotulo="Sexo" valor={p.sexo}>
          <Opcoes mapa={ROT.sexo} vazio="—" />
        </Selecao>
        <Selecao classe="f3" nome="raca_cor" rotulo="Raça/cor" valor={p.raca_cor}>
          <Opcoes mapa={ROT.raca_cor} vazio="—" />
        </Selecao>
        <Selecao classe="f3" nome="estado_civil" rotulo="Estado civil" valor={p.estado_civil}>
          <Opcoes mapa={ROT.estado_civil} vazio="—" />
        </Selecao>
        <Campo classe="f5" id="naturalidade" name="naturalidade" label="Naturalidade" autoComplete="off" defaultValue={p.naturalidade ?? ""} />
        <Selecao classe="f3" nome="naturalidade_uf" rotulo="UF" valor={p.naturalidade_uf}>
          <OpcoesUfTraco />
        </Selecao>
        <Selecao classe="f4" nome="grau_instrucao" rotulo="Grau de instrução" valor={p.grau_instrucao}>
          <Opcoes mapa={ROT.grau_instrucao} vazio="—" />
        </Selecao>
      </Secao>
      <Secao id="h-rg" titulo="RG" texto="Como está na carteira de identidade.">
        <Campo classe="f4" id="rg" name="rg" label="Número do RG" maxLength={20} className="cod" autoComplete="off" defaultValue={p.rg ?? ""} erro={campos.rg} />
        <Campo classe="f3" id="rg_orgao" name="rg_orgao" label="Órgão expedidor" autoComplete="off" defaultValue={p.rg_orgao ?? ""} />
        <Selecao classe="f2" nome="rg_uf" rotulo="UF" valor={p.rg_uf}>
          <OpcoesUfTraco />
        </Selecao>
        <Campo classe="f3" id="rg_emissao" name="rg_emissao" type="date" label={<>Emissão{opc}</>} defaultValue={p.rg_emissao ?? ""} />
      </Secao>
      <Secao id="h-fil" titulo="Filiação">
        <Campo classe="f6" id="pai" name="pai" label={<>Pai{opc}</>} maxLength={80} autoComplete="off" defaultValue={p.pai ?? ""} />
        <Campo classe="f6" id="mae" name="mae" label="Mãe" maxLength={80} autoComplete="off" defaultValue={p.mae ?? ""} />
      </Secao>
      <Secao id="h-inss" titulo="INSS" texto="Para o desconto de INSS e Sest/Senat no contrato de frete do autônomo.">
        <Campo
          classe="f4"
          id="nr_inss"
          name="nr_inss"
          label={<>Nº do INSS (NIT){opc}</>}
          maxLength={11}
          mascara="digitos"
          className="cod"
          autoComplete="off"
          defaultValue={p.nr_inss ?? ""}
          erro={campos.nr_inss}
        />
        <Selecao classe="f4" nome="qualificacao_inss" rotulo="Qualificação" valor={p.qualificacao_inss}>
          <option value="">—</option>
          <option value="qualificado">Qualificado</option>
          <option value="nao_qualificado">Não qualificado</option>
          <option value="com_pendencia">Com pendência</option>
        </Selecao>
        <Campo classe="f4" id="nr_dependentes" name="nr_dependentes" type="number" min={0} max={99} label="Dependentes" className="num" autoComplete="off" defaultValue={p.nr_dependentes ?? 0} erro={campos.nr_dependentes} />
        <Grupo classe="f12" id="g-desc" rotulo="Autoriza desconto" erro={campos.autoriza_desconto_inss}>
          <Radio nome="autoriza_desconto_inss" valor="nao" atual={pr.autoriza_desconto_inss || "nao"}>
            Não
          </Radio>
          <Radio nome="autoriza_desconto_inss" valor="inss_sest_senat" atual={pr.autoriza_desconto_inss}>
            Sim, INSS e Sest/Senat
          </Radio>
          <Radio nome="autoriza_desconto_inss" valor="sest_senat" atual={pr.autoriza_desconto_inss}>
            Sim, só Sest/Senat
          </Radio>
        </Grupo>
      </Secao>
      {inscricoes}
    </>
  );

  const antt = (
    <>
      <Secao id="h-antt" titulo="Registro na ANTT" texto="RNTRC do transportador. Vencido, o veículo não pode rodar em nome deste proprietário.">
        <Campo
          classe="f4"
          id="rntrc"
          name="rntrc"
          label="RNTRC"
          maxLength={9}
          mascara="digitos"
          className="cod"
          placeholder="9 dígitos"
          autoComplete="off"
          defaultValue={pr.rntrc ?? ""}
          erro={campos.rntrc}
          onBlur={(e: FocusEvent<HTMLInputElement>) => conferirRntrc(e.currentTarget.value)}
          onChange={(e) => {
            if (campos.rntrc) conferirRntrc(e.currentTarget.value);
          }}
        />
        <Campo classe="f4" id="rntrc_emissao" name="rntrc_emissao" type="date" label={<>Emissão{opc}</>} defaultValue={pr.rntrc_emissao ?? ""} erro={campos.rntrc_emissao} />
        <Campo classe="f4" id="rntrc_validade" name="rntrc_validade" type="date" label="Validade" defaultValue={pr.rntrc_validade ?? ""} erro={campos.rntrc_validade} />
        <div className="f12" id="marco-rntrc">
          <MarcoRntrc validade={vivo.validade} numero={vivo.rntrc} />
        </div>
        <Grupo
          classe="f8"
          id="g-enq"
          rotulo="Enquadramento"
          erro={campos.enquadramento_antt}
          ajuda={
            pj
              ? "TAC é só para pessoa física: é o transportador autônomo, dono do caminhão. Empresa é ETC, CTC (cooperativa) ou ETC equiparado."
              : "Autônomo com caminhão próprio é TAC. Use ETC equiparado só se o certificado da ANTT disser isso."
          }
        >
          <Radio nome="enquadramento_antt" valor="tac" atual={pr.enquadramento_antt ?? ""} desabilitado={pj}>
            TAC<em>autônomo</em>
          </Radio>
          <Radio nome="enquadramento_antt" valor="etc" atual={pr.enquadramento_antt ?? ""}>
            ETC<em>empresa</em>
          </Radio>
          <Radio nome="enquadramento_antt" valor="ctc" atual={pr.enquadramento_antt ?? ""}>
            CTC<em>cooperativa</em>
          </Radio>
          <Radio nome="enquadramento_antt" valor="etc_equiparado" atual={pr.enquadramento_antt ?? ""}>
            ETC equiparado
          </Radio>
        </Grupo>
        <Selecao classe="f4" nome="situacao_cadastro" rotulo="Situação do cadastro" valor={pr.situacao_cadastro} erro={campos.situacao_cadastro}>
          <Opcoes mapa={ROT.situacao_cadastro} />
        </Selecao>
      </Secao>
      <Secao id="h-oper" titulo="Operação" texto="Exigências de clientes que alguns fretes pedem.">
        <Grupo classe="f4" id="g-alto" rotulo="Operação de alto desempenho">
          <SimNao nome="alto_desempenho" atual={simNao(!!pr.alto_desempenho)} />
        </Grupo>
        <Grupo classe="f4" id="g-gmp" rotulo="Qualificado GMP+" ajuda="Certificação para transportar ingredientes de ração.">
          <SimNao nome="qualificado_gmp" atual={simNao(pr.qualificado_gmp)} />
        </Grupo>
        <Campo classe="f4" id="dt_qualificacao_gmp" name="dt_qualificacao_gmp" type="date" label={<>Data da qualificação{opc}</>} defaultValue={pr.dt_qualificacao_gmp ?? ""} erro={campos.dt_qualificacao_gmp} />
      </Secao>
    </>
  );

  const responsavel = pj && (
    <Secao id="h-resp" titulo="Responsável" texto="Quem fala pela empresa com a operação: quem atende quando o caminhão precisa sair.">
      <Campo classe="f6" id="responsavel_nome" name="responsavel_nome" label="Nome" autoComplete="off" defaultValue={pr.responsavel_nome ?? ""} erro={campos.responsavel_nome} />
      <Campo classe="f3" id="responsavel_telefone" name="responsavel_telefone" label="Telefone" mascara="telefone" placeholder="(00) 00000-0000" autoComplete="off" defaultValue={pr.responsavel_telefone ?? ""} erro={campos.responsavel_telefone} />
      <Checar nome="responsavel_whatsapp" rotulo="Tem WhatsApp" marcado={!!pr.responsavel_whatsapp} classe="f3" />
      <Campo classe="f6" id="responsavel_email" name="responsavel_email" type="email" label={<>E-mail{opc}</>} placeholder="nome@empresa.com.br" defaultValue={pr.responsavel_email ?? ""} erro={campos.responsavel_email} />
    </Secao>
  );

  const pagamento = (
    <>
      <Secao id="h-taxa" titulo="Taxa administrativa" texto="Cobrada do proprietário em cada contrato de frete. Preencha valor ou percentual.">
        <Din nome="taxa_adm_valor" rotulo="Valor" valor={pr.taxa_adm_valor} tipo="R$" erro={campos.taxa_adm_valor} />
        <Din nome="taxa_adm_percentual" rotulo="Percentual" valor={pr.taxa_adm_percentual} tipo="%" erro={campos.taxa_adm_percentual} />
      </Secao>
      <Secao
        id="h-regra"
        titulo="Pagamento do frete"
        texto="Qual peso vale para calcular o frete do motorista deste proprietário."
        depois={
          <>
            <div className="regras" role="radiogroup" aria-labelledby="h-regra">
              {REGRAS.map(([v, t, x]) => (
                <label className="regra" key={v}>
                  <input type="radio" name="regra_pgto_frete" value={v} defaultChecked={pr.regra_pgto_frete === v} />
                  <span>
                    <b>{t}</b>
                    <small>{x}</small>
                  </span>
                </label>
              ))}
            </div>
            {!pr.regra_pgto_frete && (
              <p className="explica" style={{ marginTop: 8 }}>
                Sem regra escolhida, vale a regra geral da Prisa.
              </p>
            )}
          </>
        }
      />
      <Secao id="h-adto" titulo="Limite de adiantamento" texto="Teto do adiantamento no contrato de frete. Com os dois preenchidos, vale o menor.">
        <Din nome="limite_adiantamento_percentual" rotulo="Percentual do frete" valor={pr.limite_adiantamento_percentual} tipo="%" erro={campos.limite_adiantamento_percentual} />
        <Din nome="limite_adiantamento_valor" rotulo="Valor máximo" valor={pr.limite_adiantamento_valor} tipo="R$" erro={campos.limite_adiantamento_valor} />
        <p className="f12 explica" id="prev-adto">
          {prevAdto}
        </p>
      </Secao>
      <Secao id="h-frete" titulo="Frete da empresa para o motorista" texto="Quanto do frete da empresa vira frete do motorista. Preencha valor ou percentual.">
        <Din nome="frete_empresa_motorista_valor" rotulo="Valor" valor={pr.frete_empresa_motorista_valor} tipo="R$" erro={campos.frete_empresa_motorista_valor} />
        <Din nome="frete_empresa_motorista_percentual" rotulo="Percentual" valor={pr.frete_empresa_motorista_percentual} tipo="%" erro={campos.frete_empresa_motorista_percentual} />
        <p className="f12 explica" id="prev-frete">
          {prevFrete}
        </p>
      </Secao>
    </>
  );

  const corpo = (
    <>
      <div role="tabpanel" aria-labelledby="aba-dados" hidden={aba !== "dados"}>
        {dados}
      </div>
      <div role="tabpanel" aria-labelledby="aba-antt" hidden={aba !== "antt"}>
        {antt}
      </div>
      {pj && (
        <div role="tabpanel" aria-labelledby="aba-responsavel" hidden={aba !== "responsavel"}>
          {responsavel}
        </div>
      )}
      <div role="tabpanel" aria-labelledby="aba-pagamento" hidden={aba !== "pagamento"}>
        {pagamento}
      </div>
    </>
  );

  return (
    <form
      id="form"
      noValidate
      onInput={
        podeEditar
          ? (e) => {
              aoAlterar(e);
              setVivo(lerVivo(e.currentTarget, inicialVivo));
            }
          : undefined
      }
      onSubmit={salvar}
    >
      {podeEditar ? (
        corpo
      ) : (
        <fieldset disabled className="ficha-leitura">
          {corpo}
        </fieldset>
      )}
      {erro && (
        <div className="aviso aviso-bloqueado" role="alert">
          <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
          <span>{erro}</span>
        </div>
      )}
      {podeEditar && (
        <BarraSalvar pendente={pendente} salvando={salvando} onDescartar={() => descartar(document.getElementById("form") as HTMLFormElement | null)} />
      )}
    </form>
  );
}
