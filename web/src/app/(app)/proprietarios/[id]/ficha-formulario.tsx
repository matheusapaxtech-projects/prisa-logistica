"use client";

import { useEffect, useRef, useState, useTransition, type FocusEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { BarraSalvar, useAlteracoes } from "@/components/BarraSalvar";
import { Campo } from "@/components/Campo";
import { toast } from "@/components/Toast";
import { validacao } from "@/lib/validacao";
import { BlocoPessoa } from "../../_pessoa/bloco-pessoa";
import { Checar, Grupo, opc, Radio, Secao, Selecao, SimNao, simNao } from "../../_pessoa/campos-ficha";
import { MSG_FALTAM_DADOS } from "../../_pessoa/formulario";
import { Opcoes } from "../../_pessoa/partes";
import { ROT } from "../../_pessoa/rotulos";
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

const moeda = (n: number | null) => (n == null ? "" : Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const pct = (n: number | null) => (n == null ? "" : Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 }));
const real = (n: number) => "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const finito = (s: string) => {
  const n = lerNumero(s);
  return n === null || Number.isNaN(n) ? null : n;
};

const REGRAS: [string, string, string][] = [
  ["peso_saida", "Peso de saída", "Paga pelo peso carregado na origem."],
  ["peso_chegada", "Peso de chegada", "Paga pelo peso descarregado no destino."],
  ["peso_chegada_se_menor", "Peso de chegada, quando menor que o de saída", "Paga pelo menor dos dois: a quebra do caminho sai do frete."],
  ["peso_chegada_com_tolerancia", "Peso de chegada com tolerância", "Paga pelo peso de chegada; a quebra até a tolerância do contrato é aceita."],
  ["peso_chegada_acima_tolerancia", "Peso de chegada, quando ultrapassar a tolerância", "Paga pelo peso de saída e só passa ao de chegada se a quebra passar da tolerância."],
];

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

/** Aba (painel) em que cada campo do servidor mora; o que não está aqui é de "dados". */
function painelDoCampo(nome: string): string {
  if (/^(rntrc|enquadramento_antt$|situacao_cadastro$|agregado|alto_desempenho$|qualificado_gmp$|dt_qualificacao_gmp$)/.test(nome)) return "antt";
  if (nome.startsWith("responsavel_")) return "responsavel";
  if (/^(taxa_adm_|regra_pgto_frete$|limite_adiantamento_|frete_empresa_motorista_)/.test(nome)) return "pagamento";
  return "dados";
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
  const focoPendente = useRef<string | null>(null);

  // Erro do servidor num campo de painel oculto: a página troca de aba e o foco vai para o campo aqui.
  useEffect(() => {
    const nome = focoPendente.current;
    if (!nome || painelDoCampo(nome) !== aba) return;
    focoPendente.current = null;
    document.querySelector<HTMLElement>(`#form [name="${nome}"]`)?.focus();
  }, [aba]);

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
          const primeiro = Object.keys(r.campos)[0];
          if (primeiro) {
            if (painelDoCampo(primeiro) === aba) document.querySelector<HTMLElement>(`#form [name="${primeiro}"]`)?.focus();
            else {
              focoPendente.current = primeiro;
              router.replace(`?aba=${painelDoCampo(primeiro)}`, { scroll: false });
            }
          }
        } else setErro(r.erro);
        return;
      }
      setCampos({});
      limpar();
      toast("Alterações salvas.");
      router.refresh();
    });
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

  const inss = (
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
  );

  const dados = (
    <>
      {!pj && tambemMotorista && (
        <div className="aviso aviso-info" style={{ marginBottom: 24 }}>
          <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
          <span>
            {p.nome.split(" ")[0]} também é motorista. Dados pessoais, contatos e contas são os mesmos nas duas fichas: o que mudar aqui muda lá.
          </span>
        </div>
      )}
      <BlocoPessoa pessoa={p} campos={campos} podeEditar={podeEditar} antesDasInscricoes={pj ? undefined : inss} />
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
      <Secao id="h-vinculo" titulo="Vínculo com a Prisa" texto="Agregado trabalha com a Prisa de forma fixa. Terceiro faz uma viagem avulsa.">
        <Grupo classe="f4" id="g-agregado" rotulo="É agregado">
          <SimNao nome="agregado" atual={simNao(!!pr.agregado)} />
        </Grupo>
        <Campo classe="f4" id="agregado_desde" name="agregado_desde" type="date" label={<>Agregado desde{opc}</>} defaultValue={pr.agregado_desde ?? ""} erro={campos.agregado_desde} />
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
