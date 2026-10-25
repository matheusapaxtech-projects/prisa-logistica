"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, CircleAlert, LoaderCircle, RefreshCw } from "lucide-react";
import { Campo } from "@/components/Campo";
import type { Database } from "@/lib/banco";
import type { DadosCnpj } from "@/lib/brasilapi";
import { hojeISO } from "@/lib/datas";
import { MSG_SESSAO_EXPIRADA } from "@/lib/erros";
import { formato } from "@/lib/formato";
import { validacao } from "@/lib/validacao";
import { Checar, Grupo, opc, OpcoesUfTraco, Secao, Selecao, SimNao, simNao } from "./campos-ficha";
import { Opcoes } from "./partes";
import { ROT } from "./rotulos";

type PessoaRow = Database["public"]["Tables"]["pessoa"]["Row"];

type Props = {
  pessoa: PessoaRow;
  /** Erro de cada campo vindo do servidor (`campos[nome]`). */
  campos: Record<string, string>;
  podeEditar: boolean;
  /** Só pessoa física: seções do papel entre Filiação e Inscrições (ex.: INSS do proprietário). */
  antesDasInscricoes?: ReactNode;
};

const MSG_404 = "CNPJ não encontrado na Receita. Confira o CNPJ acima; nada na ficha foi alterado.";
const MSG_FALHOU = "A consulta à Receita não respondeu (BrasilAPI fora do ar ou sem internet). Nada na ficha foi alterado.";

type MsgReceita = { ok: boolean; texto: ReactNode; tentarDeNovo?: boolean } | null;

/* Identificação da pessoa na aba "Dados" das fichas (proprietário e cliente): Empresa (com "Atualizar
   pela Receita") ou Pessoa física, RG e Filiação, e as Inscrições. Os campos (nomes do
   `_pessoa/dados-pessoa`) vão no formulário da ficha em volta, que grava; o "Descartar" da ficha
   (`form.reset()`) também volta o estado daqui. */
export function BlocoPessoa({ pessoa: p, campos, podeEditar, antesDasInscricoes }: Props) {
  const pj = p.tipo === "pj";
  const caixa = useRef<HTMLDivElement>(null);
  const [isento, setIsento] = useState(!!p.inscricao_estadual_isento);
  const consultaOriginal = p.dt_consulta_brasilapi ? `Consultado na Receita em ${formato.dataHora(p.dt_consulta_brasilapi)}` : "Ainda sem consulta à Receita";
  const [carimbo, setCarimbo] = useState(consultaOriginal);
  const [consultada, setConsultada] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [msgReceita, setMsgReceita] = useState<MsgReceita>(null);
  const buscaReceita = useRef(0);

  // "Descartar" da ficha (form.reset()): volta isenção, carimbo e mensagem da Receita.
  const original = useRef({ isento: !!p.inscricao_estadual_isento, carimbo: consultaOriginal });
  useEffect(() => {
    original.current = { isento: !!p.inscricao_estadual_isento, carimbo: consultaOriginal };
  });
  useEffect(() => {
    const form = caixa.current?.closest("form");
    if (!form) return;
    const aoResetar = () => {
      setIsento(original.current.isento);
      setCarimbo(original.current.carimbo);
      setConsultada(false);
      setMsgReceita(null);
      buscaReceita.current++;
      setBuscando(false);
    };
    form.addEventListener("reset", aoResetar);
    return () => form.removeEventListener("reset", aoResetar);
  }, []);

  // Depois de salvar (a ficha recarrega com a data nova), a consulta feita deixa de estar pendente.
  const [dtAntes, setDtAntes] = useState(p.dt_consulta_brasilapi);
  if (p.dt_consulta_brasilapi !== dtAntes) {
    setDtAntes(p.dt_consulta_brasilapi);
    setConsultada(false);
    setCarimbo(consultaOriginal);
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
    const minha = ++buscaReceita.current;
    // Resposta de um CNPJ que já não está no campo, de uma busca mais velha ou de antes do "Descartar" não vale.
    const atual = () => minha === buscaReceita.current && validacao.soDigitos(campo("cnpj").value) === d;
    setBuscando(true);
    setMsgReceita(null);
    try {
      const r = await fetch(`/api/cnpj/${d}`, { cache: "no-store" });
      const x = (await r.json().catch(() => ({}))) as DadosCnpj & { erro?: string };
      if (!atual()) return;
      if (r.status === 401) throw new Error(MSG_SESSAO_EXPIRADA);
      if (r.status === 404) throw new Error(MSG_404);
      if (!r.ok || x.erro) throw new Error(MSG_FALHOU);
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
      if (!atual()) return;
      const m = (e as Error).message;
      setMsgReceita({ ok: false, texto: m === MSG_404 || m === MSG_SESSAO_EXPIRADA ? m : MSG_FALHOU, tentarDeNovo: true });
    } finally {
      if (minha === buscaReceita.current) setBuscando(false);
    }
  }

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

  return (
    <div ref={caixa}>
      {pj ? (
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
          {antesDasInscricoes}
          {inscricoes}
        </>
      )}
    </div>
  );
}
