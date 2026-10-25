"use client";

import { useState, useTransition, type FocusEvent, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { BarraSalvar, useAlteracoes } from "@/components/BarraSalvar";
import { Campo } from "@/components/Campo";
import { toast } from "@/components/Toast";
import { formato } from "@/lib/formato";
import { MSG_FALTAM_DADOS } from "../../_pessoa/formulario";
import { Opcoes, OpcoesUf } from "../../_pessoa/partes";
import { ROT, rotulo } from "../../_pessoa/rotulos";
import { salvarFicha } from "../actions";
import type { MotoristaRow, PessoaRow } from "../consultas";
import { erroDigitos } from "../regras";
import { MarcoValidade } from "./marco-validade";

type Props = {
  pessoa: PessoaRow;
  motorista: MotoristaRow;
  /** Aba ativa: só "dados", "cnh" e "gr" mostram este formulário; nas outras ele fica oculto
     (montado), para a alteração não salva sobreviver à troca de aba, como no protótipo. */
  aba: string;
  podeEditar: boolean;
  /** Situação da gerenciadora já calculada (rótulo do marco). */
  grRotulo: string;
};

const idDe = (nome: string) => "f-" + nome.replace(/\./g, "-");

function Secao({ titulo, texto, children }: { titulo: string; texto: string; children: ReactNode }) {
  return (
    <section className="secao">
      <div className="secao-rotulo">
        <h2>{titulo}</h2>
        <p>{texto}</p>
      </div>
      <div className="campos">{children}</div>
    </section>
  );
}

function OpcoesRadio({ nome, mapa, atual, rotulo: rot }: { nome: string; mapa: Record<string, string>; atual: string; rotulo: string }) {
  const id = `r-${idDe(nome)}`;
  return (
    <div className="campo f12">
      <span className="rotulo" id={id}>
        {rot}
      </span>
      <div className="opcoes" role="radiogroup" aria-labelledby={id}>
        {Object.entries(mapa).map(([k, v]) => (
          <label className="opcao" key={k}>
            <input type="radio" name={nome} value={k} defaultChecked={k === atual} />
            <span>{v}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/* Dados pessoais, CNH e Gerenciadora de risco da ficha (painelDados/painelCnh/painelGr de
   prototipo/motorista.html): um formulário só, com a barra de salvar da ficha. */
export function FichaFormulario({ pessoa: p, motorista: m, aba, podeEditar, grRotulo }: Props) {
  const router = useRouter();
  const { pendente, aoAlterar, limpar } = useAlteracoes();
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  function marcar(nome: string, msg: string | null) {
    setCampos((c) => {
      if ((c[nome] ?? null) === msg) return c;
      const n = { ...c };
      if (msg) n[nome] = msg;
      else delete n[nome];
      return n;
    });
  }

  // Números de tamanho fixo (INSS, registro da CNH): confere no blur; enquanto errado, a cada tecla.
  const conferirDigitos = (nome: string, t: number) => (v: string) => marcar(nome, erroDigitos(v, t));
  const digitos = (nome: string, t: number) => ({
    onBlur: (e: FocusEvent<HTMLInputElement>) => conferirDigitos(nome, t)(e.currentTarget.value),
    onChange: (e: { currentTarget: HTMLInputElement }) => {
      if (campos[nome]) conferirDigitos(nome, t)(e.currentTarget.value);
    },
  });

  function descartar(form: HTMLFormElement | null) {
    form?.reset();
    setCampos({});
    setErro(null);
    limpar();
  }

  function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const dados = new FormData(form);
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
      limpar();
      toast("Alterações salvas.");
      router.refresh();
    });
  }

  const cnhFim = (
    <>
      <b>Categoria {rotulo(ROT.cnh_categoria, m.cnh_categoria) ?? "—"}</b>
      <span>{m.cnh_primeira_habilitacao ? `habilitado desde ${m.cnh_primeira_habilitacao.slice(0, 4)}` : "primeira habilitação não informada"}</span>
    </>
  );
  const grFim = (
    <>
      <b>{grRotulo}</b>
      <span>{m.qualificado_gmp ? "qualificado GMP" : "sem qualificação GMP"}</span>
    </>
  );

  const corpo = (
    <>
      <div hidden={aba !== "dados"}>
        <Secao titulo="Cadastro" texto="Pendente enquanto faltar documento ou a CNH estiver vencida. Cancelado não recebe novas cargas.">
          <OpcoesRadio nome="motorista.situacao_cadastro" mapa={ROT.situacao_cadastro} atual={m.situacao_cadastro} rotulo="Situação do cadastro" />
          <Campo classe="f4" id={idDe("motorista.radio")} name="motorista.radio" label="Rádio" opcional defaultValue={m.radio ?? ""} autoComplete="off" erro={campos["motorista.radio"]} />
        </Secao>
        <Secao titulo="Identificação" texto="O CPF identifica a pessoa no NILT inteiro e não muda. A situação vem da consulta na Receita.">
          <Campo classe="f4" id={idDe("pessoa.cpf")} label="CPF" className="cod" readOnly defaultValue={formato.cpf(p.cpf)} ajuda="Para corrigir um CPF, fale com o administrador." />
          <Campo
            classe="f4"
            id={idDe("pessoa.situacao_cpf")}
            label="Situação do CPF"
            controle={
              <select id={idDe("pessoa.situacao_cpf")} name="pessoa.situacao_cpf" defaultValue={p.situacao_cpf ?? ""}>
                <Opcoes mapa={ROT.situacao_cpf} vazio="Não consultado" />
              </select>
            }
          />
          <Campo classe="f4" id={idDe("pessoa.dt_consulta_cpf")} name="pessoa.dt_consulta_cpf" type="date" label="Data da consulta" defaultValue={p.dt_consulta_cpf ?? ""} />
          <Campo
            classe="f8"
            id={idDe("pessoa.nome")}
            name="pessoa.nome"
            label="Nome completo"
            maxLength={110}
            required
            autoComplete="off"
            defaultValue={p.nome}
            erro={campos["pessoa.nome"]}
            onBlur={(e) => marcar("pessoa.nome", e.currentTarget.value.trim().split(/\s+/).length < 2 ? "Informe o nome completo, com sobrenome." : null)}
            onChange={() => marcar("pessoa.nome", null)}
          />
          <Campo classe="f4" id={idDe("pessoa.apelido")} name="pessoa.apelido" label="Apelido" opcional autoComplete="off" defaultValue={p.apelido ?? ""} />
        </Secao>
        <Secao titulo="Dados pessoais" texto="Na ordem da ficha do ATUA. Raça/cor e grau de instrução vão para o eSocial.">
          <Campo
            classe="f6"
            id={idDe("pessoa.sexo")}
            label="Sexo"
            controle={
              <select id={idDe("pessoa.sexo")} name="pessoa.sexo" defaultValue={p.sexo ?? ""}>
                <Opcoes mapa={ROT.sexo} vazio="Não informado" />
              </select>
            }
          />
          <Campo
            classe="f6"
            id={idDe("pessoa.raca_cor")}
            label="Raça/cor"
            controle={
              <select id={idDe("pessoa.raca_cor")} name="pessoa.raca_cor" defaultValue={p.raca_cor ?? ""}>
                <Opcoes mapa={ROT.raca_cor} vazio="Selecione" />
              </select>
            }
          />
          <Campo classe="f4" id={idDe("pessoa.nascimento")} name="pessoa.nascimento" type="date" label="Nascimento" defaultValue={p.nascimento ?? ""} />
          <Campo classe="f5" id={idDe("pessoa.naturalidade")} name="pessoa.naturalidade" label="Naturalidade" placeholder="Cidade onde nasceu" autoComplete="off" defaultValue={p.naturalidade ?? ""} />
          <Campo
            classe="f3"
            id={idDe("pessoa.naturalidade_uf")}
            label="UF"
            controle={
              <select id={idDe("pessoa.naturalidade_uf")} name="pessoa.naturalidade_uf" defaultValue={p.naturalidade_uf ?? ""}>
                <OpcoesUf />
              </select>
            }
          />
          <Campo
            classe="f6"
            id={idDe("pessoa.grau_instrucao")}
            label="Grau de instrução"
            controle={
              <select id={idDe("pessoa.grau_instrucao")} name="pessoa.grau_instrucao" defaultValue={p.grau_instrucao ?? ""}>
                <Opcoes mapa={ROT.grau_instrucao} vazio="Não informado" />
              </select>
            }
          />
          <Campo
            classe="f6"
            id={idDe("pessoa.estado_civil")}
            label="Estado civil"
            controle={
              <select id={idDe("pessoa.estado_civil")} name="pessoa.estado_civil" defaultValue={p.estado_civil ?? ""}>
                <Opcoes mapa={ROT.estado_civil} vazio="Não informado" />
              </select>
            }
          />
        </Secao>
        <Secao titulo="RG" texto="Como está no documento de identidade.">
          <Campo classe="f4" id={idDe("pessoa.rg")} name="pessoa.rg" label="Número do RG" className="cod" maxLength={20} autoComplete="off" defaultValue={p.rg ?? ""} erro={campos["pessoa.rg"]} />
          <Campo classe="f3" id={idDe("pessoa.rg_orgao")} name="pessoa.rg_orgao" label="Órgão expedidor" placeholder="SSP" autoComplete="off" defaultValue={p.rg_orgao ?? ""} />
          <Campo
            classe="f2"
            id={idDe("pessoa.rg_uf")}
            label="UF"
            controle={
              <select id={idDe("pessoa.rg_uf")} name="pessoa.rg_uf" defaultValue={p.rg_uf ?? ""}>
                <OpcoesUf />
              </select>
            }
          />
          <Campo classe="f3" id={idDe("pessoa.rg_emissao")} name="pessoa.rg_emissao" type="date" label="Emissão" defaultValue={p.rg_emissao ?? ""} />
        </Secao>
        <Secao titulo="Filiação" texto="Nome do pai e da mãe, como no RG.">
          <Campo classe="f6" id={idDe("pessoa.pai")} name="pessoa.pai" label="Pai" opcional maxLength={80} autoComplete="off" defaultValue={p.pai ?? ""} />
          <Campo classe="f6" id={idDe("pessoa.mae")} name="pessoa.mae" label="Mãe" maxLength={80} autoComplete="off" defaultValue={p.mae ?? ""} />
        </Secao>
        <Secao titulo="INSS" texto="Número do NIT ou PIS, usado no desconto de INSS, SEST e SENAT do frete.">
          <Campo
            classe="f4"
            id={idDe("pessoa.nr_inss")}
            name="pessoa.nr_inss"
            label="Número do INSS (NIT)"
            className="cod"
            mascara="digitos"
            maxLength={11}
            autoComplete="off"
            defaultValue={p.nr_inss ?? ""}
            ajuda="11 dígitos, sem pontos."
            erro={campos["pessoa.nr_inss"]}
            {...digitos("pessoa.nr_inss", 11)}
          />
        </Secao>
      </div>

      <div hidden={aba !== "cnh"}>
        <MarcoValidade iso={m.cnh_validade} titulo="CNH" fim={cnhFim} />
        <Secao titulo="Números da carteira" texto="Os quatro números impressos na CNH. O registro tem 11 dígitos; o formulário, 10.">
          <Campo
            classe="f3"
            id={idDe("motorista.cnh_registro")}
            name="motorista.cnh_registro"
            label="Registro"
            className="cod"
            mascara="digitos"
            maxLength={11}
            autoComplete="off"
            defaultValue={m.cnh_registro ?? ""}
            erro={campos["motorista.cnh_registro"]}
            {...digitos("motorista.cnh_registro", 11)}
          />
          <Campo classe="f3" id={idDe("motorista.cnh_formulario")} name="motorista.cnh_formulario" label="Formulário" opcional className="cod" inputMode="numeric" maxLength={10} autoComplete="off" defaultValue={m.cnh_formulario ?? ""} />
          <Campo classe="f3" id={idDe("motorista.cnh_seguranca")} name="motorista.cnh_seguranca" label="Segurança" opcional className="cod" inputMode="numeric" maxLength={11} autoComplete="off" defaultValue={m.cnh_seguranca ?? ""} />
          <Campo classe="f3" id={idDe("motorista.cnh_renach")} name="motorista.cnh_renach" label="Renach" opcional className="cod" maxLength={11} autoComplete="off" defaultValue={m.cnh_renach ?? ""} />
        </Secao>
        <Secao titulo="Categoria e datas" texto="A validade alimenta os vencimentos do início e a pendência de documentos.">
          <Campo
            classe="f3"
            id={idDe("motorista.cnh_categoria")}
            label="Categoria"
            controle={
              <select id={idDe("motorista.cnh_categoria")} name="motorista.cnh_categoria" defaultValue={m.cnh_categoria ?? ""}>
                <Opcoes mapa={ROT.cnh_categoria} vazio="Selecione" />
              </select>
            }
          />
          <Campo classe="f3" id={idDe("motorista.cnh_validade")} name="motorista.cnh_validade" type="date" label="Validade" defaultValue={m.cnh_validade ?? ""} />
          <Campo classe="f3" id={idDe("motorista.cnh_emissao")} name="motorista.cnh_emissao" type="date" label="Emissão" defaultValue={m.cnh_emissao ?? ""} />
          <Campo classe="f3" id={idDe("motorista.cnh_primeira_habilitacao")} name="motorista.cnh_primeira_habilitacao" type="date" label="1ª habilitação" defaultValue={m.cnh_primeira_habilitacao ?? ""} />
        </Secao>
        <Secao titulo="Emissão" texto="Cidade e UF do Detran que emitiu, e observações impressas (EAR, restrições).">
          <Campo classe="f8" id={idDe("motorista.cnh_cidade_emissao")} name="motorista.cnh_cidade_emissao" label="Cidade de emissão" autoComplete="off" defaultValue={m.cnh_cidade_emissao ?? ""} />
          <Campo
            classe="f4"
            id={idDe("motorista.cnh_uf")}
            label="UF"
            controle={
              <select id={idDe("motorista.cnh_uf")} name="motorista.cnh_uf" defaultValue={m.cnh_uf ?? ""}>
                <OpcoesUf />
              </select>
            }
          />
          <Campo
            classe="f12"
            id={idDe("motorista.cnh_observacao")}
            label="Observação da CNH"
            opcional
            erro={campos["motorista.cnh_observacao"]}
            controle={<textarea id={idDe("motorista.cnh_observacao")} name="motorista.cnh_observacao" rows={3} defaultValue={m.cnh_observacao ?? ""} />}
          />
        </Secao>
      </div>

      <div hidden={aba !== "gr"}>
        <MarcoValidade iso={m.situacao_gr === "sem_consulta" ? null : m.gr_validade} titulo="Consulta de risco" fim={grFim} />
        <Secao
          titulo="Consulta na gerenciadora"
          texto="A consulta é feita no portal da gerenciadora; aqui fica o resultado e até quando vale. Sem consulta, vencida ou recusada, o motorista não pode ser contratado no Despacho nem sair de viagem."
        >
          <Campo
            classe="f6"
            id={idDe("motorista.situacao_gr")}
            label="Situação na gerenciadora"
            controle={
              <select id={idDe("motorista.situacao_gr")} name="motorista.situacao_gr" defaultValue={m.situacao_gr ?? "sem_consulta"}>
                <Opcoes mapa={ROT.situacao_gr} />
              </select>
            }
          />
          <Campo classe="f6" id={idDe("motorista.gr_validade")} name="motorista.gr_validade" type="date" label="Validade da consulta" defaultValue={m.gr_validade ?? ""} />
          <Campo
            classe="f6"
            id={idDe("motorista.gr_gerenciadora")}
            name="motorista.gr_gerenciadora"
            label="Gerenciadora"
            opcional
            placeholder="Ex.: Buonny, Opentech"
            defaultValue={m.gr_gerenciadora ?? ""}
          />
          <Campo classe="f3" id={idDe("motorista.gr_consulta_em")} name="motorista.gr_consulta_em" type="date" label="Data da consulta" opcional defaultValue={m.gr_consulta_em ?? ""} />
          <Campo classe="f3" id={idDe("motorista.gr_protocolo")} name="motorista.gr_protocolo" label="Protocolo" opcional defaultValue={m.gr_protocolo ?? ""} />
        </Secao>
        <Secao titulo="Qualificação GMP" texto="Motorista qualificado no programa de boas práticas do cliente (GMP), com a data da qualificação.">
          <OpcoesRadio nome="motorista.qualificado_gmp" mapa={{ sim: "Qualificado", nao: "Não qualificado" }} atual={m.qualificado_gmp ? "sim" : "nao"} rotulo="Qualificado GMP" />
          <Campo classe="f6" id={idDe("motorista.dt_qualificacao_gmp")} name="motorista.dt_qualificacao_gmp" type="date" label="Data da qualificação" opcional defaultValue={m.dt_qualificacao_gmp ?? ""} />
        </Secao>
      </div>
    </>
  );

  return (
    <form id="form-ficha" noValidate onInput={podeEditar ? aoAlterar : undefined} onSubmit={salvar}>
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
        <BarraSalvar pendente={pendente} salvando={salvando} onDescartar={() => descartar(document.getElementById("form-ficha") as HTMLFormElement | null)} />
      )}
    </form>
  );
}
