"use client";

import { Fragment, startTransition, useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, Info, Undo2, Upload } from "lucide-react";
import { Dialogo } from "@/components/Dialogo";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Ponto } from "@/components/Ponto";
import { toast } from "@/components/Toast";
import { formato } from "@/lib/formato";
import { nomeDoMes, partesDaConta } from "@/lib/financeiro";
import { desfazerImportacao, importarExtrato } from "../actions";
import type { Importacao } from "../consultas";
import { SEM_CATEGORIA, TAMANHO_MAXIMO } from "../regras";

const plural = (n: number, a: string, b: string) => (n === 1 ? a : b);

function Conta({ c }: { c: { banco: string; agencia: string; numero: string; apelido?: string | null } }) {
  return (
    <>
      {partesDaConta(c).map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <Ponto />}
          {p}
        </Fragment>
      ))}
    </>
  );
}

/** Envio do OFX. O arquivo vai pela Server Action (o servidor lê e grava); o resultado diz quantos
   lançamentos eram novos e leva ao mês importado. */
export function FormularioImportar() {
  const [estado, enviar, enviando] = useActionState(importarExtrato, null);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (estado?.ok && campo.current) campo.current.value = "";
  }, [estado]);

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const arquivo = campo.current?.files?.[0];
    if (!arquivo) {
      setErroLocal("Escolha o arquivo OFX do extrato.");
      campo.current?.focus();
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      setErroLocal("O arquivo passa de 4 MB. Exporte um período menor (um mês por vez) e importe de novo.");
      return;
    }
    setErroLocal(null);
    const dados = new FormData(e.currentTarget);
    startTransition(() => enviar(dados));
  }

  const erro = erroLocal ?? (estado && !estado.ok ? estado.erro : null);
  const r = estado?.ok ? estado.dados : null;
  const semCategoria = r ? r.novos - r.classificados : 0;

  return (
    <form className="form-importar" onSubmit={aoEnviar} noValidate>
      {erro && (
        <div className="aviso aviso-bloqueado" role="alert">
          <CircleAlert size={18} strokeWidth={1.6} aria-hidden="true" />
          <span>{erro}</span>
        </div>
      )}
      {r && !erro && (
        <div className={`aviso ${r.novos ? "aviso-normal" : "aviso-info"}`} role="status">
          {r.novos ? <CircleCheck size={18} strokeWidth={1.6} aria-hidden="true" /> : <Info size={18} strokeWidth={1.6} aria-hidden="true" />}
          <span className="txt">
            <b>
              <Conta c={r} />
            </b>
            <br />
            {r.novos
              ? `${r.novos} ${plural(r.novos, "lançamento novo", "lançamentos novos")}` +
                (r.repetidos ? `, ${r.repetidos} já ${plural(r.repetidos, "estava", "estavam")} no NILT` : "") +
                (r.classificados ? `; ${r.classificados} ${plural(r.classificados, "classificado", "classificados")} pelas regras.` : ".")
              : `Nada novo: ${plural(r.total, "o lançamento", `os ${r.total} lançamentos`)} deste arquivo já ${plural(r.total, "estava", "estavam")} no NILT.`}
            <span className="acoes-aviso">
              {semCategoria > 0 && (
                <Link className="btn btn-pequeno" href={`/financeiro?aba=lancamentos&mes=${r.primeiroMes}&ver=${SEM_CATEGORIA}`}>
                  Classificar {semCategoria} sem categoria
                </Link>
              )}
              <Link className="btn btn-texto btn-pequeno" href={`/financeiro?mes=${r.ultimoMes}`}>
                Ver o resultado de {nomeDoMes(r.ultimoMes)}
              </Link>
            </span>
          </span>
        </div>
      )}
      {r && !erro && r.suspeitos > 0 && (
        <div className="aviso aviso-pendente" role="status">
          <CircleAlert size={18} strokeWidth={1.6} aria-hidden="true" />
          <span className="txt">
            {r.suspeitos} {plural(r.suspeitos, "lançamento novo parece repetido", "lançamentos novos parecem repetidos")}: mesma data, valor e
            histórico de um que já estava no NILT, mas com outra identificação do banco. Confira em Lançamentos; se for o mesmo arquivo exportado
            de novo, desfaça esta importação.
          </span>
        </div>
      )}
      <div className="campo">
        <label htmlFor="arquivo-ofx">Arquivo do extrato (OFX)</label>
        <input
          ref={campo}
          id="arquivo-ofx"
          name="arquivo"
          type="file"
          accept=".ofx,.OFX,application/x-ofx"
          aria-invalid={erro ? true : undefined}
          aria-describedby="ajuda-ofx"
          onChange={() => setErroLocal(null)}
        />
        <span className="ajuda" id="ajuda-ofx">
          Extrato da conta corrente ou do cartão, em OFX, de até 4 MB.
        </span>
      </div>
      <div>
        <button className="btn btn-primario" type="submit" disabled={enviando}>
          <Upload size={16} strokeWidth={1.6} aria-hidden="true" />
          {enviando ? "Importando…" : "Importar extrato"}
        </button>
      </div>
    </form>
  );
}

/** Extratos já importados, do mais novo ao mais antigo, com "Desfazer" (apaga o que o arquivo trouxe). */
export function HistoricoImportacoes({ importacoes }: { importacoes: Importacao[] }) {
  const [desfazendo, setDesfazendo] = useState<Importacao | null>(null);
  const [gravando, iniciar] = useTransition();

  if (importacoes.length === 0) return <EstadoVazio>Nenhum extrato importado ainda.</EstadoVazio>;

  return (
    <>
      <div className="tabela-wrap">
        <table className="tabela tabela-prop tabela-importacoes">
          <thead>
            <tr>
              <th scope="col">Arquivo e conta</th>
              <th scope="col" className="some-celular">
                Período
              </th>
              <th scope="col" className="num">
                Lançamentos
              </th>
              <th scope="col" className="num some-tablet">
                Importado em
              </th>
              <th scope="col" className="col-acao">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {importacoes.map((i) => (
              <tr key={i.id} className="sem-link">
                <td>
                  <span className="desc">{i.nomeArquivo}</span>
                  <span className="linha2">{i.conta ? <Conta c={i.conta} /> : "—"}</span>
                </td>
                <td className="some-celular data">
                  {i.inicio && i.fim ? `${formato.data(i.inicio)} a ${formato.data(i.fim)}` : <span className="dash">—</span>}
                </td>
                <td className="num">
                  <b>{i.total}</b>
                  <span className="linha2">{i.novos === i.total ? "todos novos" : `${i.novos} ${plural(i.novos, "novo", "novos")}`}</span>
                </td>
                <td className="num data some-tablet">
                  {formato.dataHora(i.criadaEm)}
                  <span className="linha2">{i.quem ?? "—"}</span>
                </td>
                <td className="col-acao">
                  {/* Só a mais recente de cada conta (as anteriores podem ter lançamentos que as novas também trouxeram). */}
                  {i.ultimaDaConta && (
                    <button className="btn btn-texto btn-pequeno" type="button" onClick={() => setDesfazendo(i)} aria-label={`Desfazer a importação de ${i.nomeArquivo}`}>
                      <Undo2 size={16} strokeWidth={1.6} aria-hidden="true" />
                      <span className="some-celular">Desfazer</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialogo
        aberto={!!desfazendo}
        aoFechar={() => setDesfazendo(null)}
        titulo="Desfazer esta importação?"
        onSubmit={(e) => {
          e.preventDefault();
          const i = desfazendo;
          if (!i) return;
          iniciar(async () => {
            const r = await desfazerImportacao(i.id);
            if (!r.ok) {
              toast(r.erro, "circle-alert");
              return;
            }
            setDesfazendo(null);
            toast(`Importação desfeita: ${r.dados} ${plural(r.dados, "lançamento apagado", "lançamentos apagados")}.`, "trash-2");
          });
        }}
        pe={
          <>
            <button className="btn" type="button" data-fechar>
              Cancelar
            </button>
            <button className="btn btn-perigo" type="submit" disabled={gravando}>
              {gravando ? "Desfazendo…" : "Desfazer importação"}
            </button>
          </>
        }
      >
        {desfazendo && (
          <p>
            Os {desfazendo.novos} {plural(desfazendo.novos, "lançamento", "lançamentos")} que <b>{desfazendo.nomeArquivo}</b> trouxe saem do NILT, com
            as categorias que você escolheu. As regras continuam. Para trazer de volta, importe o arquivo de novo. Só a importação mais recente
            de cada conta pode ser desfeita.
          </p>
        )}
      </Dialogo>
    </>
  );
}
