import Link from "next/link";
import { Calculator } from "lucide-react";
import { Sinal } from "@/components/Sinal";
import { formato } from "@/lib/formato";
import { porcento, sinalDaFaixa, situacaoDoPiso, type FreteViagem, type ResultadoCte } from "@/lib/frete";
import { CabPainel, Dash } from "../../_pessoa/partes";
import { dinheiro } from "../../financeiro/regras";
import { EditarFrete, type FreteEditavel } from "./editar-frete";

/* Frete da viagem: o piso da ANTT (todos que leem) e, para admin e financeiro, o resultado do CT-e. As
   contas são do banco (frete_da_viagem e resultado_cte_da_viagem); dinheiro sem cor, saída com "−"
   (Regra do Dinheiro sem Cor); a cor fica no sinal da situação (acima/abaixo do piso, faixa). */

type Props = {
  /** Para o "Abrir na calculadora" (/calculadora?viagem=<id>). */
  viagemId: string;
  frete: FreteViagem;
  resultado: ResultadoCte | null;
  verResultado: boolean;
  /** Valores atuais para o diálogo; nulo = não pode editar (viagem já começou ou sem permissão). */
  editavel: FreteEditavel | null;
};

function LinhaPiso({ f }: { f: FreteViagem }) {
  if (f.frotaPropria) return <Dash>frota própria não tem CIOT</Dash>;
  if (f.km === null) return <Dash>informe os km da viagem</Dash>;
  if (f.piso === null) return <Dash>sem coeficiente na tabela vigente</Dash>;
  const coluna = f.pisoEixosTabela !== null && f.pisoEixosTabela !== f.eixos ? ` (coluna de ${f.pisoEixosTabela})` : "";
  return (
    <>
      {formato.reais(f.piso)}
      <span className="linha2">
        {f.eixos} eixos{coluna}, {f.km.toLocaleString("pt-BR")} km, {f.tipoCargaRotulo.toLowerCase()}
      </span>
      {f.pisoPortaria && <span className="linha2">{f.pisoPortaria}</span>}
    </>
  );
}

export function BlocoFrete({ viagemId, frete: f, resultado: r, verResultado, editavel }: Props) {
  const s = situacaoDoPiso(f);
  return (
    <div className="frete-viagem">
      <section className="subsecao">
        <CabPainel titulo="Frete e piso ANTT">
          <Link className="btn" href={`/calculadora?viagem=${viagemId}`}>
            <Calculator size={16} strokeWidth={1.8} aria-hidden="true" />
            Abrir na calculadora
          </Link>
          {editavel && <EditarFrete {...editavel} />}
        </CabPainel>
        <dl className="kv">
          <dt>Situação</dt>
          <dd>
            <Sinal tipo={s.tipo} texto={s.texto} />
          </dd>
          <dt>Frete do motorista</dt>
          <dd>{f.freteMotorista !== null ? formato.reais(f.freteMotorista) : <Dash>não informado</Dash>}</dd>
          <dt>Piso ANTT</dt>
          <dd>
            <LinhaPiso f={f} />
          </dd>
          <dt>Km da viagem</dt>
          <dd>{f.km !== null ? `${f.km.toLocaleString("pt-BR")} km` : <Dash>não informados</Dash>}</dd>
          <dt>Pedágio</dt>
          <dd>{f.pedagio !== null ? formato.reais(f.pedagio) : <Dash>não informado</Dash>}</dd>
          <dt>Contratado</dt>
          <dd>
            {f.contratadoPf ? "Pessoa física" : "Pessoa jurídica"}
            <span className="linha2">proprietário na ANTT do cavalo</span>
          </dd>
        </dl>
      </section>

      {verResultado && <BlocoResultado f={f} r={r} />}
    </div>
  );
}

type Linha = { rotulo: string; valor: number; total?: boolean; detalhe?: string };

function BlocoResultado({ f, r }: { f: FreteViagem; r: ResultadoCte | null }) {
  if (!r) {
    return (
      <section className="subsecao">
        <CabPainel titulo="Resultado do CT-e" />
        <p className="muted">
          {f.frotaPropria ? "Frota própria: o resultado do CT-e não se aplica." : "Informe o frete do motorista para ver o resultado do CT-e."}
        </p>
      </section>
    );
  }
  const pedagio = f.pedagio ?? 0;
  const linhas: Linha[] = [
    { rotulo: "Frete da empresa", valor: f.freteEmpresa, detalhe: `${f.pesoT.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} t` },
    { rotulo: `ICMS (${porcento(r.aliquotaIcms)})`, valor: -r.icms, detalhe: `${f.ufOrigem} → ${f.ufDestino}` },
    { rotulo: "PIS e COFINS", valor: -r.impostoFederal },
    { rotulo: "Frete do motorista", valor: -(f.freteMotorista ?? 0) },
    { rotulo: "Pedágio", valor: -pedagio },
    ...(r.inssPatronal ? [{ rotulo: "INSS patronal", valor: -r.inssPatronal, detalhe: "contratado pessoa física" }] : []),
    { rotulo: "Taxa Pan Card", valor: -r.taxaPanCard },
    ...(r.seguroCarga ? [{ rotulo: "Seguro da carga", valor: -r.seguroCarga }] : []),
    ...(r.descontoDuplicata ? [{ rotulo: "Desconto de duplicata", valor: -r.descontoDuplicata }] : []),
    { rotulo: "Resultado", valor: r.resultado, total: true, detalhe: `margem ${porcento(r.margem)}` },
    { rotulo: "IRPJ e CSLL", valor: -r.irpjCsll },
    { rotulo: "Resultado líquido", valor: r.resultadoLiquido, total: true, detalhe: `margem ${porcento(r.margemLiquida)}` },
  ];
  return (
    <section className="subsecao resultado-cte">
      <CabPainel titulo="Resultado do CT-e">
        <Sinal tipo={sinalDaFaixa(r.faixa)} texto={r.faixa} />
      </CabPainel>
      <table className="demonstrativo">
        <tbody>
          {linhas.map((l) => (
            <tr key={l.rotulo} className={l.total ? "total" : undefined}>
              <th scope="row">
                {l.rotulo}
                {l.detalhe && <span className="linha2">{l.detalhe}</span>}
              </th>
              <td className="num">{dinheiro(l.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="nota">
        {r.retencoesMotorista > 0 && (
          <>
            A Prisa retém e recolhe {dinheiro(r.retencoesMotorista)} do motorista (INSS 11% e SEST/SENAT 2,5% sobre 20% do frete), fora do
            resultado.{" "}
          </>
        )}
        Faixas: abaixo de 8,5% é abaixo do mínimo; até 11%, mínimo aceitável; até 12%, esperado; até 15%, ideal. Alíquotas de partida do Lucro
        Presumido, a confirmar com o contador.
      </p>
    </section>
  );
}
