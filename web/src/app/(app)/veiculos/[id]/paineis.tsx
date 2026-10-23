"use client";

import { FileText, FileX } from "lucide-react";
import { MarcoKm } from "@/components/MarcoKm";
import { Ponto } from "@/components/Ponto";
import { diasAte } from "@/lib/datas";
import { formato } from "@/lib/formato";
import {
  CATEGORIAS,
  RASTREAMENTO,
  SITUACAO_CADASTRO,
  SITUACAO_OPERACIONAL,
  UFS,
  dinheiro,
  milhar,
  nomeTipoLista,
  type TipoVeiculo,
} from "../rotulos";
import { CampoLongo, CampoNumero, CampoSelect, CampoTexto, Radios, Secao, type Erros } from "./campos-ficha";
import type { VeiculoFicha } from "./tipos";

type Comuns = { v: VeiculoFicha; erros: Erros };

/* ---------- aba CRLV ---------- */
export function PainelCrlv({
  v,
  erros,
  tipos,
  marcas,
  tipo,
  crlv,
}: Comuns & {
  tipos: TipoVeiculo[];
  marcas: { id: number; nome: string }[];
  tipo: TipoVeiculo;
  crlv: { nome: string; validade: string | null } | null;
}) {
  const grupos = (Object.keys(CATEGORIAS) as (keyof typeof CATEGORIAS)[])
    .map((cat) => ({
      grupo: CATEGORIAS[cat],
      itens: tipos.filter((t) => t.categoria === cat).map((t): [number, string] => [t.id, nomeTipoLista(t.nome)]),
    }))
    .filter((g) => g.itens.length);
  const dias = crlv?.validade ? diasAte(crlv.validade) : null;
  return (
    <>
      <Secao
        id="s-crlv"
        titulo="Veículo no CRLV"
        texto={
          <>
            <p>Na ordem do CRLV digital: primeiro o Renavam e a placa, depois o veículo e o local.</p>
            {crlv ? (
              <p className="small nota-arq">
                <FileText size={14} strokeWidth={1.6} aria-hidden="true" />
                <span>
                  Anexado: {crlv.nome}
                  {crlv.validade ? `, ${dias! < 0 ? "vencido em " : "vale até "}${formato.data(crlv.validade)}` : ""}
                </span>
              </p>
            ) : (
              <p className="small nota-arq falta-arq">
                <FileX size={14} strokeWidth={1.6} aria-hidden="true" />
                <span>CRLV ainda não anexado. Anexe na aba Documentos.</span>
              </p>
            )}
          </>
        }
      >
        <CampoTexto nome="renavam" classe="f4" rotulo="Renavam" valor={v.renavam} erros={erros} entrada="cod" inputMode="numeric" maxLength={11} />
        <CampoTexto nome="placa" classe="f3" rotulo="Placa" valor={v.placa} erros={erros} entrada="cod" mascara="placa" valida="placa" maxLength={8} />
        <CampoTexto nome="exercicio_doc" classe="f2" rotulo="Exercício" valor={v.exercicio_doc} erros={erros} entrada="num" inputMode="numeric" maxLength={4} />
        <CampoTexto nome="dt_emissao_crlv" classe="f3" rotulo="Emissão do CRLV" valor={v.dt_emissao_crlv} erros={erros} tipo="date" opcional />
        <CampoTexto nome="ano_fabricacao" classe="f3" rotulo="Ano de fabricação" valor={v.ano_fabricacao} erros={erros} entrada="num" inputMode="numeric" maxLength={4} />
        <CampoTexto nome="ano_modelo" classe="f3" rotulo="Ano do modelo" valor={v.ano_modelo} erros={erros} entrada="num" inputMode="numeric" maxLength={4} />
        <CampoTexto nome="nr_certificado_doc" classe="f6" rotulo="Nº do certificado (CRV)" valor={v.nr_certificado_doc} erros={erros} entrada="cod" maxLength={20} opcional />
        <CampoTexto nome="nr_seguranca_crlv" classe="f6" rotulo="Nº de segurança / CLA" valor={v.nr_seguranca_crlv} erros={erros} entrada="cod" opcional />
        <CampoTexto nome="nr_registro_crlv" classe="f6" rotulo="Nº de registro do CRLV" valor={v.nr_registro_crlv} erros={erros} entrada="cod" opcional />
        <CampoSelect
          nome="marca_id"
          classe="f4"
          rotulo="Marca"
          opcoes={marcas.map((m): [number, string] => [m.id, m.nome])}
          valor={v.marca_id}
          erros={erros}
          vazio="Escolha a marca"
        />
        <CampoTexto nome="modelo" classe="f8" rotulo="Modelo" valor={v.modelo} erros={erros} />
        <CampoSelect
          nome="tipo_veiculo_id"
          classe="f8"
          rotulo="Tipo (espécie e carroceria)"
          opcoes={grupos}
          valor={v.tipo_veiculo_id}
          erros={erros}
          ajuda={
            <>
              Categoria {CATEGORIAS[tipo.categoria].toLowerCase()}
              <Ponto />
              {tipo.eixos} eixos
              {tipo.categoria === "cavalo" && (
                <>
                  <Ponto />
                  {tipo.configuracao_cavalo === "trucado" ? "trucado" : "toco"}
                </>
              )}
              . Trocar a categoria muda as abas depois de salvar.
            </>
          }
        />
        <CampoTexto nome="cor" classe="f4" rotulo="Cor" valor={v.cor} erros={erros} opcional />
        <CampoTexto nome="chassi" classe="f8" rotulo="Chassi" valor={v.chassi} erros={erros} entrada="cod" maxLength={25} />
        <CampoSelect nome="uf_emplacamento" classe="f4" rotulo="UF" opcoes={UFS.map((u): [string, string] => [u, u])} valor={v.uf_emplacamento} erros={erros} />
        <CampoTexto nome="cidade_emplacamento" classe="f8" rotulo="Cidade de emplacamento" valor={v.cidade_emplacamento} erros={erros} />
      </Secao>
      <Secao id="s-cad" titulo="Cadastro" texto={<p>Fica pendente até a equipe conferir o CRLV anexado. Cancelado não entra em conjunto.</p>}>
        <Radios nome="situacao_cadastro" rotulo="Situação do cadastro" opcoes={SITUACAO_CADASTRO} valor={v.situacao_cadastro} erros={erros} />
        <CampoLongo nome="observacao" rotulo="Observação" valor={v.observacao} erros={erros} opcional />
      </Secao>
    </>
  );
}

/* ---------- aba TAG e seguro ---------- */
function MarcoSeguro({ validade }: { validade: string }) {
  if (!validade) return <div className="marco-unico"><span className="muted">Sem validade informada.</span></div>;
  const dias = diasAte(validade);
  return (
    <div className="marco-unico">
      <MarcoKm dias={dias} janela={365} />
      <span className={`dias${dias < 0 ? " vencido" : ""}`}>
        <b>{dias < 0 ? "Vencido" : dias + (dias === 1 ? " dia" : " dias")}</b>{" "}
        {dias < 0 ? (
          formato.dias(dias)
        ) : (
          <>
            restantes
            <Ponto />
            {formato.data(validade)}
          </>
        )}
      </span>
    </div>
  );
}

export function PainelTag({ v, erros, operadoras, seguroValidade }: Comuns & { operadoras: { id: number; nome: string }[]; seguroValidade: string }) {
  return (
    <>
      <Secao id="s-tag" titulo="TAG de pedágio" texto={<p>A TAG vem pela PAMCARD; a operadora define em que praças passa sem parar.</p>}>
        <CampoTexto nome="tag_numero" classe="f6" rotulo="Número da TAG" valor={v.tag_numero} erros={erros} entrada="cod" opcional />
        <CampoSelect
          nome="tag_operadora_id"
          classe="f6"
          rotulo="Operadora"
          opcoes={operadoras.map((o): [number, string] => [o.id, o.nome])}
          valor={v.tag_operadora_id}
          erros={erros}
          vazio="Sem TAG"
        />
      </Secao>
      <Secao
        id="s-seg"
        titulo="Seguro"
        texto={<p>Seguro do veículo. A validade entra nos vencimentos do início quando faltam 90 dias ou menos.</p>}
      >
        <CampoTexto nome="seguradora" classe="f6" rotulo="Seguradora" valor={v.seguradora} erros={erros} opcional />
        <CampoTexto nome="apolice" classe="f6" rotulo="Apólice" valor={v.apolice} erros={erros} entrada="cod" opcional />
        <CampoTexto nome="seguro_validade" classe="f4" rotulo="Validade" valor={v.seguro_validade} erros={erros} tipo="date" opcional />
        <div className="f8 marco-campo" id="marco-seguro">
          <MarcoSeguro validade={seguroValidade} />
        </div>
      </Secao>
    </>
  );
}

/* ---------- aba Rastreamento ---------- */
export function PainelRastreamento({ v, erros }: Comuns) {
  return (
    <>
      <Secao id="s-ras" titulo="Rastreador" texto={<p>Equipamento instalado no veículo, para a gerenciadora de risco localizar.</p>}>
        <CampoTexto nome="rastreador_empresa" classe="f6" rotulo="Empresa" valor={v.rastreador_empresa} erros={erros} opcional />
        <CampoTexto nome="rastreador_modelo" classe="f6" rotulo="Modelo" valor={v.rastreador_modelo} erros={erros} opcional />
        <CampoTexto nome="rastreador_numero" classe="f6" rotulo="Número do rastreador" valor={v.rastreador_numero} erros={erros} entrada="cod" opcional />
        <div className="f6" />
        <Radios
          nome="rastreamento_tipo"
          rotulo="Tipo de rastreamento"
          opcoes={[["", "Sem rastreamento"], ...RASTREAMENTO]}
          valor={v.rastreamento_tipo ?? ""}
          erros={erros}
        />
        <CampoLongo nome="rastreador_observacao" rotulo="Observação da rastreadora" valor={v.rastreador_observacao} erros={erros} opcional />
      </Secao>
      <Secao
        id="s-pgr"
        titulo="PGR"
        texto={
          <p>
            Plano de gerenciamento de risco. Com a SM automática, a solicitação de monitoramento abre sozinha na Trafegus quando a viagem
            começar (fase de operação).
          </p>
        }
      >
        <Radios
          nome="pgr_sm_automatica"
          rotulo="PGR: solicitação de monitoramento"
          opcoes={[
            ["true", "SM automática na Trafegus"],
            ["false", "SM aberta à mão"],
          ]}
          valor={v.pgr_sm_automatica == null ? "" : String(v.pgr_sm_automatica)}
          erros={erros}
        />
      </Secao>
    </>
  );
}

/* ---------- aba Frota (dados de veículo próprio) ---------- */
export function PainelFrota({ v, erros, unidades }: Comuns & { unidades: { id: number; nome: string }[] }) {
  return (
    <>
      <Secao id="s-fro" titulo="Na frota" texto={<p>Número interno e unidade que responde pelo veículo.</p>}>
        <CampoTexto nome="nr_frota" classe="f3" rotulo="Nº da frota" valor={v.nr_frota} erros={erros} entrada="cod" opcional />
        <CampoSelect
          nome="unidade_operacional_id"
          classe="f5"
          rotulo="Unidade operacional"
          opcoes={unidades.map((u): [number, string] => [u.id, u.nome])}
          valor={v.unidade_operacional_id}
          erros={erros}
          vazio="Escolha a unidade"
        />
        <CampoSelect
          nome="centro_custo_id"
          classe="f4"
          rotulo="Centro de custo"
          opcoes={[]}
          valor={null}
          erros={erros}
          vazio="Definido na fase 2"
          desabilitado
          ajuda="A lista de centros de custo chega com o financeiro."
        />
      </Secao>
      <Secao
        id="s-op"
        titulo="Situação operacional"
        texto={<p>O que o veículo está fazendo hoje. Arrendado vem marcado quando posse e ANTT são diferentes.</p>}
      >
        <Radios nome="situacao_operacional" rotulo="Situação operacional" opcoes={SITUACAO_OPERACIONAL} valor={v.situacao_operacional} erros={erros} />
      </Secao>
      <Secao id="s-mot" titulo="Motor e consumo" texto={<p>Do manual e da ficha de compra. As médias servem para estimar o diesel da viagem.</p>}>
        <CampoTexto nome="potencia_motor" classe="f3" rotulo="Potência" valor={v.potencia_motor} erros={erros} opcional />
        <CampoTexto nome="hp" classe="f3" rotulo="HP" valor={v.hp} erros={erros} entrada="num" inputMode="numeric" opcional />
        <CampoTexto nome="nr_motor" classe="f6" rotulo="Nº do motor" valor={v.nr_motor} erros={erros} entrada="cod" opcional />
        <CampoNumero nome="litros_tanque" classe="f3" rotulo="Tanque (litros)" valor={v.litros_tanque} casas={0} erros={erros} opcional />
        <CampoNumero nome="media_padrao_carregado" classe="f3" rotulo="Média carregado (km/l)" valor={v.media_padrao_carregado} casas={2} erros={erros} opcional />
        <CampoNumero nome="media_padrao_vazio" classe="f3" rotulo="Média vazio (km/l)" valor={v.media_padrao_vazio} casas={2} erros={erros} opcional />
        <CampoTexto nome="km_inicial" classe="f3" rotulo="Km inicial" valor={milhar(v.km_inicial)} erros={erros} entrada="num" inputMode="numeric" opcional />
      </Secao>
      <Secao id="s-cmp" titulo="Compra e IPVA" texto={<p>Valores em reais. O IPVA entra nos vencimentos do início.</p>}>
        <CampoTexto nome="aquisicao" classe="f3" rotulo="Aquisição" valor={v.aquisicao} erros={erros} tipo="date" opcional />
        <CampoTexto nome="vl_compra" classe="f3" rotulo="Valor de compra (R$)" valor={dinheiro(v.vl_compra)} erros={erros} entrada="num" inputMode="decimal" opcional />
        <CampoTexto nome="vl_mercado" classe="f3" rotulo="Valor de mercado (R$)" valor={dinheiro(v.vl_mercado)} erros={erros} entrada="num" inputMode="decimal" opcional />
        <CampoTexto
          nome="venc_ipva"
          classe="f3"
          rotulo="Vencimento do IPVA"
          valor={v.venc_ipva}
          erros={erros}
          tipo="date"
          opcional
          ajuda={v.venc_ipva ? formato.dias(diasAte(v.venc_ipva)) : undefined}
        />
      </Secao>
    </>
  );
}
