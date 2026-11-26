"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { Dialogo } from "@/components/Dialogo";
import { toast } from "@/components/Toast";
import { FORMAS } from "@/lib/contas";
import { hojeISO } from "@/lib/datas";
import { CampoDialogo } from "../contas-comum/campo-dialogo";
import { MAX_OBSERVACAO } from "../contas-comum/leitura";
import { editarConta, lancarConta } from "./actions";
import type { CentroCusto, ContaPagar, TipoDespesa } from "./consultas";
import { GRUPOS_PLANO, lerAjusteGerada, lerConta, MAX_DESCRICAO, MAX_FAVORECIDO, ROTULO_GRUPO_PLANO, type CampoConta } from "./regras";

const CENTRO_PADRAO = "01.01";

/** "1.234,56" (para o campo de valor ao editar). */
const valorDigitado = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = {
  /** A conta a editar; sem ela, o diálogo lança uma nova. */
  conta: ContaPagar | null;
  tipos: TipoDespesa[];
  centros: CentroCusto[];
  aoFechar: () => void;
};

/* Diálogo "Lançar conta a pagar" / "Editar conta": descrição, favorecido (nome livre nesta fase), tipo de
   despesa, centro de custo, forma, vencimento, valor e observação. A conta gerada pelo NILT (parcela do frete,
   taxa do cartão) só muda forma, centro de custo e observação: o resto aparece travado. Monte o diálogo só
   quando for abrir (ele abre ao montar e fecha ao desmontar). Ao gravar, a tela recarrega sozinha. */
export function DialogoConta({ conta, tipos, centros, aoFechar }: Props) {
  const id = useId();
  const gerada = !!conta && conta.origem !== "manual";
  const [erros, setErros] = useState<Partial<Record<CampoConta, string>>>({});
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();

  const centroInicial = conta ? String(conta.centroId) : String(centros.find((c) => c.codigo === CENTRO_PADRAO)?.id ?? "");
  const campo = (c: CampoConta) => `${id}-${c}`;
  const descrito = (c: CampoConta, ajuda = false) => [ajuda ? `${campo(c)}-ajuda` : null, erros[c] ? `${campo(c)}-erro` : null].filter(Boolean).join(" ") || undefined;

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const dados = new FormData(form);
    setErroAcao(null);
    const lido = gerada ? lerAjusteGerada(dados) : lerConta(dados, hojeISO());
    if (!lido.ok) {
      setErros(lido.erros);
      const primeiro = Object.keys(lido.erros)[0];
      form.querySelector<HTMLElement>(`[name="${primeiro}"]`)?.focus();
      return;
    }
    setErros({});
    iniciar(async () => {
      const r = conta ? await editarConta(conta.id, dados) : await lancarConta(dados);
      if (!r.ok) {
        setErroAcao(r.erro);
        return;
      }
      toast(conta ? "Conta alterada." : "Conta lançada. Outra pessoa precisa aprová-la antes do pagamento.");
      aoFechar();
    });
  }

  /** Qualquer edição apaga a frase de erro daquele campo. */
  function limpar(e: FormEvent<HTMLDivElement>) {
    const nome = (e.target as HTMLElement).getAttribute("name") as CampoConta | null;
    if (nome && erros[nome]) setErros((antes) => ({ ...antes, [nome]: undefined }));
  }

  const tipoAtualFora = conta && !tipos.some((t) => t.id === conta.planoId);
  const centroAtualFora = conta && !centros.some((c) => c.id === conta.centroId);

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      className="dlg-conta"
      titulo={conta ? `Editar a conta ${conta.numero}` : "Lançar conta a pagar"}
      onSubmit={aoEnviar}
      pe={
        <>
          <button className="btn" type="button" data-fechar>
            Cancelar
          </button>
          <button className="btn btn-primario" type="submit" disabled={gravando} aria-busy={gravando}>
            {conta ? "Salvar" : "Lançar"}
          </button>
        </>
      }
    >
      <div className="campos" onInput={limpar}>
        {gerada && (
          <div className="aviso aviso-info f12" role="note">
            <p>Esta conta foi gerada pelo NILT: só a forma de pagamento, o centro de custo e a observação podem mudar.</p>
          </div>
        )}

        <CampoDialogo classe="f12" id={campo("descricao")} rotulo="Descrição" erro={erros.descricao}>
          <input
            id={campo("descricao")}
            name="descricao"
            type="text"
            autoComplete="off"
            maxLength={MAX_DESCRICAO}
            placeholder="Ex.: Troca de pneus do cavalo 12"
            defaultValue={conta?.descricao ?? ""}
            disabled={gerada}
            aria-invalid={!!erros.descricao || undefined}
            aria-describedby={descrito("descricao")}
          />
        </CampoDialogo>

        <CampoDialogo classe="f12" id={campo("favorecido")} rotulo="Favorecido" erro={erros.favorecido} ajuda="Para quem vai o pagamento: fornecedor, pessoa ou empresa.">
          <input
            id={campo("favorecido")}
            name="favorecido"
            type="text"
            autoComplete="off"
            maxLength={MAX_FAVORECIDO}
            defaultValue={conta?.favorecidoNome ?? ""}
            disabled={gerada}
            aria-invalid={!!erros.favorecido || undefined}
            aria-describedby={descrito("favorecido", true)}
          />
        </CampoDialogo>

        <CampoDialogo classe="f6" id={campo("plano")} rotulo="Tipo de despesa" erro={erros.plano}>
          <select
            id={campo("plano")}
            name="plano"
            defaultValue={conta ? String(conta.planoId) : ""}
            disabled={gerada}
            aria-invalid={!!erros.plano || undefined}
            aria-describedby={descrito("plano")}
          >
            <option value="">Escolha</option>
            {tipoAtualFora && <option value={conta.planoId}>{conta.planoNome}</option>}
            {GRUPOS_PLANO.map((g) => {
              const itens = tipos.filter((t) => t.grupo === g);
              return itens.length ? (
                <optgroup key={g} label={ROTULO_GRUPO_PLANO[g]}>
                  {itens.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </select>
        </CampoDialogo>

        <CampoDialogo classe="f6" id={campo("centro")} rotulo="Centro de custo" erro={erros.centro}>
          <select id={campo("centro")} name="centro" defaultValue={centroInicial} aria-invalid={!!erros.centro || undefined} aria-describedby={descrito("centro")}>
            <option value="">Escolha</option>
            {centroAtualFora && <option value={conta.centroId}>{`${conta.centroCodigo} · ${conta.centroNome}`}</option>}
            {centros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo} · {c.nome}
              </option>
            ))}
          </select>
        </CampoDialogo>

        <CampoDialogo classe="f4" id={campo("forma")} rotulo="Forma de pagamento" erro={erros.forma}>
          <select id={campo("forma")} name="forma" defaultValue={conta?.forma ?? "boleto"} aria-invalid={!!erros.forma || undefined} aria-describedby={descrito("forma")}>
            {FORMAS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.rotulo}
              </option>
            ))}
          </select>
        </CampoDialogo>

        <CampoDialogo classe="f4" id={campo("vencimento")} rotulo="Vencimento" erro={erros.vencimento}>
          <input
            id={campo("vencimento")}
            name="vencimento"
            type="date"
            defaultValue={conta?.vencimento ?? ""}
            disabled={gerada}
            aria-invalid={!!erros.vencimento || undefined}
            aria-describedby={descrito("vencimento")}
          />
        </CampoDialogo>

        <CampoDialogo classe="f4" id={campo("valor")} rotulo="Valor (R$)" erro={erros.valor}>
          <input
            id={campo("valor")}
            name="valor"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            defaultValue={conta ? valorDigitado(conta.valor) : ""}
            disabled={gerada}
            aria-invalid={!!erros.valor || undefined}
            aria-describedby={descrito("valor")}
          />
        </CampoDialogo>

        <CampoDialogo classe="f12" id={campo("observacao")} rotulo="Observação" opcional erro={erros.observacao}>
          <textarea
            id={campo("observacao")}
            name="observacao"
            rows={2}
            maxLength={MAX_OBSERVACAO}
            defaultValue={conta?.observacao ?? ""}
            aria-invalid={!!erros.observacao || undefined}
            aria-describedby={descrito("observacao")}
          />
        </CampoDialogo>
      </div>

      {erroAcao && (
        <div className="aviso aviso-bloqueado" role="alert">
          <p>{erroAcao}</p>
        </div>
      )}
    </Dialogo>
  );
}

/** Botão "Lançar conta a pagar" do topo da tela (o único botão escuro dela): abre o diálogo da conta nova. */
export function BotaoLancarConta({ tipos, centros }: { tipos: TipoDespesa[]; centros: CentroCusto[] }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button className="btn btn-primario" type="button" onClick={() => setAberto(true)}>
        <Plus size={16} strokeWidth={1.6} aria-hidden="true" />
        Lançar conta a pagar
      </button>
      {aberto && <DialogoConta conta={null} tipos={tipos} centros={centros} aoFechar={() => setAberto(false)} />}
    </>
  );
}
