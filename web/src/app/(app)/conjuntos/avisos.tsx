/* Avisos e conta da capacidade do conjunto (`avisosMotorista` e `blocoCapacidade` de prototipo/conjunto.html).
   Sem hooks: servem à ficha (servidor) e ao montador (cliente). */
import type { ReactNode } from "react";
import Link from "next/link";
import { CircleAlert, CircleX, Info, Search, TriangleAlert, type LucideIcon } from "lucide-react";
import { Capacidade } from "@/components/Capacidade";
import { capacidade, type Veiculo } from "@/lib/conjunto";
import { diasAte } from "@/lib/datas";
import { formato } from "@/lib/formato";

type TipoAviso = "bloqueado" | "vencendo" | "pendente" | "info";

export function Aviso({ tipo, icone: Icone, children }: { tipo: TipoAviso; icone: LucideIcon; children: ReactNode }) {
  return (
    <div className={`aviso aviso-${tipo}`}>
      <Icone size={18} strokeWidth={1.6} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export type MotoristaAvisos = {
  pessoa_id: string;
  nome: string;
  cnh_validade: string | null;
  situacao_gr: string;
  gr_validade: string | null;
};

/** O outro conjunto aberto que o motorista já dirige (para o aviso azul). */
export type OutroConjunto = { id: string; nome: string };

/** Avisos do motorista (não impedem salvar): CNH e consulta de risco vencidas ou vencendo, e outro conjunto. */
export function avisosMotorista(m: MotoristaAvisos, outro: OutroConjunto | null): ReactNode[] {
  const out: ReactNode[] = [];
  const docs = <Link href={`/motoristas/${m.pessoa_id}?aba=documentos`}>Abrir documentos</Link>;
  if (m.cnh_validade) {
    const cnh = diasAte(m.cnh_validade);
    if (cnh < 0)
      out.push(
        <Aviso key="cnh" tipo="bloqueado" icone={CircleX}>
          <b>CNH vencida:</b> {formato.dias(cnh)} ({formato.data(m.cnh_validade)}). Anexe a CNH renovada antes da primeira carga. {docs}
        </Aviso>,
      );
    else if (cnh <= 30)
      out.push(
        <Aviso key="cnh" tipo="vencendo" icone={TriangleAlert}>
          <b>CNH {formato.dias(cnh)}</b> ({formato.data(m.cnh_validade)}). {docs}
        </Aviso>,
      );
  }
  if (m.situacao_gr === "sem_consulta" || !m.gr_validade) {
    out.push(
      <Aviso key="gr" tipo="pendente" icone={Search}>
        <b>Sem consulta de risco.</b> Peça a consulta à gerenciadora antes de carregar.
      </Aviso>,
    );
  } else {
    const g = diasAte(m.gr_validade);
    if (g < 0 || m.situacao_gr === "vencido")
      out.push(
        <Aviso key="gr" tipo="bloqueado" icone={CircleX}>
          <b>Consulta de risco vencida:</b> {formato.dias(g)} ({formato.data(m.gr_validade)}). Refaça a consulta antes de carregar.
        </Aviso>,
      );
    else if (g <= 30)
      out.push(
        <Aviso key="gr" tipo="vencendo" icone={TriangleAlert}>
          <b>Consulta de risco {formato.dias(g)}</b> ({formato.data(m.gr_validade)}).
        </Aviso>,
      );
  }
  if (outro)
    out.push(
      <Aviso key="outro" tipo="info" icone={Info}>
        {m.nome} já dirige o conjunto <Link href={`/conjuntos/${outro.id}`}>{outro.nome}</Link>. Troque o motorista de lá depois de salvar.
      </Aviso>,
    );
  return out;
}

/** Conta da capacidade (mesmos campos de `v_conjunto_capacidade`), a barra e o alerta. */
export function ContaCapacidade({ cavalo, itens }: { cavalo: Veiculo; itens: Veiculo[] }) {
  const cap = capacidade(cavalo, itens);
  let alerta: ReactNode = null;
  if (cap.limite_t == null)
    alerta = (
      <Aviso tipo="pendente" icone={TriangleAlert}>
        <b>CMT do cavalo não informado.</b> Sem o CMT não dá para conferir o peso.{" "}
        <Link href={`/veiculos/${cavalo.id}?aba=crlv`}>Completar o CRLV de {cavalo.placa}</Link>
      </Aviso>
    );
  else if (cap.excede_cmt) {
    const passa = +(cap.capacidade_total_t - cap.limite_t).toFixed(1);
    alerta = (
      <Aviso tipo="bloqueado" icone={CircleAlert}>
        <b>Passa {formato.t(passa)} do CMT.</b> As carretas levam {formato.t(cap.capacidade_total_t)}, mas com estas taras o cavalo{" "}
        {cavalo.placa} só traciona {formato.t(cap.limite_t)} de carga. Não carregue acima de {formato.t(cap.limite_t)}.
      </Aviso>
    );
  } else if (itens.length)
    alerta = <p className="conta-formula">Sobram {formato.t(+(cap.limite_t - cap.capacidade_total_t).toFixed(1))} até o limite.</p>;

  return (
    <>
      <dl className="conta">
        <dt>CMT do cavalo {cavalo.placa}</dt>
        <dd>{formato.t(cap.cmt_t)}</dd>
        <dt>Tara do cavalo e das peças</dt>
        <dd>− {formato.t(cap.tara_total_t)}</dd>
        <dt className="soma">Limite de carga</dt>
        <dd className="soma">{formato.t(cap.limite_t)}</dd>
        <dt>Capacidade das carretas</dt>
        <dd>{formato.t(cap.capacidade_total_t)}</dd>
      </dl>
      <div className="capacidade-larga" style={{ marginTop: 16 }}>
        <Capacidade c={cap} />
      </div>
      {alerta && <div className="avisos">{alerta}</div>}
    </>
  );
}
