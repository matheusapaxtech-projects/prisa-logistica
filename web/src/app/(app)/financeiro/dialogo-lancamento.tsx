"use client";

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toast";
import { CATEGORIAS, LISTA_CATEGORIAS, mesDeHoje, nomeDoMes, partesDaConta, type Categoria } from "@/lib/financeiro";
import { excluirLancamentoManual, salvarLancamentoManual } from "./actions";
import type { Conta, Lancamento } from "./consultas";
import { lerLancamentoManual, MAX_DESCRICAO, MAX_OBSERVACAO, type CampoManual } from "./regras";

/** O que o diálogo está fazendo: incluir (com o mês que a tela mostra) ou editar um feito à mão. */
export type AberturaManual = { novo: true; mes: string } | { novo: false; lancamento: Lancamento };

type Props = {
  abertura: AberturaManual | null;
  contas: Conta[];
  aoFechar: () => void;
};

type Sentido = "entrada" | "saida";

const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const valorDigitado = (n: number) =>
  Math.abs(n).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/* Diálogo "Novo lançamento" / "Editar lançamento": o lançamento feito à mão, sem extrato (dinheiro,
   o que ainda não chegou no OFX, o que o banco não exporta). A categoria puxa o sentido (receita de
   frete é entrada, despesa é saída); "Transferência" deixa escolher. Ao gravar, a tela vai até o mês
   do lançamento. */
export function DialogoLancamento({ abertura, contas, aoFechar }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const fecharAtual = useRef(aoFechar);
  useEffect(() => {
    fecharAtual.current = aoFechar;
  });

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (abertura && !dlg.open) {
      dlg.showModal();
      dlg.querySelector<HTMLElement>("select,input")?.focus();
    }
    if (!abertura && dlg.open) dlg.close();
  }, [abertura]);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    const aoClose = () => fecharAtual.current();
    dlg.addEventListener("close", aoClose);
    return () => dlg.removeEventListener("close", aoClose);
  }, []);

  return (
    <dialog ref={ref} className="dialogo dlg-lancamento" aria-labelledby={idTitulo}>
      {abertura && (
        <Formulario
          key={abertura.novo ? `novo-${abertura.mes}` : abertura.lancamento.id}
          abertura={abertura}
          contas={contas}
          idTitulo={idTitulo}
          fechar={() => ref.current?.close()}
        />
      )}
    </dialog>
  );
}

function Formulario({
  abertura,
  contas,
  idTitulo,
  fechar,
}: {
  abertura: AberturaManual;
  contas: Conta[];
  idTitulo: string;
  fechar: () => void;
}) {
  const router = useRouter();
  const l = abertura.novo ? null : abertura.lancamento;
  const dataInicial = l?.data ?? (abertura.novo && abertura.mes !== mesDeHoje() ? `${abertura.mes}-01` : hoje());
  const [sentido, setSentido] = useState<Sentido | "">(l ? (l.valor < 0 ? "saida" : "entrada") : "");
  const [categoria, setCategoria] = useState<Categoria | "">(l?.categoria ?? "");
  const [erros, setErros] = useState<Partial<Record<CampoManual, string>>>({});
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [gravando, iniciar] = useTransition();
  const id = useId();

  const limpar = (c: CampoManual) => erros[c] && setErros((e) => ({ ...e, [c]: undefined }));
  const fixo = categoria ? CATEGORIAS[categoria].sentido : "ambos";

  function aoMudarCategoria(c: Categoria | "") {
    setCategoria(c);
    limpar("categoria");
    if (c && CATEGORIAS[c].sentido !== "ambos") {
      setSentido(CATEGORIAS[c].sentido as Sentido);
      limpar("sentido");
    }
  }

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const dados = new FormData(form);
    const lido = lerLancamentoManual(dados, hoje());
    setErroAcao(null);
    if (!lido.ok) {
      setErros(lido.erros);
      const primeiro = Object.keys(lido.erros)[0];
      form.querySelector<HTMLElement>(`[name="${primeiro}"]`)?.focus();
      return;
    }
    iniciar(async () => {
      const r = await salvarLancamentoManual(l?.id ?? "", dados);
      if (!r.ok) {
        setErroAcao(r.erro);
        return;
      }
      const mesAtual = abertura.novo ? abertura.mes : l!.data.slice(0, 7);
      toast(l ? "Lançamento alterado." : `Lançado em ${nomeDoMes(r.dados)}.`);
      fechar();
      if (r.dados !== mesAtual)
        router.push(`/financeiro?aba=lancamentos&mes=${r.dados}`, {
          scroll: false,
        });
    });
  }

  function excluir() {
    if (!l) return;
    if (!confirmarExclusao) {
      setConfirmarExclusao(true);
      return;
    }
    iniciar(async () => {
      const r = await excluirLancamentoManual(l.id);
      if (!r.ok) {
        setErroAcao(r.erro);
        setConfirmarExclusao(false);
        return;
      }
      toast("Lançamento excluído.");
      fechar();
    });
  }

  const erro = (c: CampoManual) =>
    erros[c] ? (
      <span className="erro" id={`${id}-${c}-erro`} role="alert">
        {erros[c]}
      </span>
    ) : null;
  const invalido = (c: CampoManual) => (erros[c] ? { "data-invalido": "" } : {});
  const descrito = (c: CampoManual) => (erros[c] ? `${id}-${c}-erro` : undefined);

  return (
    <form noValidate onSubmit={aoEnviar}>
      <div className="dialogo-cab">
        <h2 id={idTitulo}>{l ? "Editar lançamento" : "Novo lançamento"}</h2>
      </div>
      <div className="dialogo-corpo">
        <div className="campos">
          <div className="campo f6" {...invalido("categoria")}>
            <label htmlFor={`${id}-categoria`}>Categoria</label>
            <select
              id={`${id}-categoria`}
              name="categoria"
              value={categoria}
              aria-invalid={!!erros.categoria || undefined}
              aria-describedby={descrito("categoria")}
              onChange={(e) => aoMudarCategoria(e.currentTarget.value as Categoria | "")}
            >
              <option value="">Escolha</option>
              {LISTA_CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIAS[c].rotulo}
                </option>
              ))}
            </select>
            {erro("categoria")}
          </div>

          <fieldset className="campo f6" {...invalido("sentido")} aria-describedby={descrito("sentido")}>
            <legend className="rotulo">O dinheiro</legend>
            <div className="opcoes">
              {(["entrada", "saida"] as const).map((s) => (
                <label className="opcao" key={s}>
                  <input
                    type="radio"
                    name="sentido"
                    value={s}
                    checked={sentido === s}
                    disabled={fixo !== "ambos" && fixo !== s}
                    onChange={() => {
                      setSentido(s);
                      limpar("sentido");
                    }}
                  />
                  <span>{s === "entrada" ? "Entrou" : "Saiu"}</span>
                </label>
              ))}
            </div>
            {erro("sentido")}
          </fieldset>

          <div className="campo f6" {...invalido("valor")}>
            <label htmlFor={`${id}-valor`}>Valor (R$)</label>
            <input
              id={`${id}-valor`}
              name="valor"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              defaultValue={l ? valorDigitado(l.valor) : ""}
              aria-invalid={!!erros.valor || undefined}
              aria-describedby={descrito("valor")}
              onChange={() => limpar("valor")}
            />
            {erro("valor")}
          </div>

          <div className="campo f6" {...invalido("data")}>
            <label htmlFor={`${id}-data`}>Data</label>
            <input
              id={`${id}-data`}
              name="data"
              type="date"
              defaultValue={dataInicial}
              aria-invalid={!!erros.data || undefined}
              aria-describedby={descrito("data")}
              onChange={() => limpar("data")}
            />
            {erro("data")}
          </div>

          <div className="campo f12" {...invalido("descricao")}>
            <label htmlFor={`${id}-descricao`}>Descrição</label>
            <input
              id={`${id}-descricao`}
              name="descricao"
              type="text"
              autoComplete="off"
              maxLength={MAX_DESCRICAO}
              placeholder="Ex.: Frete pago em dinheiro ao motorista João"
              defaultValue={l?.descricao ?? ""}
              aria-invalid={!!erros.descricao || undefined}
              aria-describedby={descrito("descricao")}
              onChange={() => limpar("descricao")}
            />
            {erro("descricao")}
          </div>

          <div className="campo f12" {...invalido("conta")}>
            <label htmlFor={`${id}-conta`}>Conta</label>
            <select id={`${id}-conta`} name="conta" defaultValue={l?.conta?.id ?? ""} aria-describedby={`${id}-conta-ajuda`}>
              <option value="">Sem conta (dinheiro ou outra)</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {partesDaConta(c).join(" · ")}
                </option>
              ))}
            </select>
            <span className="ajuda" id={`${id}-conta-ajuda`}>
              {contas.length
                ? "Se depois o extrato dessa conta trouxer o mesmo valor no mesmo dia, o NILT avisa na importação."
                : "As contas aparecem aqui depois do primeiro extrato importado de cada uma."}
            </span>
            {erro("conta")}
          </div>

          <div className="campo f12" {...invalido("observacao")}>
            <label htmlFor={`${id}-observacao`}>
              Observação <span className="opcional">(opcional)</span>
            </label>
            <textarea
              id={`${id}-observacao`}
              name="observacao"
              rows={2}
              maxLength={MAX_OBSERVACAO}
              defaultValue={l?.observacao ?? ""}
              aria-describedby={descrito("observacao")}
            />
            {erro("observacao")}
          </div>
        </div>

        {erroAcao && (
          <div className="aviso aviso-bloqueado" role="alert">
            <p>{erroAcao}</p>
          </div>
        )}
      </div>

      <div className="dialogo-pe">
        {l && (
          <button className="btn btn-perigo" type="button" onClick={excluir} disabled={gravando} aria-live="polite">
            {confirmarExclusao ? "Confirmar exclusão" : "Excluir"}
          </button>
        )}
        <span className="espaco" />
        <button className="btn" type="button" onClick={fechar}>
          Cancelar
        </button>
        <button className="btn btn-primario" type="submit" disabled={gravando} aria-busy={gravando}>
          {l ? "Salvar" : "Lançar"}
        </button>
      </div>
    </form>
  );
}
